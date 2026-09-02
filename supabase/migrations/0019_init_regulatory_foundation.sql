-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 1: Regulatory Foundation
-- Migration: 0019_init_regulatory_foundation
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Part 1 removes the three foundational blockers identified in the audit:
--
--     1. VESSEL MODEL  — vessels previously carried ONLY gross_tonnage. There
--        was no flag / vessel type / category, so regulatory scope could not be
--        determined except by GT. Adds flag, vessel_type, vessel_category.
--
--     2. APPLICABILITY — EU ETS scope was GT-only (>=5000); FuelEU had NO gate
--        at all; both hardcoded rules in the engines. Part 1 introduces a
--        centralised, versioned, effective-dated RULE STORE (regulatory_rules)
--        and a per-vessel determination table (regulation_applicability) with
--        first-class UNKNOWN / REQUIRES_REVIEW outcomes. Engines no longer own
--        scope logic.
--
--     3. CONSUMPTION   — MRV consumed an equal-share allocation placeholder.
--        Part 1 adds ONE canonical per-voyage consumption model
--        (voyage_consumption) that attributes fuel to a voyage from observed
--        source records (Noon Report intervals, ROB deltas, BDN deliveries)
--        with full source traceability, and NEVER silently falls back to
--        equal-share allocation.
--
--   Migration is ADDITIVE: every existing vessel row remains valid (all new
--   columns are nullable), so 0001-0018 data is untouched.
--
--   Security: consistent with the whole schema, RLS is enabled and NO policies
--   are created (deny-by-default, service-role only). The Next.js app writes
--   via the service role which bypasses RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. VESSEL MODEL — flag / vessel_type / vessel_category
-- ────────────────────────────────────────────────────────────────────────────
-- All ADDITIVE and nullable so existing rows stay valid.
ALTER TABLE vessels
    ADD COLUMN IF NOT EXISTS flag text,
    ADD COLUMN IF NOT EXISTS vessel_type text,
    ADD COLUMN IF NOT EXISTS vessel_category text;

ALTER TABLE vessels
    ADD CONSTRAINT vessels_flag_format CHECK (flag IS NULL OR flag ~ '^[A-Z]{2,3}$');

ALTER TABLE vessels
    ADD CONSTRAINT vessels_vessel_type_value CHECK (
        vessel_type IS NULL OR vessel_type IN (
            'cargo', 'tanker', 'container', 'passenger', 'roro', 'offshore',
            'tug', 'fishing', 'pleasure', 'other', 'unknown'
        )
    );

ALTER TABLE vessels
    ADD CONSTRAINT vessels_vessel_category_value CHECK (
        vessel_category IS NULL OR vessel_category IN (
            'commercial', 'private', 'fishing', 'other', 'unknown'
        )
    );

CREATE INDEX IF NOT EXISTS vessels_flag_idx ON vessels (flag) WHERE flag IS NOT NULL;
CREATE INDEX IF NOT EXISTS vessels_vessel_type_idx ON vessels (vessel_type) WHERE vessel_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS vessels_vessel_category_idx ON vessels (vessel_category) WHERE vessel_category IS NOT NULL;

COMMENT ON COLUMN vessels.flag IS 'Vessel flag state, ISO 3166-1 alpha-2/3 uppercase (e.g. PAN). Null when unknown.';
COMMENT ON COLUMN vessels.vessel_type IS 'Ship type classification (cargo/tanker/container/...). Null when unknown.';
COMMENT ON COLUMN vessels.vessel_category IS 'Regulatory-relevant category (commercial/private/fishing/other/unknown).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. REGULATORY RULES — centralised, versioned, effective-dated rule store
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regulatory_rules (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    regulation       text        NOT NULL,
    rule_key         text        NOT NULL,
    version          integer     NOT NULL DEFAULT 1,
    effective_from   date        NOT NULL,
    effective_until  date,
    is_active        boolean     NOT NULL DEFAULT true,

    -- Structured, machine-readable rule conditions/parameters. The engines and
    -- the applicability service read THIS, never a hardcoded GT threshold.
    parameters       jsonb       NOT NULL DEFAULT '{}'::jsonb,

    -- Human-readable rule body + source citation for audit.
    rule_text        text,
    source_reference text,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT regulatory_rules_unique_version
        UNIQUE (regulation, rule_key, version),
    CONSTRAINT regulatory_rules_effective_order CHECK (
        effective_until IS NULL OR effective_from <= effective_until
    ),
    CONSTRAINT regulatory_rules_rule_key_nonempty CHECK (length(trim(rule_key)) > 0),
    CONSTRAINT regulatory_rules_regulation_nonempty CHECK (length(trim(regulation)) > 0)
);

CREATE INDEX IF NOT EXISTS regulatory_rules_active_idx
    ON regulatory_rules (regulation, is_active, effective_from);
CREATE INDEX IF NOT EXISTS regulatory_rules_effective_idx
    ON regulatory_rules (regulation, effective_from, effective_until);

COMMENT ON TABLE regulatory_rules IS
  'Centralised, versioned, effective-dated regulatory rule definitions. Engines/applicability read rules from here rather than hardcoding thresholds.';
COMMENT ON COLUMN regulatory_rules.regulation IS 'Regulation code (EU_ETS, FUEL_EU, EU_MRV, ...).';
COMMENT ON COLUMN regulatory_rules.rule_key IS 'Logical rule identifier within a regulation (e.g. ets_scope_gt_threshold).';
COMMENT ON COLUMN regulatory_rules.version IS 'Monotonic rule version; higher versions supersede lower ones.';
COMMENT ON COLUMN regulatory_rules.effective_from IS 'First date this rule version governs.';
COMMENT ON COLUMN regulatory_rules.effective_until IS 'Last date this rule version governs (null = open-ended).';
COMMENT ON COLUMN regulatory_rules.parameters IS 'Structured rule parameters read by the engines/applicability service.';
COMMENT ON COLUMN regulatory_rules.source_reference IS 'Citation to the source of the rule (research doc, regulation article).';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. REGULATION APPLICABILITY — per-vessel, effective-date-aware determination
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regulation_applicability (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id        uuid        NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    regulation       text        NOT NULL,
    reporting_year   integer     NOT NULL CHECK (reporting_year >= 2024),

    applicability    text        NOT NULL,
    is_decision_final boolean    NOT NULL DEFAULT false,
    rule_version     integer     NOT NULL,
    rule_effective_from date     NOT NULL,
    rule_effective_until date,

    -- Snapshot of the vessel facts + rule params used, so the determination is
    -- reproducible and auditable even if the vessel/rule later changes.
    basis            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    notes            text,

    decided_at       timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT regulation_applicability_unique
        UNIQUE (vessel_id, regulation, reporting_year),
    CONSTRAINT regulation_applicability_value CHECK (
        applicability IN ('APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN', 'REQUIRES_REVIEW')
    ),
    CONSTRAINT regulation_applicability_regulation_nonempty
        CHECK (length(trim(regulation)) > 0)
);

CREATE INDEX IF NOT EXISTS regulation_applicability_vessel_idx
    ON regulation_applicability (vessel_id, reporting_year);
CREATE INDEX IF NOT EXISTS regulation_applicability_regulation_idx
    ON regulation_applicability (regulation, reporting_year);

COMMENT ON TABLE regulation_applicability IS
  'Per-vessel, per-regulation, per-year applicability determination, resolved from the effective-dated regulatory_rules store. UNKNOWN/REQUIRES_REVIEW are first-class outcomes; never silently assumed.';
COMMENT ON COLUMN regulation_applicability.applicability IS
  'APPLICABLE / NOT_APPLICABLE / UNKNOWN (insufficient data) / REQUIRES_REVIEW (conflicting or judgement-dependent).';
COMMENT ON COLUMN regulation_applicability.rule_version IS 'Version of the rule that produced this determination.';
COMMENT ON COLUMN regulation_applicability.basis IS 'Snapshot of vessel facts + rule params used, for auditability.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. VOYAGE CONSUMPTION — canonical per-voyage fuel consumption model
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_consumption (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id        uuid        NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    -- Nullable: a consumption record may describe a time window that is not yet
    -- bound to a voyage row (e.g. between-voyage sailing) or a partially known leg.
    voyage_id        uuid        REFERENCES voyages(id) ON DELETE CASCADE,
    reporting_year   integer     NOT NULL CHECK (reporting_year >= 2024),
    fuel_type        text        NOT NULL,

    quantity_mt      numeric(14,4) NOT NULL,
    method           text        NOT NULL,
    confidence       text        NOT NULL,
    status           text        NOT NULL,

    -- Which source record(s) this consumption was derived from, and how.
    source_type      text        NOT NULL,
    source_record_ids jsonb      NOT NULL DEFAULT '[]'::jsonb,
    attribution_method text      NOT NULL,
    traceability     jsonb       NOT NULL DEFAULT '{}'::jsonb,

    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT voyage_consumption_method_value CHECK (
        method IN (
            'NOON_REPORT_INTERVAL', 'ROB_DELTA', 'BDN_TO_VOYAGE',
            'INSUFFICIENT_DATA', 'CONFLICT_DELTA', 'ESTIMATED_MANUAL'
        )
    ),
    CONSTRAINT voyage_consumption_confidence_value CHECK (
        confidence IN ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')
    ),
    CONSTRAINT voyage_consumption_status_value CHECK (
        status IN ('PENDING', 'VERIFIED', 'REVIEW', 'BLOCKED')
    ),
    CONSTRAINT voyage_consumption_quantity_nonneg CHECK (quantity_mt >= 0),
    CONSTRAINT voyage_consumption_source_type_nonempty
        CHECK (length(trim(source_type)) > 0),
    CONSTRAINT voyage_consumption_method_no_equal_share CHECK (
        method <> 'EQUAL_SHARE'
    )
);

-- One canonical consumption per (vessel, voyage, fuel). A later, better-method
-- row upserts/replaces the earlier one; equal-share placeholder is forbidden.
CREATE UNIQUE INDEX IF NOT EXISTS voyage_consumption_voyage_fuel_uniq
    ON voyage_consumption (vessel_id, voyage_id, fuel_type)
    WHERE voyage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS voyage_consumption_vessel_year_idx
    ON voyage_consumption (vessel_id, reporting_year);
CREATE INDEX IF NOT EXISTS voyage_consumption_source_idx
    ON voyage_consumption (source_type);

COMMENT ON TABLE voyage_consumption IS
  'Single canonical per-voyage fuel consumption model, attributed to voyages from observed source records (noon-report intervals, ROB deltas, BDN deliveries) with full source traceability. NEVER falls back to equal-share allocation.';
COMMENT ON COLUMN voyage_consumption.method IS
  'How quantity was derived. EQUAL_SHARE is explicitly forbidden by CHECK.';
COMMENT ON COLUMN voyage_consumption.source_type IS 'Source table the consumption derives from (noon_reports, fuel_deliveries, fuel_robs, ...).';
COMMENT ON COLUMN voyage_consumption.source_record_ids IS 'IDs of the source rows this consumption is traced to.';
COMMENT ON COLUMN voyage_consumption.traceability IS 'Audit envelope: window dates, delta basis, reconciliation refs, attribution summary.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (deny-by-default, service-role only)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE regulatory_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_applicability ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyage_consumption       ENABLE ROW LEVEL SECURITY;

-- No policies are created: consistent with the rest of the schema, RLS is
-- deny-by-default and the app writes via the service role (bypasses RLS).
-- When Supabase Auth is adopted, add org-scoped policies here.
