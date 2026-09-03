-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 3: Make FuelEU Maritime a real end-to-end, scope-aware
-- regulatory module wired to the Part 1 foundation
-- Migration: 0021_repair_fueleu_pipeline
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   The Part 3 adversarial audit of `src/lib/fueleu` found the SAME class of
--   production-pipeline gap that Part 2.1 found for EU ETS, but in the FuelEU
--   engine:
--
--     1. `fuel_eu_records` numeric aggregates were NOT NULL DEFAULT 0, so an
--        UNKNOWN / unresolved intensity, target or balance was coerced to a
--        precise 0 at the persistence boundary. This migration makes the
--        energy / WtW / intensity / target / balance / OPS columns NULLABLE so
--        TRUE UNKNOWN is stored as NULL (never a fabricated 0). The compliance
--        SIGN is kept as a separate nullable column so "no resolved balance" is
--        distinct from a real surplus/deficit.
--
--     2. `regulatory_rules` had NO FuelEU seed data. The classic engine carried
--        hardcoded literals (baseline 91.16, per-year reduction targets, penalty
--        params) — exactly the "hidden duplicated literals" the objective
--        forbids. This migration SEEDS the versioned, effective-dated FuelEU
--        rules (scope, baseline, targets, penalty) so a fresh DB is bootstrapped
--        and the engine reads PARAMETERS FROM RULES, never from compiled-in
--        year-schedules.
--
--     3. The seeded values that are legal/regulatory and require independent
--        verification are explicitly marked "REQUIRES REGULATORY VERIFICATION" so
--        no one mistakes a research-derived number for an authoritative citation.
--
--   Security: consistent with the whole schema, RLS stays deny-by-default and
--   the app writes via the service role. No policies are created.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. FUEL EU RECORDS — make unresolved aggregates NULLABLE (UNKNOWN → NULL)
-- ────────────────────────────────────────────────────────────────────────────
-- UNKNOWN must remain UNKNOWN (NULL), never coerced to a precise 0.
ALTER TABLE fuel_eu_records
    ALTER COLUMN energy_input_mj            DROP NOT NULL,
    ALTER COLUMN energy_input_mj            DROP DEFAULT,
    ALTER COLUMN total_wtw_emissions_gco2e  DROP NOT NULL,
    ALTER COLUMN total_wtw_emissions_gco2e  DROP DEFAULT,
    ALTER COLUMN ghg_intensity_gco2e_per_mj DROP NOT NULL,
    ALTER COLUMN ghg_intensity_gco2e_per_mj DROP DEFAULT,
    ALTER COLUMN target_gco2e_per_mj        DROP NOT NULL,
    ALTER COLUMN target_gco2e_per_mj        DROP DEFAULT,
    ALTER COLUMN compliance_balance         DROP NOT NULL,
    ALTER COLUMN compliance_balance         DROP DEFAULT,
    ALTER COLUMN surplus_or_deficit         DROP NOT NULL,
    ALTER COLUMN surplus_or_deficit         DROP DEFAULT,
    ALTER COLUMN biofuel_energy_mj          DROP NOT NULL,
    ALTER COLUMN biofuel_energy_mj          DROP DEFAULT,
    ALTER COLUMN fossil_energy_mj           DROP NOT NULL,
    ALTER COLUMN fossil_energy_mj           DROP DEFAULT,
    ALTER COLUMN ops_energy_mj              DROP NOT NULL,
    ALTER COLUMN ops_energy_mj              DROP DEFAULT;

-- The sign classification stays constrained when present (NULL = unresolved).
ALTER TABLE fuel_eu_records
    DROP CONSTRAINT IF EXISTS fuel_eu_records_surplus_or_deficit_check,
    ADD CONSTRAINT fuel_eu_records_surplus_or_deficit_check
        CHECK (surplus_or_deficit IS NULL OR surplus_or_deficit IN ('surplus', 'zero', 'deficit'));

COMMENT ON COLUMN fuel_eu_records.energy_input_mj            IS 'Total in-scope energy input in MJ. NULL when unresolved (not 0).';
COMMENT ON COLUMN fuel_eu_records.total_wtw_emissions_gco2e  IS 'Total well-to-wake GHG emissions in gCO₂eq. NULL when unresolved (not 0).';
COMMENT ON COLUMN fuel_eu_records.ghg_intensity_gco2e_per_mj IS 'Energy-weighted annual GHG intensity. NULL when unresolved (not 0).';
COMMENT ON COLUMN fuel_eu_records.target_gco2e_per_mj        IS 'FuelEU target for the reporting year (from versioned rule). NULL when unresolved (not 0).';
COMMENT ON COLUMN fuel_eu_records.compliance_balance         IS 'target - actual. Positive = surplus, negative = deficit. NULL when unresolved (not 0).';
COMMENT ON COLUMN fuel_eu_records.surplus_or_deficit         IS 'Classification of the compliance balance sign. NULL when unresolved (not coerced).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. REGULATORY RULE SEED — FuelEU Maritime (deterministic bootstrap)
-- ────────────────────────────────────────────────────────────────────────────
-- The engine reads ALL of these versioned, effective-dated rules via the shared
-- `regulatory_rules` store (see src/lib/regulatory/applicability.ts + the
-- FuelEU pipeline). None of these figures are hardcoded in the engine.
--
-- NOTE ON VALUES: the baseline / target / penalty numbers below are the classic
-- research-derived values. Directive (EU) 2023/1805 ("FuelEU Maritime") is the
-- legal basis; the exact verification of each figure MUST be confirmed against
-- the final published annex values before it is treated as authoritative. Hence
-- the explicit "REQUIRES REGULATORY VERIFICATION" markers.

INSERT INTO regulatory_rules (
    regulation, rule_key, version, effective_from, effective_until, is_active,
    parameters, rule_text, source_reference
)
SELECT * FROM (VALUES
    -- Scope: FuelEU Maritime applies to vessels of 5000 GT and above.
    (
        'FUEL_EU', 'fueleu_scope', 1, DATE '2024-01-01', NULL::date, TRUE,
        '{"applicable_gt_min": 5000}'::jsonb,
        'FuelEU Maritime applies to ships of 5000 GT and above calling at EU/EEA ports.',
        'Regulation (EU) 2023/1805 (FuelEU Maritime) — scope'
    ),
    -- Baseline: 91.16 gCO2e/MJ (WtW). REQUIRES REGULATORY VERIFICATION.
    (
        'FUEL_EU', 'fueleu_baseline', 1, DATE '2024-01-01', NULL::date, TRUE,
        '{"baseline_ghg_intensity_gco2e_per_mj": 91.16, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        'FuelEU Maritime reference (fleet-average) well-to-wake GHG intensity used as the baseline for reduction targets.',
        'FuelEU Maritime — 2025 reference value (REQUIRES REGULATORY VERIFICATION)'
    ),
    -- Targets: reduction (as a fraction of baseline) per compliance period.
    (
        'FUEL_EU', 'fueleu_target', 1, DATE '2024-01-01', DATE '2029-12-31', TRUE,
        '{"year_from": 2025, "year_until": 2029, "reduction_pct": 0.02, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2025-2029 compliance period: 2% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2025-2029 target (REQUIRES REGULATORY VERIFICATION)'
    ),
    (
        'FUEL_EU', 'fueleu_target', 2, DATE '2030-01-01', DATE '2034-12-31', TRUE,
        '{"year_from": 2030, "year_until": 2034, "reduction_pct": 0.06, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2030-2034 compliance period: 6% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2030-2034 target (REQUIRES REGULATORY VERIFICATION)'
    ),
    (
        'FUEL_EU', 'fueleu_target', 3, DATE '2035-01-01', DATE '2039-12-31', TRUE,
        '{"year_from": 2035, "year_until": 2039, "reduction_pct": 0.15, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2035-2039 compliance period: 15% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2035-2039 target (REQUIRES REGULATORY VERIFICATION)'
    ),
    (
        'FUEL_EU', 'fueleu_target', 4, DATE '2040-01-01', DATE '2044-12-31', TRUE,
        '{"year_from": 2040, "year_until": 2044, "reduction_pct": 0.31, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2040-2044 compliance period: 31% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2040-2044 target (REQUIRES REGULATORY VERIFICATION)'
    ),
    (
        'FUEL_EU', 'fueleu_target', 5, DATE '2045-01-01', DATE '2049-12-31', TRUE,
        '{"year_from": 2045, "year_until": 2049, "reduction_pct": 0.62, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2045-2049 compliance period: 62% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2045-2049 target (REQUIRES REGULATORY VERIFICATION)'
    ),
    (
        'FUEL_EU', 'fueleu_target', 6, DATE '2050-01-01', NULL::date, TRUE,
        '{"year_from": 2050, "year_until": null, "reduction_pct": 0.80, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        '2050+ compliance period: 80% reduction relative to baseline.',
        'Regulation (EU) 2023/1805 Annex — 2050+ target (REQUIRES REGULATORY VERIFICATION)'
    ),
    -- Penalty: applies to a deficit, per tonne of VLSFO-equivalent.
    (
        'FUEL_EU', 'fueleu_penalty', 1, DATE '2024-01-01', NULL::date, TRUE,
        '{"penalty_eur_per_tonne_vlsfoe": 2400, "vlsfo_emission_factor_gco2e_per_mj": 87.5, "vlsfo_energy_mj_per_tonne": 40500, "is_estimate": true, "verification": "REQUIRES REGULATORY VERIFICATION"}'::jsonb,
        'FuelEU Maritime penalty for a deficit, expressed per tonne of VLSFO-equivalent shortfall. Presented as an ESTIMATE until a formal assessment exists.',
        'Regulation (EU) 2023/1805 Article 20 — penalty (REQUIRES REGULATORY VERIFICATION)'
    )
) AS seed(regulation, rule_key, version, effective_from, effective_until, is_active, parameters, rule_text, source_reference)
WHERE NOT EXISTS (
    SELECT 1 FROM regulatory_rules r
    WHERE r.regulation = seed.regulation
      AND r.rule_key = seed.rule_key
      AND r.version = seed.version
);
