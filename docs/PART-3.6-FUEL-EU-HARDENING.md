# Part 3.6 — FuelEU Hardening (Post-Audit Fix Phase)

**Date:** 2026-09-03
**Phase:** Part 3.6 (fixes for the Part 3.5 🟡 YELLOW adversarial audit)
**Verdict:** 🟢 GREEN (with two pre-existing, documented limitations that remain safely deferred)

## Scope
This phase hardened FuelEU and its shared consumption foundation after the Part 3.5 adversarial audit identified six concrete defects. Every fix is deterministic, traceable, and honest about what the system does not know (UNKNOWN / REQUIRES_REVIEW / INSUFFICIENT_FUEL_TYPE_DATA / UNKNOWN_FUEL_TYPE / BLOCKED are used rather than fabricated certainty). Unrelated modules were not touched; MRV was not started.

> **Important environment note:** there is no live Supabase/PostgreSQL in this environment. The schema migration `0022` was written and its SQL statically checked against the existing migrations, but it has **not** been executed against a real database. It must be applied and verified (constraint success) by an operator before a live MRV hand-off.

---

## A. Defect inventory & resolution summary

| # | Part 3.5 defect | Resolution | Status |
|---|---|---|---|
| 1 | **CRITICAL** `fuel_eu_records` / `eu_ets_records` had NO unique constraint on `(vessel_id, reporting_year)` while repos use `ON CONFLICT` — production PostgREST upsert would fail | Migration `0022` adds real UNIQUE indexes `fuel_eu_records_vessel_year_uniq` / `eu_ets_records_vessel_year_uniq` (replacing the non-unique indexes); deterministic failure on duplicate rows | **Fixed** (migration pending live execution) |
| 2 | Noon report carried only a scalar total `fuel_consumption_tonnes`; the pipelines attributed the FULL total to every fuel type → N× double count | Shared `attributeVoyageConsumption` noon path now splits the total across fuel types by BDN-ratio (deterministic, matches `correlateNoonFuel`); single-fuel stays intact; no defensible split → `INSUFFICIENT_FUEL_TYPE_DATA`/REVIEW | **Fixed** |
| 3 | ROB fallback built `robsByDate` with `fuel_type: ""`, lumping all ROBs into one unknown fuel | ROB delta is now only attributed when fuel type is known and matches the request; an unknown-fuel or mismatched ROB is surfaced as `UNKNOWN_FUEL_TYPE`/`INSUFFICIENT_FUEL_TYPE_DATA` (REVIEW), never attributed to a wrong fuel | **Fixed** (honest refusal; schema has no per-fuel ROB) |
| 4 | Banking/borrowing/pooling were single-shot in-memory with no cross-year state or double-spend protection | All three are now **safely deferred**: when requested they return REQUIRES_REVIEW / POOLING_REQUIRES_REVIEW with `energy_mj_applied: null` — never a fabricated APPLIED amount | **Fixed (safe deferral, Option B)** |
| 5 | Unit mislabel: intensity balance (gCO₂e/MJ) was labeled `energy_mj_applied` / `surplus_energy_mj` (MJ) | Corrected: balance tools never emit a fake MJ figure; pool snapshot renamed to `surplus_intensity_gco2e_per_mj` and documented that a true energy conversion requires `(balance/baseline) × total_energy_mj` | **Fixed** |
| 6 | OPS hardcoded `ops_energy_mj = 0` conflating "zero" with "unavailable" | OPS unavailable is now `ops_energy_mj: null` (never a fabricated 0) with `ops_data_available: false`; same for WtW verification metadata and port-call-aware applicability | **Fixed** |

## B. Scope of changes (files)
- `supabase/migrations/0022_harden_fueleu_and_ets_pipelines.sql` (new)
- `src/lib/regulatory/consumption.ts` — noon multi-fuel split, ROB fuel-type honesty, new methods
- `src/lib/fueleu/pipeline.ts` — full-delivery pass-through, port-call-aware applicability, OPS null
- `src/lib/eu-ets/pipeline.ts` — full-delivery pass-through (shared attribution)
- `src/lib/fueleu/compliance.ts` — banking/borrowing/pooling safe deferral, OPS nullable, unit-fix types
- `src/lib/fueleu/pooling.ts` — pool snapshot unit correction
- `src/lib/fueleu/parameters.ts` — WtW verification metadata (methanol/ammonia/hydrogen)
- `src/lib/fueleu/types.ts`, `src/lib/fueleu/service.ts` — type adjustments

## C. Noon multi-fuel double-count (Defect 2)
The shared `attributeVoyageConsumption` is the single point that both FuelEU and EU ETS pipelines call. Both pipelines now pass the **full per-voyage delivery set** (not a pre-filtered single fuel), and the noon path (`splitNoonConsumption`) resolves the aggregate total into the requested fuel's share:

- exactly one distinct fuel → full total (existing single-fuel behavior preserved);
- multiple fuels with BDN deliveries → proportional split `share = total_mt × (delivered_mt(fuel)/total_delivered_mt)` (matches the deterministic `correlateNoonFuel` ratio, so `sum(shares) = total`, no double count);
- multiple fuels but no defensible ratio → `INSUFFICIENT_FUEL_TYPE_DATA`, status REVIEW, quantity 0 (never a fabricated per-fuel row).

A new migration value `INSUFFICIENT_FUEL_TYPE_DATA` (and `UNKNOWN_FUEL_TYPE`) was added to the `voyage_consumption.method` CHECK.

## D. ROB fuel-type honesty (Defect 3)
The current schema (`noon_reports`, migration 0016) stores only a scalar total ROB with no per-fuel split. Therefore a ROB delta **cannot** be truthfully attributed to a specific fuel. The engine now:

- attributes a ROB delta only when the ROB group's fuel type is known and matches the requested fuel;
- refuses (REVIEW) when the fuel type is unknown (`UNKNOWN_FUEL_TYPE`) or mismatched, instead of writing a row with `fuel_type: ""`.

A future per-fuel ROB column would remove this limitation.

## E. Banking / borrowing / pooling — safe deferral (Defect 4)
There is no persistent cross-year ledger or double-spend protection in the current model. Banking/borrowing/pooling therefore **never report APPLIED**. When requested they produce:
- banking / borrowing → `REQUIRES_REVIEW`, `energy_mj_applied: null`;
- pooling → `POOLING_REQUIRES_REVIEW`, `energy_mj_applied: null`, with the pool evidence listed.

This is the honest, legally-defensible Option B (defer rather than compute an unenforceable amount). The `deriveStatus` logic already maps these to REQUIRES_REVIEW / POOLING_REQUIRES_REVIEW, so no correct-vs-wrong result is ever presented as certain.

## F. Unit model (Defect 5)
- `compliance_balance` remains the intensity balance in **gCO₂e/MJ**.
- Banked/borrowed "energy" is no longer surfaced as MJ (`energy_mj_applied: null`).
- The pool snapshot field was renamed to `surplus_intensity_gco2e_per_mj` and documented: a true energy equivalent is `(intensity_balance/baseline) × total_energy_mj`.

## G. OPS availability (Defect 6)
`ops_energy_mj` is now `number | null`. When OPS data is unavailable the pipeline passes `null` (not 0) with `ops_data_available: false`; the compliance engine exposes `ops_energy_mj: null` and still raises the `MISSING_CONSUMPTION` exception so the at-berth gap is visible.

## H. WtW verification metadata
`methanol` (81.0), `ammonia` (82.0), `hydrogen` (85.0) now carry `requires_regulatory_verification: true`, consistent with every other WtW factor. Values were **not** changed.

## I. Port-call-aware applicability
`determineApplicability` remains the shared, rule-driven GT gate. In the FuelEU pipeline a deterministic refinement `refineFuelEuApplicability` folds in the derived per-voyage scope:

- GT not APPLICABLE → decision unchanged;
- at least one EU-scope voyage (INTRA_EU / EU_TO_THIRD / THIRD_TO_EU) → APPLICABLE;
- no voyages recorded → REQUIRES_REVIEW (EU participation unproven);
- all voyages confirmed NON_EU with no unresolved ports → NOT_APPLICABLE for that year;
- indeterminate / unresolved ports → REQUIRES_REVIEW.

## J. Migration `0022`
Adds unique constraints on `(vessel_id, reporting_year)` for both `fuel_eu_records` and `eu_ets_records` (dropping the old non-unique indexes), and extends the `voyage_consumption.method` CHECK. Duplicate rows cause a loud, deterministic failure rather than silent coalescing.

## K. Verification
All test suites GREEN (full `npm test`, zero failures):
- FuelEU: unit 26 (was 20) + pipeline 9 (was 7)
- EU ETS: 80; regulatory: 27; fuel: 98; MRV: 32; noon: 151; certificates: 106; compliance: 57; settings: 43; audit: 6; assistant search: 6
- `npx tsc --noEmit` → exactly the 9 pre-existing errors (all in unrelated `ai/ocr` test files)

## L. What was NOT changed / not started
- Part 1 and EU ETS engines were not redesigned (only the shared attribution contract was fixed).
- MRV was not started.
- No hardcoded 91.16 in production FuelEU code (only fixtures/tests/seeds, as before).

## M. Remaining limitations (documented, safely deferred)
1. Live DB: migration `0022` not executed here — operator must apply and confirm the UNIQUE constraints.
2. Per-fuel ROB: schema has no per-fuel ROB column; the engine refuses rather than fabricates. Future migration should add per-fuel ROB fields.
3. Banking/borrowing/pooling: deferred to REQUIRES_REVIEW until a persistent, double-spend-protected ledger exists.

## N. Recommendations for MRV hand-off
Apply `0022` on the live DB and verify both unique indexes exist and any legacy duplicates are resolved; treat REQUIRES_REVIEW / INSUFFICIENT_FUEL_TYPE_DATA / UNKNOWN_FUEL_TYPE states as operator-review gates before official reporting.

## O. Verdict
🟢 **GREEN** — all six Part 3.5 defects are fixed (or safely, honestly deferred) with full regression GREEN and typecheck clean (9 pre-existing only). No fabricated certainty is emitted anywhere in the FuelEU path. Pending only: executing migration `0022` against the live database.
