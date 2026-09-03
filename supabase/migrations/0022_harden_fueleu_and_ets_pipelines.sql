-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 3.6: Harden FuelEU + shared consumption correctness
-- Migration: 0022_harden_fueleu_and_ets_pipelines
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   The Part 3.5 adversarial audit (YELLOW) found concrete defects:
--
--     1. CRITICAL — `onConflict: "vessel_id, reporting_year"` is used by both
--        the FuelEU and EU ETS record repositories, but their DB tables only had
--        a NON-UNIQUE index on those columns. PostgREST requires a real UNIQUE /
--        exclusion constraint to back ON CONFLICT, so both production upserts
--        would fail against a real PostgreSQL. This migration adds the missing
--        UNIQUE constraints that reflect the intended data model (one annual
--        compliance record per vessel per regulation).
--
--     2. The canonical consumption model gained a new first-class outcome:
--        when a noon report gives only a TOTAL `fuel_consumption_tonnes` with no
--        defensible per-fuel split, the engine must NOT invent one. It returns
--        `INSUFFICIENT_FUEL_TYPE_DATA` (status REVIEW) instead of fabricating a
--        plausible per-fuel number. This migration extends the `method` CHECK to
--        admit that value.
--
--   Determinism: creating the UNIQUE index fails loudly if duplicate
--   (vessel_id, reporting_year) rows already exist, rather than silently
--   coalescing conflicting compliance records. Run on a clean/verified DB.
--
--   Security: consistent with the rest of the schema, RLS stays deny-by-default
--   and the app writes via the service role. No policies are created.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. UNIQUE FUEL EU RECORD per (vessel, reporting_year)
-- ────────────────────────────────────────────────────────────────────────────
-- The repository upserts with `onConflict: "vessel_id, reporting_year"`, which
-- requires a matching UNIQUE constraint. Replace the old non-unique index with a
-- UNIQUE index (a UNIQUE index is also a usable b-tree index for lookups).
DROP INDEX IF EXISTS idx_fuel_eu_vessel_year;
CREATE UNIQUE INDEX IF NOT EXISTS fuel_eu_records_vessel_year_uniq
    ON fuel_eu_records (vessel_id, reporting_year);

COMMENT ON INDEX fuel_eu_records_vessel_year_uniq IS
  'Enforces one FuelEU compliance record per vessel per reporting year (backs ON CONFLICT upsert).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. UNIQUE EU ETS RECORD per (vessel, reporting_year)
-- ────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_eu_ets_vessel_year;
CREATE UNIQUE INDEX IF NOT EXISTS eu_ets_records_vessel_year_uniq
    ON eu_ets_records (vessel_id, reporting_year);

COMMENT ON INDEX eu_ets_records_vessel_year_uniq IS
  'Enforces one EU ETS compliance record per vessel per reporting year (backs ON CONFLICT upsert).';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. CONDITION `method=INSUFFICIENT_FUEL_TYPE_DATA` for canonical consumption
-- ────────────────────────────────────────────────────────────────────────────
-- A noon report may expose a TOTAL consumption with no defensible per-fuel
-- split. The shared attribution layer now reports that as its own first-class
-- method (status REVIEW, quantity 0) rather than silently assigning the total
-- to every fuel type. Extend the allowed-method CHECK accordingly.
ALTER TABLE voyage_consumption
    DROP CONSTRAINT IF EXISTS voyage_consumption_method_value,
    ADD CONSTRAINT voyage_consumption_method_value CHECK (
        method IN (
            'NOON_REPORT_INTERVAL', 'ROB_DELTA', 'BDN_TO_VOYAGE',
            'INSUFFICIENT_DATA', 'CONFLICT_DELTA', 'ESTIMATED_MANUAL',
            'INSUFFICIENT_FUEL_TYPE_DATA', 'UNKNOWN_FUEL_TYPE'
        )
    );
