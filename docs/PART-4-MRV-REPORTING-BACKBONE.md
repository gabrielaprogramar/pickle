# Part 4 — EU MRV + THETIS-MRV Reporting Backbone

**Date:** 2026-09-03
**Phase:** Part 4 (formal reporting/evidence layer built on the shared operational truth)
**Verdict:** 🟢 **GREEN** (with two documented limitations that remain safely deferred: migration `0023` not executed against a live DB, and MRV CH₄/N₂O are not independently measurable from the shared registry)

## Scope
Part 4 elevates the EU MRV / THETIS-MRV module from a standalone "second calculator" into a formal reporting/evidence layer that consumes the **same** shared operational truth as EU ETS and FuelEU: the canonical `voyage_consumption` model, the shared applicability layer (`determineApplicability`), and the shared emission-factor registry. It deliberately does **not** build a new emissions calculator, does **not** do equal-share allocation, and does **not** perform Part 5 (reconciliation engine), AI-assisted verification, or production security hardening — those remain safely out of scope.

> **Important environment note:** there is no live Supabase/PostgreSQL in this environment. The schema migration `0023_init_mrv_reporting_backbone.sql` was written and its SQL statically checked against the existing migrations (`0019`, `0008`), but it has **not** been executed against a real database. It must be applied and verified (constraint/DML success) by an operator before a live hand-off.

---

## A. What was wrong / why this upgrade
The deep inspection (Part 3.6 + Part 4) found the EU MRV module had **not** yet been upgraded to the formal backbone:

| # | Finding | Resolution | Status |
|---|---|---|---|
| 1 | MRV performed **EQUAL-SHARE** allocation (`total deliveries / voyage count`) — the exact defect the Part 1 foundation forbids; a second, diverging emissions path | `generateReport` now consumes the canonical `voyage_consumption` model via `aggregateAnnualMrv`; no second calculator, no equal-share | **Fixed** |
| 2 | No first-class Monitoring Plan domain model (only a free-text `monitoring_plan_version` column) | New versioned `mrv_monitoring_plans` entity (Annex I) + deterministic active-plan resolution with REQUIRES_REVIEW on ambiguity | **Fixed** |
| 3 | No revision/amendment history — a report was a single row upserted in place, destroying prior content on revision | New append-only `mrv_report_versions` revision trail; immutable once written | **Fixed** |
| 4 | `regulatory_rules` had **no** `EU_MRV/mrv_scope` seed | Migration `0023` seeds it (5000 GT, 2024-01-01), so the shared applicability layer resolves MRV scope like EU_ETS/FUEL_EU | **Fixed** (migration pending live execution) |
| 5 | No explicit report lifecycle; nothing proved `DATA_INCOMPLETE`/`UNKNOWN` could only advance to VERIFIED/EXPORTED **with evidence** | New `lifecycle.ts` state machine + `mrv_reports.lifecycle` column; illegal forward jumps are refused | **Fixed** |
| 6 | Distance/time were reported as plain numbers, missing the DATA_INCOMPLETE / REQUIRES_REVIEW honesty required for auditable metrics | `aggregateAnnualMrv` returns AUDITED-only distance/time and flags DATA_INCOMPLETE rather than fabricating a 0 | **Fixed** |

## B. Scope of changes (files)
- `supabase/migrations/0023_init_mrv_reporting_backbone.sql` (new) — `mrv_monitoring_plans`, `mrv_report_versions`, `mrv_reports` lifecycle/period/distance/time columns, `EU_MRV/mrv_scope` seed
- `src/lib/supabase/types.ts` — extended `MrvReportRow/Insert`, new `MrvMonitoringPlanRow/Insert`, `MrvReportVersionRow/Insert`, `Database` mapping
- `src/lib/supabase/repositories/mrv_monitoring_plans.ts` (new), `mrv_report_versions.ts` (new), `index.ts` exports
- `src/lib/mrv/types.ts` — lifecycle, monitoring plan, stocktake, voyage entry with data-quality, report version; `MRV_CALCULATION_VERSION = "2.0.0"`
- `src/lib/mrv/monitoring-plan.ts`, `applicability.ts`, `lifecycle.ts`, `aggregation.ts`, `pipeline.ts` (new)
- `src/lib/mrv/service.ts` — delegates to the pipeline; persists HEAD + version; writes the immutable `audit_log` on every lifecycle transition
- `src/lib/mrv/completeness.ts`, `checklist.ts`, `export.ts`, `verifier-package.ts` — updated
- `src/app/api/vessels/[imo]/mrv/[year]/handler.ts`, `src/app/api/_lib/deps.ts` — pipeline wiring
- `src/lib/mrv/__tests__/mrv.test.ts` — rewritten + extended

## C. Shared canonical consumption (no equal-share, no second calculator)
`aggregateAnnualMrv` sums per-(vessel, voyage, fuel) rows from `voyage_consumption` — the **same** rows EU ETS and FuelEU persist. CO₂ uses the **shared** factor registry (`getFuelEmissionInfo`), so MRV, EU ETS and FuelEU agree on underlying tonnage (verified by cross-regulation consistency tests). Rows with a non-auditable status (`BLOCKED`, `INSUFFICIENT_DATA`, unknown fuel, negative) are **excluded** from the total and surfaced as unresolved — never silently under-stated. A voyage with no canonical row contributes 0 (never split).

## D. Applicability — shared, scope-aware
`refineMrvApplicability` layers deterministic EU-engagement awareness on the shared `determineApplicability` GT gate (rule `EU_MRV/mrv_scope` from `regulatory_rules`):
- GT not APPLICABLE → unchanged;
- an EU-scoped voyage → APPLICABLE;
- no voyage activity → REQUIRES_REVIEW (unproven engagement);
- all NON_EU, no unresolved ports → NOT_APPLICABLE;
- indeterminate scope / unknown ports → REQUIRES_REVIEW.

## E. Monitoring Plan domain model + deterministic active-plan resolution
Versioned, statused plans (DRAFT → … → APPROVED → SUPERSEDED; Annex I template). `resolveActiveMonitoringPlan` selects the single APPROVED plan effective on the as-of date, or returns `NOT_FOUND` / `REQUIRES_REVIEW` (never guesses):
- no APPROVED plan → NOT_FOUND (cannot legally report) → REQUIRES_REVIEW;
- approved but not yet effective (gap) → NOT_FOUND;
- >1 approved+effective with no SUPERSEDED marker → REQUIRES_REVIEW.

## F. Report lifecycle state machine
`lifecycle.ts` `canTransition` encodes allowed edges. Illegal jumps (`DATA_INCOMPLETE → VERIFIED`, `DATA_INCOMPLETE → EXPORTED`, `REQUIRES_REVIEW → EXPORTED`) return `ok:false`. The pipeline maps completeness/plan/metrics state to DATA_INCOMPLETE / REQUIRES_REVIEW / VALIDATED; it never fabricates a VERIFIED or EXPORTED that the evidence doesn't support.

## G. Explicit voyage/year boundaries & auditable metrics
A voyage crossing a year boundary is detected (`cross_year_voyages`) and drives REQUIRES_REVIEW unless partitioned with justification; the report version records explicit `period_start`/`period_end`. Distance and time-at-sea are recorded only when departure/arrival data are auditable — missing values yield `total_distance_nm`/`total_time_at_sea_hours: null` with `DATA_INCOMPLETE` flags, and completeness/export gate (BLOCKED) rather than emit a fabricated `0`.

## H. Revisions, amendments & the immutable audit log
Annual numbers live in the append-only `mrv_report_versions` (keyed `mrv_report_id, version_number`); each revision is a new immutable row and the HEAD (`mrv_reports`) mirrors the current one. On every report generation the service records `mrv.lifecycle_transition` into the existing `audit_log` (reused, never a second mechanism), capturing `before_data.lifecycle` → `after_data.lifecycle`, the reporting year, figures and monitored period, so no state change is silent. `lifecycle.ts` remains the enforcement gate for illegal jumps.

## I. Verifier package (reproducible from stored records)
`buildVerifierPackage` produces a `reproducibility_hash` over the report content + ordered source-record ids + calculation version, so the package can be rebuilt from stored records. It reports `source_bdn_count`, `voyage_export_count`, `discrepancy_notes`, `validation_results_ref`, `audit_references`.

## J. THETIS-MRV export + field mapping + submission posture
`export.ts` emits an Annex II structured document with an explicit `THETIS_FIELD_MAPPING` (Part C voyage list; Part D annual aggregates: fuel per type + factor, total fuel, CO₂ / CH₄ / N₂O in tCO₂e, total distance nm, total time at sea hours; Implementing Reg. (EU) 2023/2449). A deterministic `blockingExportIssues` gate **blocks** export whenever blocking evidence is unresolved. The export **never** claims a THETIS direct submission: `submission_status` is `SCHEMA_VALIDATED_LOCALLY` (or `BLOCKED`), with an explicit `ExternalSubmissionNote` that external submission is not performed by the system.

## K. Migration `0023` (static review only)
Adds `mrv_monitoring_plans`, `mrv_report_versions`; alters `mrv_reports` (widen `status` CHECK, add `lifecycle`/`period_start`/`period_end`/`monitoring_plan_ver`/`total_distance_nm`/`total_time_at_sea_hours`); seeds `EU_MRV/mrv_scope` (5000 GT, 2024-01-01). Statically checked against `0019` (regulatory_rules columns/UNIQUE) and `0008` (mrv_reports.status CHECK) — no `regulation` value CHECK blocks `EU_MRV`; seed guarded by `WHERE NOT EXISTS`. **Not executed** against a live DB (none available).

## L. Verification
- `npm run test:mrv` → **48 passed, 0 failed** (completeness, monitoring-plan resolution, applicability refinement, lifecycle, aggregation/no-equal-share, pipeline, MRV↔ETS and MRV↔FuelEU consistency, export/THETIS mapping + local-only posture + blocking gate, verifier-package reproducibility, service).
- Full `npm test` → **all suites GREEN** (zero failures across the entire chain).
- `npx tsc --noEmit` → exactly the **9 pre-existing errors** (all in unrelated `ai/ocr` test files); no new TypeScript errors in MRV / supabase / deps / handler.

## M. What was NOT changed / not started
- **No Part 5** (reconciliation engine), AI-assisted verification, or production security hardening.
- No second emissions calculator; CH₄/N₂O are not independently measurable from the shared registry — the report carries `ch4_co2e_tonnes`/`n2o_co2e_tonnes: 0` and `total_co2e = total_co2` (documented), consistent with the shared `getFuelEmissionInfo` surface.
- No THETIS direct submission endpoint (no public THETIS-MRV REST API); local schema validation only.
- EU ETS / FuelEU engines were not redesigned.

## N. Remaining limitations (documented, safely deferred)
1. **Live DB:** migration `0023` not executed here — operator must apply and confirm both new tables, the `mrv_reports` column/CHECK changes, and the `EU_MRV` seed.
2. **CH₄/N₂O:** not independently measured by the shared registry; reported as 0 tCO₂e with `total_co2e = total_co2`. A dedicated greenhouse-gas factor surface would remove this.
3. **Monitoring-plan lifecycle:** plan creation/amendment UI and verifier-feedback workflows are not built; the domain model and resolution logic are in place and test-covered.

## Verdict
🟢 **GREEN** — the EU MRV / THETIS-MRV module now reports on the shared canonical `voyage_consumption` and shared applicability/factors, with a first-class versioned Monitoring Plan, deterministic active-plan resolution, an enforced lifecycle state machine (no illegal forward jumps), auditable distance/time (DATA_INCOMPLETE/REQUIRES_REVIEW rather than fabrication), append-only revision history, a reproducible verifier package, a THETIS Annex II field-mapped export with an explicit `SCHEMA_VALIDATED_LOCALLY` / `BLOCKED` submission posture (never a claimed external submission), and the immutable `audit_log` wired for every state transition. Full regression GREEN; typecheck at the 9 pre-existing baseline. Pending only: executing migration `0023` against the live database.