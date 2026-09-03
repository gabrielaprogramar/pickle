# Part 4.6 — MRV / THETIS Correctness Fix (Responses to the Part 4.5 Adversarial Audit)

**Phase:** Part 4.6 (concrete correctness fixes on the MRV/THETIS backbone so it is SAFE to be the foundation for Part 5 reconciliation)
**Scope:** fixes ONLY the numbered 1–12 defects the Part 4.5 adversarial audit (YELLOW) found. Does NOT implement Part 5, does NOT redesign Parts 1–3, and adds no unrelated features.
**Verdict:** 🟢 **GREEN** — the MRV/THETIS backbone now safely supports Part 5 reconciliation, **with the single standing caveat that all migrations (0023, 0024) are statically verified only** and must be executed against a live Postgres before production use (§N).

---

## A. Executive verdict

**GREEN.** Every numbered defect (B1, B2, B3, B4, C1–C7, K, and the P‑list prerequisites) that the Part 4.5 audit proved unsafe is now fixed and *provably* covered by adversarial tests that do **not** hide the failure modes. The prior YELLOW had three root causes:

1. **Schema/constraint parity** — the upsert `onConflict("vessel_id, reporting_year")` had no UNIQUE constraint (B1) and the version table was never written with a real version (B2). Both are now corrected (new migration `0024`; service derives a monotonic `version_number`).
2. **Honesty of status/scope/aggregation** — PENDING/REVIEW rows were summed as audited (C1), scope was fabricated (C2), completeness flags were hardcoded (C3), and unknown fuels were folded through a MGO‑proxy factor (B4). All now derive from real data and never silently coerce.
3. **Immutability, auditability, and truthful export** — revisions destroyed the `report_data` evidence snapshot (C7), the report could not be read back (C4), export re‑ran the pipeline (C5) with a 31‑bit mislabelled hash (C6), and no rule/factor version was pinned (K). All now persist, pin, and re‑read.

The critique in the Part 4.5 audit §O — that the `MrvReportService` tests used a mock repository double with "no DB constraints and no unique violation behavior, so B1/B2/B3/C4/C5 are all invisible to the suite" — is addressed head‑on: the new Part 4.6 suite (`mrv.part4-6.test.ts`, 24 tests) uses **honest** in‑memory repositories that *enforce* `(report_id, version_number)` uniqueness and lifecycle rules, so the same failure modes the audit flagged are now covered, not papered over.

---

## B. Fixer — B1: `mrv_reports` upsert UNIQUE constraint (new migration, not a rewrite)

**Audit:** `mrv_reports.upsert(onConflict:"vessel_id, reporting_year")` was invalid against `0008`'s non‑unique `idx_mrv_reports_vessel_year`.

**Fix:** `supabase/migrations/0024_init_mrv_reporting_backbone_constraints.sql` — a **new** migration placed *after* `0023` (historical migrations are untouched). It:
- runs inside a `DO $$` `BEGIN … EXCEPTION… END $$` guard so it is idempotent/re-runnable (a duplicate-constraint error is swallowed as already-applied);
- first performs a duplicate-detection query and `RAISE`s a clear error if any `(vessel_id, reporting_year)` group has `count(*) > 1` (so we never drop data silently);
- `ALTER TABLE mrv_reports ADD CONSTRAINT mrv_reports_vessel_year_unique UNIQUE (vessel_id, reporting_year);`
- documents the intent with `COMMENT ON CONSTRAINT`.

Other upsert conflict targets (`mrv_report_versions`, the audit log, monitoring plans) were inspected and already carry the required UNIQUE keys (`(mrv_report_id, version_number)`, etc.).

> ⚠️ **Verification status:** migration `0024` (and `0023`) are **statically verified only**. There is no live Supabase/PostgreSQL or `psql` in this environment, so they have **not** been executed against a real database. This must be stated plainly: GREEN is claimed for the fix, not for live‑DB execution. (§N.)

## C. Fixer — B2: monotonic, constraint‑safe `version_number`

**Audit:** `buildReportVersion` hardcoded `version_number: 1`, so revisions collided.

**Fix:** `MrvReportService.generateReport` computes the next version from `versionRepo.findLatest(mrvReportId)` (returns `null` → version 1, else `latest + 1`), then appends the version row and only after a successful append updates the HEAD. The `append` route is required to be unique on `(mrv_report_id, version_number)` by the version repository interface and is enforced by the honest test repo, so a bare `MAX+1` collision cannot silently merge. Verified by the "second generation bumps the version to 2 (monotonic, no MAX+1 collision)" and "version numbers stay unique" tests.

## D. Fixer — B3 + single authoritative lifecycle transition

**Audit:** lifecycle `canTransition` existed but nothing enforced it; statuses were written directly.

**Fix:** a single authoritative method `MrvReportService.transitionMrvReport(vesselId, reportingYear, to)` now:
- loads the persisted report,
- validates `canTransition(from, to)` and **throws / refuses on illegal edges** (no state change),
- persists the new lifecycle only when legal,
- records an `mrv.lifecycle_transition` audit event with `before_data`/`after_data`.

`types.ts` no longer allows bare casts to bypass the state machine. Adversarial tests assert illegal edges (`DRAFT→VERIFIED`, `DATA_INCOMPLETE→VERIFIED`, `REQUIRES_REVIEW→EXPORTED`, and the service-level `VALIDATED→DATA_INCOMPLETE`) throw and leave lifecycle + audit unchanged, and that a legal `DRAFT→REQUIRES_REVIEW` persists and audits.

## E. Fixer — B4 / C1: unknown fuel never MGO; PENDING/REVIEW never audited

**Audit:** `getFuelEmissionInfo` fell back to a MGO‑proxy (CO₂ 3.206) for unknown fuels (B4), and aggregation summed `PENDING`/`REVIEW` rows as audited (C1).

**Fix (deliberately MRV‑scoped, no shared-surface break):**
- `src/lib/fuel-delivery/emission-factors.ts` gains an exported `isKnownFuelType(fuelType)` (over the canonical `KNOWN_FUEL_TYPES` set). `getFuelEmissionInfo`'s return type and legacy fallback are **unchanged**, so EU ETS / FuelEU arithmetic is untouched (their suites remain green).
- `src/lib/mrv/aggregation.ts` adds a `ConsumptionAuditClass` (`INCLUDED_IN_CALCULATION` / `INCLUDED_BUT_NOT_VERIFIED` / `EXCLUDED` / `BLOCKING`) and `classifyConsumptionAuditStatus(status, fuelType)`. The main loop gates audited tonnage and CO₂ on **`status === VERIFIED` AND `isKnownFuelType(fuelType)`**. PENDING ⇒ `INCLUDED_BUT_NOT_VERIFIED` (counted in `non_verified_consumption_count`, NOT in the audited figure); REVIEW / unknown fuel ⇒ `BLOCKING` (surfaced in `unresolved_consumption_count` and completeness). Unknown fuel is never multiplied by any proxy factor — it is *excluded* from the total and blocked.

Tests: unknown fuel `mystery_fuel_x` → audited fuel/CO₂ = 0, 1 unresolved, `isKnownFuelType` false; legitimate `mgo` stays audited; REVIEW excluded; PENDING non‑verified.

## F. Fixer — C2 + scope honesty: shared port classifier, UNKNOWN never coerced

**Audit:** the handler fabricated `INTRA_EU` from port-name presence and coerced unknown geography.

**Fix:** the handler now resolves voyage scope through the **shared** `classifyVoyagePortStatusWithHints` (`src/lib/eu-ets/port-classifier.ts`) enriched with `port_calls` country hints. Any unresolved geography yields type `UNKNOWN`/`REQUIRES_REVIEW`; it is **never** coerced to `INTRA_EU`. Not a carve‑out: the same classifier EU ETS uses, so EU‑scope judgement is single‑source. Tests assert unknown ports → `UNKNOWN` (not `INTRA_EU`), and authoritative country facts → `INTRA_EU`.

## G. Fixer — C3: completeness from real data (remove vacuous checks)

**Audit:** `consumption_sourced` was a vacuous `>= 0` check; AIS/BDN/validation flags were hardcoded.

**Fix:** `src/lib/mrv/completeness.ts`:
- `consumption_sourced` now requires `totalConsumptionCount > 0` (with the same fallback chain used by the aggregation), so a zero‑consumption dataset is BLOCKED, not auto‑sourced.
- new `consumption_verified` gate: with `nonVerifiedConsumptionCount > 0` the dataset cannot be verification‑readiness `VALID` (surfaced as BLOCKED/WARNING per severity).
- `MrvDatasetInfo` gains `totalConsumptionCount` / `nonVerifiedConsumptionCount`.

The handler supplies real values: AIS presence is sampled from `aisPositions.findByVesselImo(vessel.imo, { limit: 1 })`, unmatched BDN counts are read from the BDN store, and unresolved validation errors are determined by whether the fuel type is `isKnownFuelType` (unknown → unresolved). Tests: zero consumption → BLOCKED; PENDING (non‑verified) rows → BLOCKED for verification‑readiness.

## H. Fixer — C4: the MRV report can be read back via GET

**Audit:** the GET returned EU ETS data, not the persisted MRV report.

**Fix:** the handler's GET now returns the **actual** persisted MRV report via `deps.mrvReports.findByVesselAndYear(vesselId, year)`, and the `EtsComplianceService` import path was removed from the MRV handler. `rowToMrvReportResult` reconstructs a full `MrvReportResult` (applicability, plan, version, validation, completeness) from the stored row, so API read‑back equals what was generated. The response enrichment uses real data per §G.

## I. Fixer — C5 / C7: export from the persisted snapshot, export metadata persisted

**Audit:** export re‑ran the pipeline (mutating HEAD, colliding versions) and never persisted export metadata; the HEAD `report_data` snapshot was overwritten on revision and omitted from the version.

**Fix:**
- Export now operates on the persisted `MrvReportResult` (via `rowToMrvReportResult` from the stored HEAD) and the result (`export_format`, `export_content_hash`, `export_generated_at`, `export_file_path`) is written back with a full `rowToMrvReportInsert` overlay — the export columns are no longer left null.
- `pipeline.generateAnnualMrvReport` enriches `report_data` with the full version snapshot: voyage entries, fuel stocktakes, delivery ids, voyage ids, total CO₂e, completeness checks, lifecycle, a plain `version` projection, schema‑validation status, rule/geography pins, and the non‑verified counts. This snapshot is carried in the **append‑only** `mrv_report_versions` (via the version `traceability`/`report_data`), so revisions no longer destroy evidence — each revision keeps its own snapshot.
- Export is deterministic per snapshot: `generateXmlExport` derives its artifact timestamp from the report's persisted `generated_at` (falling back to now only for legacy inline callers), so re‑exporting the *same* persisted snapshot is byte‑identical → identical content hash (audit §13). Test: two exports of the same report are byte‑identical with equal SHA‑256.

## J. Fixer — C6: real SHA‑256 with an honest label

**Audit:** `simpleHash` was a 31‑bit rolling hash mislabelled `sha256-not-available`.

**Fix:** `src/lib/mrv/export.ts` now implements `sha256Hex(content)` with `node:crypto`'s `SHA‑256`, and `simpleHash` is re‑exported as a **backwards‑compatible alias** of the real SHA‑256 (so existing callers keep working while the underlying implementation is now a genuine hex digest). `verifier-package.ts`'s `reproducibility_hash` uses the same `sha256Hex`. No `sha256-not-available` marker remains. Tests assert a 64‑hex digest, `content_hash_algorithm: "sha256"`, determinism, and that the hash equals `sha256Hex(content)`.

## K. Fixer — rule/factor pinning + versioned reproducibility (audit §13)

**Audit:** no rule/factor version was pinned, so a report could not be reproduced under the rules in force when it was generated.

**Fix:** `MrvReportVersion` now carries `calculation_version`, `parameter_version`, `mrv_rule_version`, `mrv_rule_effective_from/until`, and `geography_version`. `buildReportVersion` sets these from an injected `pinnedRule` (`mrvRuleVersion`, `mrvRuleEffectiveFrom/Until`) plus the shared `ETS_CURRENT_PARAMETER_VERSION` and `PORT_CLASSIFIER_VERSION`. The service passes the currently effective pin on generation, and `report_data` records it — so the same persisted snapshot reproduces the exact version state. The "historical replay" test generates V1 under rule v1, mutates the source data **and** applies rule v2, regenerates to V2, and asserts V1's snapshot is byte‑identical (immutable) while V2 pins rule v2 — exactly the 2026‑V1‑immutable‑after‑2027‑→‑V2 property the task requires.

## L. Version/revision immutability after change

Covered in §C (monotonic numbering), §I (per‑version snapshot), and §K (replay/immutability). The version repository interface requires `(mrv_report_id, version_number)` uniqueness; the honest test repo throws on collision, modeling the DB constraint B1 adds. No `MAX+1`‑without‑constraint footgun remains.

## M. Auditability — broad audit_log coverage, single mechanism

Audit events are recorded (via the **existing** immutable `src/lib/supabase/repositories/audit_log.ts`; **no second mechanism**) on:
- every report generation (`mrv.lifecycle_transition` with before/after),
- every lifecycle transition (generation + `transitionMrvReport`),
- export (export metadata persistence).

The Part 4.6 tests assert that legal transitions produce audit events and that rejected transitions produce **none**.

## N. Database / migration assessment (statically verified only)

- `0024` (UNIQUE) and `0023` (backbone) are **statically verified only** — no live DB in this environment. GREEN is claimed for the code fix; live execution is owned by the deploy step. Duplicates are refused (RAISE), never dropped; the constraint is idempotent.
- The `mrv_report_versions` UNIQUE `(mrv_report_id, version_number)` is already correct; the app now populates real versions against it.
- No historical migration was modified.

## O. Test results (exact numbers)

- New adversarial suite `src/lib/mrv/__tests__/mrv.part4-6.test.ts`: **24 passed / 0 failed** (honest enforcing-in-memory repos — the coverage caveat of Part 4.5 §O is retired).
- MRV suite (both files, via `npm run test:mrv`): **48 + 24 passed / 0 failed**.
- Fuel‑emissions suite: **8/8**; EU ETS engine/compliance/pipeline: **52 + 22 + 6 = 80/80** (shared factor surface unchanged — §E).
- Full `npm test`: **1669 passed / 0 failed** (baseline 1645 + 24 new).
- `npx tsc --noEmit`: **exactly 9 pre‑existing errors** (2× `prompts.test.ts`, 7× `google-docai.test.ts`) — **no new TypeScript errors**.

## P. Required fixes before Part 5 — disposition

| P‑item | Disposition |
|---|---|
| 1 DB UNIQUE `(vessel_id, reporting_year)` | **Fixed** — migration `0024` (statically verified; live run pending) |
| 2 Revision numbering | **Fixed** — `findLatest`‑driven monotonic, append‑then‑HEAD |
| 5 Status honesty (PENDING/REVIEW) | **Fixed** — `ConsumptionAuditClass` gates audited totals |
| 6 Real scope via port/country data | **Fixed** — shared `port-call` classifier; UNKNOWN → REQUIRES_REVIEW |
| 7 Realistic completeness | **Fixed** — data‑derived AIS/BDN/validation; `consumption_sourced` fails on zero |
| 8 API read‑back | **Fixed** — GET returns the persisted MRV report |
| 9 Export integrity/persistence + real SHA‑256 | **Fixed** — export from snapshot; export metadata persisted; `sha256Hex` |

## Q. What was NOT rebuilt

- The shared `getFuelEmissionInfo` return type/legacy fallback is **unchanged** — the unknown‑fuel correction is MRV‑scoped via `isKnownFuelType`. EU ETS / FuelEU arithmetic is untouched (their suites are green).
- No new emissions calculator; no equal‑share allocation; Parts 1–3 untouched; Part 5 reconciliation not implemented.
- No second audit subsystem.

## R. Remaining limitations (documented, safely deferred, unchanged scope)

1. **Live‑DB execution of migrations `0023`/`0024`** — required before production; static verification only here.
2. **CH₄/N₂O** are not independently measurable from the shared registry; reported as documented (consistent with shared factors).
3. **Monitoring‑plan amendment / verifier‑feedback UI** remains future work (domain model + resolution logic are in place and tested).

## S. Final verdict

🟢 **GREEN** — the Part 4.5 YELLOW is resolved. The MRV/THETIS backbone now: has a real UNIQUE upsert target (migration `0024`, statically verified), a monotonic constraint‑safe version number (no bare `MAX+1`), a single authoritative lifecycle transition that rejects illegal edges, an honest consumption audit class that never folds PENDING/REVIEW/unknown fuels into audited figures and never fabricates an MGO‑proxy factor, a shared port classifier that never coerces unknown geography to `INTRA_EU`, data‑derived completeness with no vacuous checks, a GET that returns the actual persisted MRV report, an export that operates on the persisted snapshot and persists its metadata, a real `node:crypto` SHA‑256 (no `sha256-not-available`), per‑version rule/factor/geography pinning with replay‑proof immutability, and single‑mechanism audit coverage across generation/transition/export. **24 new adversarial tests** (with enforcing repositories) plus the full suite (1669 passed / 0 failed) and a clean typecheck (9 baseline only) support the verdict. The only standing caveat, inherited from the audit environment, is that migrations are **statically verified only** and must be run against a live Postgres before Part 5 depends on them.