-- 0008_init_eu_ets_and_mrv.sql
-- EU ETS compliance records + EU MRV annual report preparation.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. VESSEL GT COLUMN (needed for ETS scope determination) ───────────────────

ALTER TABLE vessels ADD COLUMN IF NOT EXISTS gross_tonnage NUMERIC(10,1);
COMMENT ON COLUMN vessels.gross_tonnage IS 'Gross tonnage (GT) for EU ETS scope determination.';

-- 2. EU ETS RECORDS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eu_ets_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  reporting_year              INTEGER NOT NULL CHECK (reporting_year >= 2024),
  calculation_version         TEXT NOT NULL,

  -- Scope
  gt                          NUMERIC(10,1),
  ets_scope                   TEXT NOT NULL CHECK (ets_scope IN ('IN_SCOPE', 'OUT_OF_SCOPE', 'UNKNOWN_DATA')),
  mrv_scope                   TEXT NOT NULL CHECK (mrv_scope IN ('IN_SCOPE', 'OUT_OF_SCOPE', 'UNKNOWN_DATA')),

  -- Emissions
  total_ttw_co2_tonnes        NUMERIC(14,4) NOT NULL DEFAULT 0,
  covered_co2_tonnes          NUMERIC(14,4) NOT NULL DEFAULT 0,

  -- Coverage phase-in
  coverage_rate               NUMERIC(5,4) NOT NULL DEFAULT 0,
  coverage_rate_version       TEXT NOT NULL,

  -- EUA obligation
  eua_obligation_tonnes       NUMERIC(14,4) NOT NULL DEFAULT 0,
  eua_price_eur               NUMERIC(10,2),
  eua_price_available         BOOLEAN NOT NULL DEFAULT false,
  estimated_cost_eur          NUMERIC(14,2),

  -- Deadline tracking
  surrender_deadline          DATE,
  surrender_status            TEXT CHECK (surrender_status IN ('OK', 'WARNING', 'URGENT', 'OVERDUE')),
  mrv_deadline                DATE,
  mrv_deadline_status         TEXT CHECK (mrv_deadline_status IN ('OK', 'WARNING', 'URGENT', 'OVERDUE')),

  -- Auditability
  parameter_version           TEXT NOT NULL,
  calculation_details         JSONB NOT NULL DEFAULT '{}',
  calculated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eu_ets_vessel_year ON eu_ets_records (vessel_id, reporting_year);
ALTER TABLE eu_ets_records ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  eu_ets_records                    IS 'Annual EU ETS compliance calculation records.';
COMMENT ON COLUMN eu_ets_records.ets_scope          IS 'EU ETS surrender obligation scope (IN_SCOPE/OUT_OF_SCOPE/UNKNOWN_DATA).';
COMMENT ON COLUMN eu_ets_records.mrv_scope          IS 'EU MRV monitoring scope (separate from ETS surrender).';
COMMENT ON COLUMN eu_ets_records.total_ttw_co2_tonnes IS 'Total Tank-to-Wake CO₂ in metric tonnes.';
COMMENT ON COLUMN eu_ets_records.covered_co2_tonnes IS 'CO₂ covered by EU ETS after voyage coverage factors applied.';
COMMENT ON COLUMN eu_ets_records.coverage_rate      IS 'Annual phase-in coverage rate (e.g. 0.40 for 40%).';
COMMENT ON COLUMN eu_ets_records.eua_obligation_tonnes IS 'Indicative EUA obligation = covered_co2 × coverage_rate.';
COMMENT ON COLUMN eu_ets_records.eua_price_eur      IS 'EUA price in EUR per tonne (null if unavailable).';
COMMENT ON COLUMN eu_ets_records.estimated_cost_eur  IS 'Estimated cost = eua_obligation × eua_price (null if price unavailable).';
COMMENT ON COLUMN eu_ets_records.surrender_deadline  IS 'EUA surrender deadline date (30 September).';
COMMENT ON COLUMN eu_ets_records.mrv_deadline        IS 'MRV annual reporting deadline (31 March).';
COMMENT ON COLUMN eu_ets_records.calculation_details IS 'Voyage breakdown contributions, source references, parameter version.';

-- 3. MRV ANNUAL REPORT PREPARATION ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mrv_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  reporting_year              INTEGER NOT NULL CHECK (reporting_year >= 2024),
  status                      TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'validated', 'blocked', 'exported', 'superseded')),

  -- Completeness
  completeness_status         TEXT NOT NULL DEFAULT 'BLOCKED'
                              CHECK (completeness_status IN ('VALID', 'WARNING', 'BLOCKED')),
  completeness_checks         JSONB NOT NULL DEFAULT '[]',
  blocking_issues             JSONB NOT NULL DEFAULT '[]',
  warnings                    JSONB NOT NULL DEFAULT '[]',

  -- Pre-submission checklist
  checklist_status            TEXT CHECK (checklist_status IN ('PASS', 'WARNING', 'BLOCKED')),
  checklist_details           JSONB,

  -- Export
  export_format               TEXT CHECK (export_format IN ('xml', 'csv')),
  export_generated_at         TIMESTAMPTZ,
  export_content_hash         TEXT,
  export_file_path            TEXT,

  -- Report data (structured MRV payload)
  report_data                 JSONB NOT NULL DEFAULT '{}',
  total_voyages               INTEGER NOT NULL DEFAULT 0,
  total_fuel_mt               NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_co2_tonnes            NUMERIC(14,4) NOT NULL DEFAULT 0,
  monitoring_plan_version     TEXT,
  methodology                 TEXT NOT NULL DEFAULT 'default'
                              CHECK (methodology IN ('default', 'alternative')),

  -- Auditability
  calculation_version         TEXT NOT NULL,
  parameter_version           TEXT NOT NULL,
  ets_record_id               UUID REFERENCES eu_ets_records(id) ON DELETE SET NULL,
  generated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mrv_reports_vessel_year ON mrv_reports (vessel_id, reporting_year);
ALTER TABLE mrv_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  mrv_reports                        IS 'EU MRV annual report preparation records.';
COMMENT ON COLUMN mrv_reports.completeness_status    IS 'VALID/WARNING/BLOCKED — whether report can be generated.';
COMMENT ON COLUMN mrv_reports.blocking_issues        IS 'Issues that block report generation.';
COMMENT ON COLUMN mrv_reports.warnings               IS 'Non-blocking warnings.';
COMMENT ON COLUMN mrv_reports.checklist_status        IS 'Pre-submission checklist result.';
COMMENT ON COLUMN mrv_reports.report_data             IS 'Structured MRV report payload (voyage-by-voyage).';
COMMENT ON COLUMN mrv_reports.export_content_hash     IS 'SHA-256 of generated export for integrity verification.';
