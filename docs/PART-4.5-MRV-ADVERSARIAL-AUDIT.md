# PART 4.5 — MRV / THETIS ADVERSARIAL AUDIT

**Date:** 2026-09-03
**Mode:** Read-only adversarial review. No code was modified. No Part 5. No fixes.
**Baseline claim tested:** "Poseidon can produce a historically reproducible, verifier-ready, auditable MRV reporting package from the same canonical operational truth used by EU ETS and FuelEU."
**Verdict:** 🟡 **YELLOW** (see A / R)

---

## A. Executive verdict

**YELLOW.** The MRV backbone is substantially better than the pre-Part-4 state — it does consume the canonical `voyage_consumption` model, it has a real (tested) Monitoring Plan resolver, and it makes a correct, honest THETIS submission-posture claim. But **it is NOT yet safe to be the foundation for Part 5 reconciliation**, and several of the prior summary's claims are not supported by the code that actually exists:

- The **report persistence layer is broken against the real schema** (no UNIQUE constraint on `mrv_reports (vessel_id, reporting_year)` while the repo upserts with `onConflict: "vessel_id, reporting_year"`). On a live PostgREST backend, `generateReport` persistence throws. This is invisible to the test suite because the tests stub the repository.
- **Report revisions cannot produce v2+**: `buildReportVersion` hardcodes `version_number: 1`, so a second revision collides with the unique index `(mrv_report_id, version_number)`.
- **The lifecycle state machine is never enforced** — `canTransition` is not called by the service or any handler; the pipeline cannot even produce `VERIFIED`/`EXPORTED`, so "verifier approval → advance" is not wired at all.
- **Unknown/unrecognised fuel is silently assigned an MGO-proxy factor** and folded into audited totals (the `getFuelEmissionInfo` fallback makes the `!info` guard dead code).
- **The only MRV "GET" endpoint returns EU ETS data, not MRV data**; the MRV report is never readable via API.
- **Voyage scope is fabricated** as `INTRA_EU` for any voyage with both ports named, regardless of geography, which can wrongly lock applicability to APPLICABLE.

Nothing here is a fabricated number in the *tight* sense (the module never does equal-share, and distance/time are honestly DATA_INCOMPLETE). The defects are structural: **persistence/revision/lifecycle wiring, unknown-fuel handling, and provenance/state honesty**, all of which are exactly what Part 5 would have to depend on.

---

## B. Critical defects (statically verifiable, live-DB-breaking)

### B1. `mrv_reports` upsert cannot work against the actual schema
- `0008_init_eu_ets_and_mrv.sql:111` creates only a **non-unique** index `idx_mrv_reports_vessel_year (vessel_id, reporting_year)`. There is **no UNIQUE constraint** on that pair.
- `0023_init_mrv_reporting_backbone.sql` adds lifecycle/columns/CHECKs but **does not add a UNIQUE constraint** on `(vessel_id, reporting_year)`.
- `repositories/mrv_reports.ts:47` calls `.upsert(record, { onConflict: "vessel_id, reporting_year", ... })`.
- PostgREST `onConflict` resolves a *unique conflict target*; naming a non-unique column set → the request fails (EntityNotUnique / wrong conflict target). **Every `generateReport`/`handlePostMrvValidate`/`handlePostMrvExport` persistence call throws.**
- The service tests stub `upsert` in memory (`mrv.test.ts:549`), so this is never exercised. **STATIC analysis is conclusive; a live run would still fail.**

### B2. Revisions are impossible: `version_number` is always 1
- `pipeline.ts:131` (`buildReportVersion`) hardcodes `version_number: 1`.
- `service.ts:87,111` appends that `version_number` via `versionRepo.append`.
- Schema `0023` has `idx_mrv_report_versions_report_ver UNIQUE (mrv_report_id, version_number)`.
- A second `generateReport` for the same vessel/year upserts the HEAD (new data) then **appends v1 again → unique violation** → the whole operation throws after the HEAD was already overwritten. **Even before that**, generating twice produces only v1.
- There is no `findLatest -> next version` computation anywhere in the append path. Part 9 / Scenario 11 (report revision) is therefore **not implemented** despite being claimed GREEN.

### B3. Lifecycle state machine is dead code — not enforced
- `lifecycle.ts:63` `canTransition` exists and is unit-tested in isolation, but **nothing calls it** during generation or persistence:
  - `service.generateReport` never calls `canTransition`; it only *reads* the prior lifecycle to write to the audit log (`service.ts:52-137`).
  - `pipeline.ts:90-112` `lifecycleFor` derives the lifecycle purely from completeness/aggregation/plan and **never returns `VERIFIED`, `EXPORTED`, or `SCHEMA_VALIDATED_LOCALLY`**.
- Consequence: a report can only ever reach `DATA_INCOMPLETE` / `REQUIRES_REVIEW` / `VALIDATED`. **No code path advances a report to VERIFIED or EXPORTED**, and equally nothing prevents a (hypothetical) direct-write path from recording `VERIFIED` from `DATA_INCOMPLETE`. The "state machine" is not integrated, so the audit requirement "Check whether any API endpoint can bypass the lifecycle" cannot be satisfied — enforcement does not exist at all.

### B4. Unknown/unrecognised fuel → fabricated MGO-proxy factor (UNKNOWN → real number)
- `emission-factors.ts:58-60` `getFuelEmissionInfo` returns `FALLBACK_INFO` (co2 3.206, source `"POSL defaults (MGO proxy)"`) for **any** unrecognised string.
- `aggregation.ts:125-129` has a `if (!info)` guard that is **dead code** — `info` is never null.
- Net effect: a `voyage_consumption` row whose `fuel_type` is, e.g., `"diesel"`, `"MGO"` (uppercase), a typo, or a custom blend — with a valid status `VERIFIED`/`PENDING`/`REVIEW` — is **silently included in `total_fuel_mt` and `total_co2_tonnes` at factor 3.206**, labelled "AUDITED". This is exactly the "unknown → zero/default" class (§17), here manifesting as `UNKNOWN → 3.206` and presented as a clean audited number. Provenance to the MGO-proxy is only available in the per-fuel stocktake `source` column; the annual totals and the report lifecycle do not qualify it.

---

## C. High-risk defects

### C1. MRV counts PENDING and REVIEW consumption as audited
- `aggregation.ts:89` `AUDIT_STATUSES = {VERIFIED, PENDING, REVIEW}` and `:112-134` sums all of them into `total_fuel_mt`/`total_co2`.
- The shared producer sets `BDN_TO_VOYAGE → PENDING` and `CONFLICT_DELTA/UNKNOWN_FUEL_TYPE/INSUFFICIENT_FUEL_TYPE_DATA → REVIEW` (`regulatory/consumption.ts:366,414,203,296,320`).
- So a report can resolve to `VALIDATED` and be exportable while its underlying consumption rows are **unverified (PENDING)** or **flag conflicts / unknown fuel (REVIEW)**. "AUDITED_STATUSES" is misnamed — `REVIEW` and `PENDING` are explicitly *not* audited. A verifier-ready package must qualify these or exclude them (BLOCK / REQUIRES_REVIEW), not silently sum them. This is the single most important correctness risk for the reconcile layer.

### C2. Voyage EU-scope is fabricated in the handler
- `handler.ts:119`: `scope_type: v.departure_port_name && v.arrival_port_name ? "INTRA_EU" : "REQUIRES_REVIEW"`.
- Any voyage with both port names populated is labelled `INTRA_EU` regardless of actual geography. Because `refineMrvApplicability` treats `INTRA_EU` as EU engagement (`applicability.ts:42-43`), a vessel trading entirely outside the EU (e.g. US–Canada) with named ports is kept `APPLICABLE`. The otherwise-careful `REQUIRES_REVIEW` path for indeterminate scope is effectively unreachable whenever port names exist. **Fabricated classification → incorrect applicability** with no port-country/UNLOCODE resolution (contrast the EU ETS pipeline, which resolves authoritative port countries from `port_calls`).

### C3. Dataset completeness flags are hardcoded in the handler
- `handler.ts:138,140,147`: `hasAisData: true`, `hasUnmatchedBdns: false`, `hasUnresolvedValidationErrors: false` are constants, not derived from data. These drive completeness checks `ais_data_available`, `unmatched_bdns`, `no_unresolved_validation_errors`, which therefore can never fire in the real handler. The validation result is not a true reflection of the dataset (§11). `hasBdnCoverage` is a weak `some(...)` test on delivery references.
- `completeness.ts:56-58`: when the aggregation path is present, `consumption_sourced` passes with `count >= 0` — **always true** — so that base check is vacuous (it cannot fail). The substantive distance/time checks come from aggregation, which is good, but the "consumption present" check gives false confidence.

### C4. The MRV report cannot be read back via the API
- `handler.ts:44-70` `handleGetMrvReport` (mapped as the GET in `route.ts:16`) returns `{ vessel, eu_ets_record }` only — it builds an `EtsComplianceService` and returns EU ETS data. **No MRV fields are returned.** There is no route that returns the stored `MrvReportResult`. API/persistence audit (§16): the GET→response link is missing entirely.

### C5. Export re-runs the pipeline, mutates state, and never persists export metadata
- `handler.ts:230-234`: export calls `generateReport` (recomputes, upserts HEAD, appends version v1 → collides, see B2) purely to obtain a `MrvReportResult`, then calls `generateExport`. Export is therefore **not** operating on a stored revision; it is a fresh computation, and the result (`export_format`/`export_content_hash`) is **never written back** to the HEAD or a version (the HEAD export columns stay null).
- `service.generateExport` returns the result but nothing persists it (§16 data loss).

### C6. `simpleHash` is not an integrity hash and is mislabelled
- `export.ts:239-247` `simpleHash` is a 31-bit Java/HashCode-style rolling hash, and returns the string `"sha256-not-available:<hex>"`. It is used as `content_hash` (export) and as the `reproducibility_hash` (verifier package). It cannot provide the integrity/reproducibility guarantee claimed ("reproducible from stored records", "content_hash … integrity verification" per comment `0008:120`). **This is a false security label and a collision-prone manifest** (§12, §13).

### C7. `report_data` (evidence snapshot) is destroyed on revision; not in the version
- The HEAD `report_data` JSON (the only place storing `applicability`, `cross_year_voyages`, `unresolved_consumption_rows`, `monitoring_plan_resolution`) is overwritten by the `upsert` on each run. `mrv_report_versions` stores only aggregate numbers + source id lists — **not** the applicability/validation/evidence snapshot. So after a revision, "what was originally submitted / what changed" cannot be reconstructed from stored records (§13 violated in practice).

---

## D. Medium / low issues

- **D1.** `decideSox` (`emission-factors.ts:89`) `sulphurContentPct / 1.0` is a no-op (irrelevant to MRV CO2e, but a latent shared-foundation defect).
- **D2.** Coordination of `asOf`: EU ETS pipeline uses `asOf = <year>-01-01` (`eu-ets/pipeline.ts:67`); MRV handler uses `<year>-07-01` (`handler.ts:83`). Harmless unless a rule version changes mid-year, but the two engines do not agree which date is authoritative — Part 5 should assert both derive from the same effective-date semantics.
- **D3.** The MRV result carries `delivery_ids: []` (`pipeline.ts:214`) and `ets_record_id: null` (`handler.ts:163`); the MRV↔EU ETS linkage (`mrv_reports.ets_record_id`, comment in `0008`) is never populated by the Part 4 handler, so cross-regulation tracing at the DB row level is unavailable.
- **D4.** `src/lib/supabase/index.ts` exports `MrvReportRow/Insert` but **not** `MrvMonitoringPlanRow/Insert` / `MrvReportVersionRow/Insert` (imported via `@/lib/supabase/types` directly in the handler). Minor barrel inconsistency; not a compile failure.
- **D5.** Monitoring-plan resolution gap logic is sound, but the handler **honours a client-supplied `monitoring_plan_version` override** (`handler.ts:81,196-198`) that bypasses the resolver and is only shown as the *string* `monitoringPlanVersion`; the numeric `monitoring_plan_ver` still comes from the resolver (`pipeline.ts:155,209`). A mismatch between override string and resolved int can go unnoticed.
- **D6.** No RLS policies are created for `mrv_monitoring_plans` / `mrv_report_versions` (deny-by-default, service-role writes). Consistent with the codebase, but "append-only"/"immutable" is enforced only in code, not by a DB trigger — a direct write could mutate a recorded revision.

---

## E. Monitoring Plan assessment (audit §2)

**Domain model and resolver are well-built and correctly deterministic.** `resolveActiveMonitoringPlan` (`monitoring-plan.ts`) handles the required cases:
- single valid plan → RESOLVED (line 64);
- overlapping effective APPROVED plans with no SUPERSEDED marker → REQUIRES_REVIEW (line 79);
- no APPROVED plan → NOT_FOUND (line 42);
- future/gapped (approved but not yet effective) → NOT_FOUND (line 68);
- superseded marker breaks the tie → RESOLVED (line 88).

Versioning, statuses (DRAFT…APPROVED/SUPERSEDED, matches THETIS workflow), `effective_from/until`, `source_reference`, and `approved_at` are all present (schema `0023` + `types.ts`), and `nextMonitoringPlanVersion` is deterministic. **Verdict: PASS** for the resolver itself.

**Gaps (outside the resolver):**
- No stored field links a *report* to a *monitoring plan row id* — only the integer version (`mrv_reports.monitoring_plan_ver`) and the plan's `effective_from` are echoed. Reconstructing the exact approved snapshot (factor/procedure/gap-method decisions) that governed a given year requires joining plan version by (vessel, version) at read time and is not captured in the version row.
- The handler's client override (D5) slightly undermines determinism of which "plan" is displayed.
- No monitoring-plan change events are written to the audit log (see §20).

---

## F. Consumption assessment (audit §4) — **do not rebuild**

**No equal-share, no BDN-as-consumption fabrication, correct single model.** Verified: MRV consumes `voyage_consumption` (handler `:93`, aggregation from the shared rows), and the only producer is `attributeVoyageConsumption` (`regulatory/consumption.ts`), which carries an explicit `EQUAL_SHARE` DB CHECK forbidding the method (`0019:203`) and refuses to fabricate (returns BLOCKED/INSUFFICIENT_DATA). Multi-fuel splitting uses the corrected `BDN_RATIO` proportional split or refuses (`consumption.ts:90-140`). **The previously suspected `quantity_mt`/`fuel_deliveries`/equal-share patterns are absent from the MRV path.**

**But the aggregation's status filter is too loose (C1):** `total_fuel_mt`/`total_co2` include `PENDING` and `REVIEW` rows. "PENDING" (default BDN attribution) and "REVIEW" (conflict / unknown-fuel-type) are not audited; treating them as part of the *final* annual figure conflates "evidence exists" with "audited". This must be qualified before Part 5.

**Provenance (§5) is partially present:** the report version records `source_consumption_ids`/`source_voyage_ids` (`pipeline.ts:143-146`) and `traceability.consumption_source="voyage_consumption"` (service `:107`). But the per-row link back to *method/noon-report/ROB/BDN IDs* lives only in the `voyage_consumption.source_record_ids`/`traceability` on the consumption rows — the annual report does **not** surface a per-number provenance chain (which BDN/noon report produced each tonnage). A verifier cannot, from the MRV package alone, say "this quantity came from noon report X." That is a completeness-of-package gap (see I).

---

## G. Emissions assessment (audit §6)

- CO2 is computed from the **shared** `getFuelEmissionInfo` (correct factor source/version recorded as `parameter_version`, and per-stocktake `source`). The EU ETS and MRV use the *same* factor surface, so parity of the *math* holds (and the consistency test confirms it on identical inputs).
- **Unknown fuel defect (B4):** the shared fallback silently defaults unrecognised fuel to MGO-proxy, and MRV's `!info` guard is dead. **Unknown → 3.206** (not zero, not NO_FACTOR, not REQUIRES_REVIEW). This is the top emissions-correctness defect.
- `ch4_co2e_tonnes`/`n2o_co2e_tonnes` are hardcoded `0` and `total_co2e = total_co2` (`pipeline.ts:138-140`, `aggregation.ts:229`). This is documented and conservative ("CH4/N2O not in shared registry scope"), so it is acceptable *only if* surfaced as a limitation, never as a measured zero. The export does not explicitly flag it as "not measured," so a reader could read a hard `0` as a real measurement.

---

## H. Annual aggregation / cross-year (audit §7, §8)

- **Aggregation is deterministic, single-pass, and distance/time are honestly AUDITED-or-DATA_INCOMPLETE** (`aggregation.ts:149-259`). Total distance/time are `null` (with BLOCK) when any voyage is missing auditability — no fabricated 0. Cross-year voyages are detected from departure/arrival year mismatch (`aggregation.ts:171`) and force REQUIRES_REVIEW via `lifecycleFor` (`pipeline.ts:96`). **Good.**
- **Cross-year partitioning is actually decided upstream, not here.** `voyage_consumption` is bucketed by a single `reporting_year` column at write time (`voyage_consumption.ts:89`); MRV lists by that year. MRV's cross-year detection is a *secondary red-flag* on the voyage list, not a partition. If the upstream producer assigned a whole cross-year voyage to one reporting year, MRV has no longitude/time-based split — only the REQUIRES_REVIEW flag. That is defensible (deterministic + review) but must be disclosed: an exact time-partitioned split is **not** implemented; it is deferred to REQUIRES_REVIEW. Consistent with the module's stated intent.
- **No double-counting** in the aggregation itself: each row counted once; per-voyage entries and the annual total draw from the same row set (both exclude only `BLOCKED`). The earlier apparent per-voyage-vs-annual difference does not manifest because the status domain is exactly `{PENDING,VERIFIED,REVIEW,BLOCKED}`.

---

## I. Verifier package (audit §12)

- `buildVerifierPackage` collects references (BDN count, voyage count, discrepancy notes, validation ref, audit refs, a hash) — **it does not embed the report/Evidence/BDN/AIS artifacts.** It is a *reference manifest*, not a self-contained verifier dossier. Whether that meets "reproducible from stored records" depends on the files actually existing behind the references (not verified here).
- **Reproducibility hash is weak (C6):** it is `simpleHash` over `reportContent + calculationVersion + sorted sourceRecordIds`. It is deterministic (test passes on identical inputs), but 31-bit and not collision-resistant; it is labelled `sha256-not-available`, which actively misrepresents integrity. It also omits `parameter_version`, `monitoring_plan_version`, `version_number`, and the applicability/validation snapshot, so it cannot pin the exact report state.
- **Regenerating "the same report from the same snapshot" does not reproduce the same hash** across separate runs in general, because the pipeline stores no snapshot of the *rule versions actually applied to that year* beyond `parameter_version` (see K) and because `generated_at` timestamps differ. The *unit test* proves determinism only for identical in-memory inputs with identical `generated_at` — it does **not** prove historical reproducibility against the DB.

---

## J. THETIS export (audit §14, §15)

- **Field mapping is explicit and honest** (`THETIS_FIELD_MAPPING`, Annex II Part C/D; Implementing Reg. (EU) 2023/2449), and the submission posture is correct: `submission_status = SCHEMA_VALIDATED_LOCALLY`, with an explicit "External THETIS submission is NOT performed" note. **The export never claims a real THETIS submission** — that claim requirement is **satisfied**.
- **Contradiction on the BLOCKED path:** `blockingExportIssues` can return BLOCKED and `MrvExportResult.submission_status` becomes `"BLOCKED"`, yet the **XML body still writes `<SubmissionStatus>SCHEMA_VALIDATED_LOCALLY</SubmissionStatus>`** (`export.ts:168`) and still emits a full content payload (with a `<BlockingIssues>` list). So a "blocked" export **still produces content** whose embedded status disagrees with the wrapper status. `generateXmlExport`/`generateCsvExport` should refuse to emit content when blocked (return BLOCKED with no payload), not emit a contradictory document.
- **Placeholders:** `TotalDistanceNm`/`TotalTimeAtSeaHours`/`DistanceNm` write `""` when null (`export.ts:108-109,136`) — but those paths are supposed to be blocked before emission; emitting empty-string placeholders for audited metrics is itself a mild reportability risk. `EmissionFactorSource` for unknown fuel would say `"POSL defaults (MGO proxy)"` (see B4). No fake IMO/dates/identifiers were found.
- The export is **not persisted** and **not tied to a report version** (C5).

**Internal Poseidon report / verifier package / THETIS-ready export / actual THETIS submission** are cleanly distinguished, and the software stops short of claiming submission. **PASS on claim honesty; FAIL on blocked-export coherence and non-persistence.**

---

## K. Historical reproducibility / rule version pinning (audit §13)

**Not demonstrated, and structurally incomplete.** The 2026→2027 rule-change scenario:

- The MRV pipeline reads `EU_MRV/mrv_scope` via `findEffective("EU_MRV","mrv_scope", asOf)` (`handler.ts:123`) — i.e., it uses the rule effective **as of the current run's as-of date**, not the rule version pinned at original generation time.
- The annual `MrvReportResult` records `parameter_version` = `ETS_CURRENT_PARAMETER_VERSION` (`pipeline.ts:36,191`, a constant, not a resolved rule version) — this is the ETS parameter version, **not** the MRV scope/emission-factor versions.
- The stored `mrv_report_versions.calculation_version` = `MRV_CALCULATION_VERSION` and `parameter_version` = ETS constant. Neither pins the **emission-factor registry version** nor the **`EU_MRV` rule version** that produced a particular year's report.
- Therefore, if emission factors or the scope rule are updated (a `2027.1`), re-running the 2026 pipeline will recompute 2026 **with the latest registry/rule**, and nothing in the stored package can reproduce the 2026.1 figures. **The core "must NOT silently recalculate using current rules" requirement is not met.**
- The Monitoring Plan version *is* recorded (`monitoring_plan_ver`) and the resolver is deterministic for a fixed as-of, which is good; the fault is the rule/factor snapshot, not the plan snapshot.

---

## L. Cross-regulation consistency (audit §19)

- Underlying truth is shared and identical: both MRV (`handler.ts:93`) and EU ETS (`eu-ets/pipeline.ts:155`) consume the same `voyage_consumption` table and the same `getFuelEmissionInfo` factors and same `determineApplicability` foundation. **No second operational truth exists.** Vessel/voyage/fuel identity come from the same rows. This is the system's biggest genuine strength.
- **Discrepancies that are regulatory, not data:**
  1. Applicability as-of date differs (D2): MRV mid-year `07-01` vs EU ETS year-start `01-01`; region/scope logic differs by design (GT-only vs coverage rules).
  2. EU ETS emits CO2 with `quantity_mt*1000*factor /1000` (`emissions.ts`), MRV with `quantity_mt*factor` — numerically identical, so fine.
- **A substantive shared defect affects both equally (so parity is preserved but wrong):** `getFuelEmissionInfo`'s MGO-proxy fallback means *unrecognised fuel types* get the same fabricated 3.206 in both MRV and EU ETS. The consistency test therefore passes because both are equally wrong. Parity ≠ correctness.
- Also note `EU ETS computeEtsEmissions` operates on **fuel deliveries**, whereas MRV operates on **attributed per-voyage consumption** — these are legitimately different (deliveries vs consumption), so a naive MRV↔ETS "same number" check could falsely fail; the Part 4 consistency test correctly uses shared consumption for the parity assertion. Document this so Part 5 does not misread a delivery-vs-consumption difference as a bug.

---

## M. Auditability / audit log (audit §20)

- `service.generateReport` writes **one** immutable event to the shared `audit_log` (`service.ts:118-137`): `action=mrv.lifecycle_transition`, with `before.lifecycle` → `after.lifecycle`, reporting year, calc version, fuel/CO2, monitoring-plan version, monitored period. Reuses the existing mechanism (no second system). **Good.**
- **Gaps:**
  - `before.lifecycle` is read *just before* the upsert but is not used to gate the transition (B3), so the audit records a transition the state machine never validated.
  - **No audit events** for: monitoring-plan changes, report *created vs. revised* (every run is recorded as `mrv.lifecycle_transition` regardless of whether it is v1 or a revision), verifier-package generation, export generation, or amendment creation. The audit log therefore does not capture WHO/WHAT/WHEN for most of the §20-required events — it only captures "a generate run happened." The `actor_id`/`actor_email` are not populated from any handler (not passed), so WHO is lost.
  - `audit_log` writes only happen when **both** `auditLog` and `organizationId` are injected; the handler *does* pass them (`handler.ts:194,230`), but a caller omitting them silently loses all auditability.

---

## N. Database / migration assessment (audit §21)

**Static verification only — no live Postgres is available in this environment, and I did not execute migrations.** Clearly distinguished:

- **Fatal (B1/B2):** `mrv_reports` lacks a UNIQUE constraint for the `upsert(onConflict="vessel_id, reporting_year")`; `mrv_report_versions` UNIQUE is correct but the app only ever writes `version_number = 1`.
- **Sound:** FKs to `vessels`/`mrv_reports` (CASCADE), CHECK constraints on status/lifecycle/methodology/submission_status, `NUMERIC(14,4)` types, non-null period fields, `monitoring_plan_ver` FK to nothing (loose int reference — could not resolve to a row), `regulatory_rules (regulation,rule_key,version)` UNIQUE + effective-order CHECK (so the `EU_MRV/mrv_scope` seed is safe; `regulation` has no value CHECK, so `EU_MRV` is valid). RLS enabled (deny-by-default) on all three new tables.
- **No DB trigger** enforces version append-only immutability or that HEAD mirrors the latest version (code-only; D6).
- **Backfill:** existing rows after 0023 will have `lifecycle = NULL` and `period_start/end = NULL`; the new status CHECK is widened (older values valid), but no statement backfills `lifecycle` from `status`. A live upgrade needs review.

---

## O. Test results (audit §23, exact numbers)

Run on this environment (Windows PowerShell; the repository's matcher set is limited to `toBe/toEqual/toBeNull/toBeTruthy/toBeFalsy/toContain/toBeGreaterThan/toBeLessThanOrEqual/toContainString/toThrow`).

- MRV suite: **48 passed, 0 failed, 48 total** (matches prior claim).
- Full `npm test`: **all suites GREEN; aggregate 1645 passed, 0 failed** (sum of suite subtotals).
- `npx tsc --noEmit`: **9 errors, all pre-existing and unrelated** (2× `src/lib/ai/__tests__/prompts.test.ts`, 7× `src/lib/ocr/__tests__/google-docai.test.ts`). **No new type errors** in MRV/deps/handler/supabase.
- Foundation suites relevant to this audit are green: regulatory (applicability + consumption), EU ETS (+ pipeline.integration), FuelEU (+ pipeline.integration), fuel-delivery, noon, certificates, audit-log, reporting.

**Coverage caveat (why GREEN tests coexist with YELLOW verdict):** the `MrvReportService` tests use an in-memory repository double (`mrv.test.ts:542-617`) with no DB constraints and no unique violation behavior, so the B1 upsert, B2 version-collision, B3 non-enforcement, B4 fallback, C4 GET-missing, and C5 export-non-persistence are **all invisible to the suite**. The lifecycle/aggregation/export tests exercise pure functions with well-formed inputs; they do not model the failure modes Part 5 would depend on.

---

## P. Required fixes before Part 5

Ordered by blast radius:

1. **DB constraint parity (B1):** add `UNIQUE (vessel_id, reporting_year)` to `mrv_reports` (new migration) so `onConflict` upsert is valid; verify on a live DB. Re-run/post-schema-upgrade.
2. **Revision numbering (B2):** compute `version_number` from `versionRepo.findLatest(...).version_number + 1` instead of the hardcoded `1`; never overwrite the HEAD *before* the version append succeeds (make persist atomic / transactional).
3. **Lifecycle enforcement (B3):** call `canTransition(prior.lifecycle, result.lifecycle)` in `generateReport` and reject/REQUIRES_REVIEW invalid edges; wire explicit, evidence-gated transitions to `VERIFIED` and `EXPORTED`; reject before any persist. Ensure the audit `before/after` reflects an *enforced* transition.
4. **Unknown fuel (B4):** stop folding MGO-proxy fallback into audited totals for MRV. Treat unrecognised `fuel_type` as unresolved (`NO_FACTOR`/`REQUIRES_REVIEW`) and exclude from `total_fuel_mt`/`total_co2` until a real factor is stored; remove the dead `!info` guard and make the fallback explicit + gating.
5. **Status honesty (C1):** exclude `PENDING` and `REVIEW` consumption rows from the audited annual total (or carry an explicit `UNRESOLVED_METH_COUNT`/`REQUIRES_REVIEW` lifecycle coupling) with audit provenance per row (method → noon/ROB/BDN IDs).
6. **Scope (C2):** resolve real EU engagement from port-country data (like `port_calls` in the EU ETS pipeline), not a name-presence `INTRA_EU` heuristic; default to REQUIRES_REVIEW where geography is unknown.
7. **Realistic completeness (C3):** derive AIS/BDN/validation flags from data; make `consumption_sourced` fail on zero consumption instead of `count >= 0`.
8. **API read-back (C4):** implement a GET that returns the stored MRV report (applicability, plan, version, validation) and persists/populates `ets_record_id`.
9. **Export integrity (C5/C6/J):** persist export to the HEAD/version; refuse to return content when BLOCKED (align XML embedded status with wrapper); replace `simpleHash` with a real SHA-256 and drop the `sha256-not-available` label.
10. **Reproducibility (K):** store the rule + factor versions actually applied (snapshot `MRV scope` rule version/effective window + factor registry version) with each `mrv_report_versions` row and pin them on regeneration; do not recompute a past year with current rules.
11. **Audit breadth (M):** write `audit_log` events on plan changes, create-vs-revise, verifier-package generation, and export; carry `actor` (WHO) through handlers.
12. **Package/evidence (I):** embed or tightly reference (stable hashes of) the actual BDN/AIS/noon artifacts and per-number provenance in the verifier package so "where did this number come from" is answerable from the package alone.

## Q. What MUST NOT be rebuilt

- **Do not rebuild a second consumption/emissions calculator.** `attributeVoyageConsumption` + the shared factor registry + shared `determineApplicability` are the correct single source (already shared with EU ETS/FuelEU). Extend/qualify them (P4, P6, P10), do not fork them for MRV.
- **Do not add equal-share or per-voyage allocation** anywhere in MRV or Part 5. It is already forbidden by the DB CHECK and by design; keep it that way.
- **Do not create a second audit system or a second "truth" table.**
- **Do not reintroduce a GT>=threshold-only or `?? false` applicability path** — the shared rule-driven layer is correct; only the handler's scope heuristic (C2) and rule/factor pinning (P10) need fixing.
- **Do not start real THETIS submission** — there is no public THETIS-MRV API; retain `SCHEMA_VALIDATED_LOCALLY` + explicit non-submission claim and add `EXTERNAL_SCHEMA_VALIDATION_PENDING` semantics if any external schema check is ever claimed.

## R. Final verdict

🟡 **YELLOW**

The MRV/THETIS backbone **correctly shares the canonical operational truth** (same `voyage_consumption`, same factors, same applicability foundation, no equal-share, an honest monitoring-plan resolver, and a truthful THETIS submission posture) — this is a structurally sound *core*. It is **not yet safe as the foundation for Part 5**, because the persistence layer is broken against the real schema (no unique constraint for the upsert), revisions cannot advance past v1, the lifecycle state machine is never enforced, unknown fuel is silently defaulted to an MGO proxy inside audited totals, unverified (PENDING/REVIEW) consumption is summed as audited, the MRV report is not readable via the API, historical reports are not pinned to their rule/factor versions, and the "reproducibility" hash is non-cryptographic and mislabelled.

These are **specific, fixable defects**, not fundamental architectural errors — hence YELLOW, not RED. They must be resolved (see P) and validated against a **live Postgres** before the reconciliation layer is allowed to depend on this module. Migration `0023` was **statically verified only**; it has **not** been executed against a real database.