-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 4: EU MRV + THETIS-MRV reporting backbone
--   A formal reporting/evidence layer built on the SAME shared operational
--   truth as EU ETS and FuelEU (canonical voyage_consumption, shared
--   applicability, shared factors, immutable audit log).
-- Migration: 0023_init_mrv_reporting_backbone
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   The Part 3.6 + Part 4 deep inspection of `src/lib/mrv` found the EU MRV
--   reporting module had NOT yet been upgraded to the formal backbone:
--
--     1. It performed EQUAL-SHARE allocation (total deliveries / voyage count)
--        instead of consuming the canonical `voyage_consumption` model — the
--        exact defect the Part 1 foundation forbids.
--     2. There was NO first-class Monitoring Plan domain model. The only trace
--        was a free-text `monitoring_plan_version TEXT` column on `mrv_reports`,
--        with no versioned plan entity, no statuses, no deterministic
--        active-plan resolution.
--     3. There was NO revision/amendment history for an annual report. A report
--        was a single row upserted in place keyed by (vessel_id, reporting_year),
--        destroying prior content on revision.
--     4. `regulatory_rules` had NO `EU_MRV` seed, so the shared applicability
--        layer could never resolve MRV scope for a vessel.
--
--   This migration lays the minimal clean reporting model:
--     • `mrv_monitoring_plans`  — versioned, statused monitoring plan entities
--       per vessel (deterministic active-plan resolution happens in code).
--     • `mrv_report_versions`   — append-only revision/amendment trail for an
--       annual MRV report. Each revision is immutable once recorded; a new
--       revision supersedes, never overwrites, history.
--     • `mrv_reports`           — kept as the annual report HEAD (the current
--       version/status). A new `lifecycle` column carries the explicit state
--       machine; the old numeric aggregates stay for backwards compatibility.
--     • `EU_MRV/mrv_scope`      — seeded so the SHARED applicability layer
--       (deterministic rule lookup) can resolve MRV scope like EU_ETS/FUEL_EU.
--
--   Security: consistent with the whole schema, RLS stays deny-by-default and
--   the app writes via the service role. No policies are created.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. FIRST-CLASS MONITORING PLAN DOMAIN MODEL
-- ────────────────────────────────────────────────────────────────────────────
-- A ship-specific, versioned monitoring plan documenting (Art. 6, Reg.
-- (EU) 2015/757) the method(s) chosen to monitor fuel consumption and compute
-- GHG emissions, plus the procedures for activity data (distance, transport
-- work, time at sea) and data-gap handling. Statuses mirror the THETIS-MRV
-- workflow: Draft → Submitted to Verifier → Submitted to AA → Approved /
-- Under Revision; a later approved plan SUPERSEDES an earlier one.
CREATE TABLE IF NOT EXISTS mrv_monitoring_plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id               UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    version                 INTEGER NOT NULL CHECK (version >= 1),

    -- THETIS-MRV workflow status (see EMSA FAQ; also Art. 6(5) Reg. 2015/757).
    status                  TEXT NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN (
                                'DRAFT',
                                'UNDER_REVISION',
                                'SUBMITTED_TO_VERIFIER',
                                'SUBMITTED_TO_AA',
                                'APPROVED',
                                'SUPERSEDED'
                            )),

    -- Methodology / method selection per emission source.
    methodology             TEXT NOT NULL DEFAULT 'default'
                            CHECK (methodology IN ('default', 'alternative')),

    -- Chosen monitoring method category (Annex I, Implementing Reg. 2023/2449).
    -- 'A' BDN + periodic stocktakes; 'B' bunker tank monitoring; 'C' flow
    -- meters; 'D' direct measurement; NULL = not yet declared.
    monitoring_method       TEXT CHECK (monitoring_method IN ('A', 'B', 'C', 'D')),

    effective_from          DATE,
    effective_until         DATE,

    -- Snapshot of the approved content decisions that drive a reporting run.
    -- Kept as JSONB so the schema stays stable regardless of template changes.
    emission_factors_snapshot JSONB NOT NULL DEFAULT '{}',
    activity_data_procedures  JSONB NOT NULL DEFAULT '{}',
    data_gap_methods          JSONB NOT NULL DEFAULT '{}',

    source_reference        TEXT,
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mrv_mp_vessel_version
    ON mrv_monitoring_plans (vessel_id, version);
ALTER TABLE mrv_monitoring_plans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  mrv_monitoring_plans               IS 'Versioned, statused EU MRV monitoring plan entities per vessel (Art. 6 Reg. 2015/757; template Annex I Implementing Reg. 2023/2449).';
COMMENT ON COLUMN mrv_monitoring_plans.version       IS 'Plan version; unique per vessel. Active resolution is deterministic in code (ambiguous overlap → REQUIRES_REVIEW).';
COMMENT ON COLUMN mrv_monitoring_plans.status        IS 'THETIS-MRV workflow status (DRAFT/UNDER_REVISION/SUBMITTED_TO_VERIFIER/SUBMITTED_TO_AA/APPROVED/SUPERSEDED).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. REPORT REVISION / AMENDMENT HISTORY
-- ────────────────────────────────────────────────────────────────────────────
-- Append-only version trail for the annual emissions report (Annex II,
-- Implementing Reg. 2023/2449). A report can be revised (correcting an error
-- before/after submission) or amended; each revision is recorded as a NEW row
-- in this table keyed by (mrv_report_id, version_number). The annual HEAD
-- remains in `mrv_reports`, but its numbers are ALWAYS mirrored from the
-- current verified revision here so prior revisions are never destroyed.
CREATE TABLE IF NOT EXISTS mrv_report_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrv_report_id           UUID NOT NULL REFERENCES mrv_reports(id) ON DELETE CASCADE,
    version_number          INTEGER NOT NULL CHECK (version_number >= 1),

    -- When this revision is the one used for external submission.
    submission_status       TEXT NOT NULL DEFAULT 'DRAFT'
                            CHECK (submission_status IN (
                                'DRAFT',
                                'SCHEMA_VALIDATED_LOCALLY',
                                'VERIFIED',
                                'SUBMITTED',
                                'SUPERSEDED'
                            )),

    calculation_version     TEXT NOT NULL,
    parameter_version       TEXT NOT NULL,
    monitoring_plan_version INTEGER,

    -- Monitored period (Art. 10 Reg. 2015/757: reporting period = calendar year;
    -- cross-year activity is partitioned into justified partial periods).
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,

    -- FUEL CONSUMPTION AND GHG EMITTED (Annex II Part D)
    total_fuel_mt           NUMERIC(14,4) NOT NULL DEFAULT 0,
    fuel_by_type            JSONB NOT NULL DEFAULT '{}',
    co2_tonnes              NUMERIC(14,4) NOT NULL DEFAULT 0,
    ch4_co2e_tonnes         NUMERIC(14,4) NOT NULL DEFAULT 0,
    n2o_co2e_tonnes         NUMERIC(14,4) NOT NULL DEFAULT 0,
    total_co2e_tonnes       NUMERIC(14,4) NOT NULL DEFAULT 0,

    -- DISTANCE TRAVELLED, TIME SPENT AT SEA AND TRANSPORT WORK (Annex II Part D)
    total_distance_nm       NUMERIC(14,4),
    total_time_at_sea_hours NUMERIC(14,4),

    -- Provenance of the figures (source of truth references).
    source_consumption_ids  JSONB NOT NULL DEFAULT '[]',
    source_voyage_ids       JSONB NOT NULL DEFAULT '[]',
    traceability            JSONB NOT NULL DEFAULT '{}',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mrv_report_versions_report_ver
    ON mrv_report_versions (mrv_report_id, version_number);
ALTER TABLE mrv_report_versions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  mrv_report_versions             IS 'Append-only revision/amendment trail for an annual EU MRV report (Annex II Implementing Reg. 2023/2449).';
COMMENT ON COLUMN mrv_report_versions.version_number IS 'Revision number. Each revision is immutable; a new revision supersedes the prior one.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. mrv_reports — lifecycle + monitored period
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE mrv_reports
    DROP CONSTRAINT IF EXISTS mrv_reports_status_check,
    ADD CONSTRAINT mrv_reports_status_check
        CHECK (status IN (
            'blocked',
            'draft',
            'validated',
            'verified',
            'exported',
            'superseded'
        ));

-- Explicit lifecycle state machine (see src/lib/mrv/lifecycle.ts):
--   DRAFT -> VALIDATED -> VERIFIED -> EXPORTED (and revisions return a report
--   to an earlier state; SUPERSEDED is terminal for a revision). UNKNOWN grants
--   no forward transition without evidence (DATA_INCOMPLETE cannot jump to
--   VERIFIED, UNKNOWN cannot jump to EXPORTED).
ALTER TABLE mrv_reports
    ADD COLUMN IF NOT EXISTS lifecycle TEXT
        CHECK (lifecycle IN (
            'DATA_INCOMPLETE',
            'DRAFT',
            'VALIDATED',
            'REQUIRES_REVIEW',
            'SCHEMA_VALIDATED_LOCALLY',
            'VERIFIED',
            'EXPORTED',
            'SUPERSEDED'
        ));

-- Monitored period of this annual report (calendar year; occasionally a
-- justified partial period when the vessel changes company mid-year).
ALTER TABLE mrv_reports
    ADD COLUMN IF NOT EXISTS period_start DATE,
    ADD COLUMN IF NOT EXISTS period_end DATE;

-- Link to the monitoring plan version that governed this report (integer
-- version, resolved deterministically at generation time). The old free-text
-- `monitoring_plan_version` column is retained for backwards compatibility.
ALTER TABLE mrv_reports
    ADD COLUMN IF NOT EXISTS monitoring_plan_ver INTEGER;

-- Aggregate distance/time per the annex (kept alongside the legacy aggregates).
ALTER TABLE mrv_reports
    ADD COLUMN IF NOT EXISTS total_distance_nm NUMERIC(14,4),
    ADD COLUMN IF NOT EXISTS total_time_at_sea_hours NUMERIC(14,4);

COMMENT ON COLUMN mrv_reports.lifecycle                 IS 'Explicit report lifecycle state machine. UNKNOWN/DATA_INCOMPLETE cannot advance to VERIFIED/EXPORTED without evidence.';
COMMENT ON COLUMN mrv_reports.monitoring_plan_ver        IS 'Integer monitoring-plan version that governed this report (deterministic active-plan resolution).';
COMMENT ON COLUMN mrv_reports.total_distance_nm          IS 'Total distance travelled in nautical miles (Annex II Part D).';
COMMENT ON COLUMN mrv_reports.total_time_at_sea_hours    IS 'Total time spent at sea in hours (Annex II Part D).';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. REGULATORY RULE SEED — EU MRV scope (deterministic bootstrap)
-- ────────────────────────────────────────────────────────────────────────────
-- Mirrors 0020 (EU_ETS) / 0021 (FUEL_EU): the MRV application layer reads
-- `EU_MRV/mrv_scope` from regulatory_rules — it is NOT hardcoded in engine code.
-- Reg. (EU) 2015/757 (as amended by 2023/957) applies to ships of 5000 GT and
-- above for voyages with a port of call under a Member State's jurisdiction.
INSERT INTO regulatory_rules (
    regulation, rule_key, version, effective_from, effective_until, is_active,
    parameters, rule_text, source_reference
)
SELECT * FROM (VALUES
    (
        'EU_MRV', 'mrv_scope', 1, DATE '2024-01-01', NULL::date, TRUE,
        '{"applicable_gt_min": 5000}'::jsonb,
        'EU MRV applies to ships of 5000 GT and above for trips to/from ports under a Member State jurisdiction (including lay time at berth).',
        'Regulation (EU) 2015/757 Art. 2, as amended by (EU) 2023/957 — scope'
    )
) AS seed(regulation, rule_key, version, effective_from, effective_until, is_active, parameters, rule_text, source_reference)
WHERE NOT EXISTS (
    SELECT 1 FROM regulatory_rules r
    WHERE r.regulation = seed.regulation
      AND r.rule_key = seed.rule_key
      AND r.version = seed.version
);
