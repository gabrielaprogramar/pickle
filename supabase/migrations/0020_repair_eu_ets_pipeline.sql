-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 2.1: Repair EU ETS end-to-end pipeline
-- Migration: 0020_repair_eu_ets_pipeline
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   A deep adversarial audit (Part 2.1) returned RED: although the EU ETS
--   compliance state machine is correct, the PRODUCTION PIPELINE was not
--   populated/wired end-to-end. Specifically:
--
--     1. `eu_ets_records.covered_co2_tonnes` / `eua_obligation_tonnes` were
--        NOT NULL DEFAULT 0, so "UNKNOWN" was coerced to a precise 0 at the
--        persistence boundary. This migration makes them NULLABLE so an
--        unresolved obligation is stored as NULL (true unknown), not 0.
--
--     2. `regulatory_rules` had NO seed data, so a fresh database had zero
--        rules and the engine degraded to hardcoded/threshold behaviour. This
--        migration SEEDS the EU ETS rules deterministically (versioned,
--        effective-dated, with source references) so a fresh DB is bootstrap.
--
--   Security: consistent with the rest of the schema, RLS stays deny-by-default
--   and the app writes via the service role. No policies are created.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. EU ETS RECORDS — make unresolved obligation/covered emissions NULLABLE
-- ────────────────────────────────────────────────────────────────────────────
-- UNKNOWN must remain UNKNOWN (NULL), never coerced to a precise 0.
ALTER TABLE eu_ets_records
    ALTER COLUMN covered_co2_tonnes DROP NOT NULL,
    ALTER COLUMN covered_co2_tonnes DROP DEFAULT,
    ALTER COLUMN eua_obligation_tonnes DROP NOT NULL,
    ALTER COLUMN eua_obligation_tonnes DROP DEFAULT;

COMMENT ON COLUMN eu_ets_records.covered_co2_tonnes IS
  'CO2 covered by EU ETS after voyage coverage factors applied. NULL when unresolved (not 0).';
COMMENT ON COLUMN eu_ets_records.eua_obligation_tonnes IS
  'EUA obligation = covered_co2 x coverage_rate. NULL when unresolved (not 0).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. REGULATORY RULE SEED — EU ETS scope + coverage (deterministic bootstrap)
-- ────────────────────────────────────────────────────────────────────────────
-- EU ETS surrender scope: applicable_gt_min = 5000, no exemptions configured.
-- The applicability service reads this rule (see src/lib/regulatory/applicability.ts).
INSERT INTO regulatory_rules (
    regulation, rule_key, version, effective_from, effective_until, is_active,
    parameters, rule_text, source_reference
)
SELECT * FROM (VALUES
    (
        'EU_ETS', 'ets_scope', 1, DATE '2024-01-01', NULL::date, TRUE,
        '{"applicable_gt_min": 5000, "flag_exemptions": [], "vessel_type_exemptions": []}'::jsonb,
        'EU ETS Directive 2003/87/EC as amended by Directive (EU) 2023/959 — shipping surrender obligation applies to vessels of 5000 GT and above upon EU/EEA port calls.',
        'Directive (EU) 2023/959; Regulation (EU) 2015/757 as amended'
    ),
    (
        'EU_ETS', 'ets_coverage', 1, DATE '2024-01-01', DATE '2024-12-31', TRUE,
        '{"rate": 0.40, "year": 2024}'::jsonb,
        'EU ETS maritime phase-in for 2024: 40% of verified emissions covered.',
        'Directive (EU) 2023/959 Article 3ga — 2024 phase-in (40%)'
    ),
    (
        'EU_ETS', 'ets_coverage', 2, DATE '2025-01-01', DATE '2025-12-31', TRUE,
        '{"rate": 0.70, "year": 2025}'::jsonb,
        'EU ETS maritime phase-in for 2025: 70% of verified emissions covered.',
        'Directive (EU) 2023/959 Article 3ga — 2025 phase-in (70%)'
    ),
    (
        'EU_ETS', 'ets_coverage', 3, DATE '2026-01-01', NULL::date, TRUE,
        '{"rate": 1.00, "year": 2026}'::jsonb,
        'EU ETS maritime phase-in for 2026 onwards: 100% of verified emissions covered.',
        'Directive (EU) 2023/959 Article 3ga — 2026+ full (100%)'
    )
) AS seed(regulation, rule_key, version, effective_from, effective_until, is_active, parameters, rule_text, source_reference)
WHERE NOT EXISTS (
    SELECT 1 FROM regulatory_rules r
    WHERE r.regulation = seed.regulation
      AND r.rule_key = seed.rule_key
      AND r.version = seed.version
);
