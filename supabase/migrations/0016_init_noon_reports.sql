-- 0016_init_noon_reports.sql
-- Noon Report Intelligence persistence (Phase 4.4).
-- ─────────────────────────────────────────────────────────────────────────────
-- One table:
--   noon_reports  — one row per noon report: raw values from the AI
--                   extraction, plus the deterministic evaluation output
--                   (analysis, findings, fuel/voyage/FuelEU/ETS correlations)
--                   stored as JSONB so history can be replayed without
--                   re-running the engines.
--
-- Design notes:
--   • Every numeric operational value is nullable (determinism rule: a
--     missing value is NULL, never invented).
--   • confidence is [0,1]. position/speed/rpm ranges mirror the shared
--     validation rules (noon.*).
--   • evaluated_at / evaluation_version / dedup_key are populated only after
--     the deterministic engine has run; dedup_key de-duplicates repeated
--     evaluations of an unchanged report.
--   • touch_updated_at() trigger from migration 0001 is reused for updated_at.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS noon_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  imo                         TEXT NOT NULL,
  vessel_name                 TEXT,
  report_date                 TIMESTAMPTZ NOT NULL,
  position_latitude           DOUBLE PRECISION,
  position_longitude          DOUBLE PRECISION,
  speed_knots                 DOUBLE PRECISION,
  course_degrees              DOUBLE PRECISION,
  distance_to_go_nm           DOUBLE PRECISION,
  fuel_consumption_tonnes     DOUBLE PRECISION,
  fuel_robs_tonnes            DOUBLE PRECISION,
  engine_rpm                  DOUBLE PRECISION,
  sea_state                   TEXT,
  wind_speed_knots            DOUBLE PRECISION,
  wind_direction              TEXT,
  summary                     TEXT,
  warnings                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence                  NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  source                      TEXT NOT NULL DEFAULT 'ai_extraction',
  source_document_id          TEXT,
  review_state                TEXT,
  is_blocked                  BOOLEAN NOT NULL DEFAULT false,
  analysis                    JSONB,
  findings                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  fuel_correlation            JSONB,
  voyage_correlation          JSONB,
  fueleu_operational          JSONB,
  ets_operational             JSONB,
  evaluated_at                TIMESTAMPTZ,
  evaluation_version          TEXT,
  dedup_key                   TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT noon_reports_position_range CHECK (
    (position_latitude IS NULL OR (position_latitude >= -90 AND position_latitude <= 90))
    AND (position_longitude IS NULL OR (position_longitude >= -180 AND position_longitude <= 180))
  ),
  CONSTRAINT noon_reports_speed_range CHECK (
    speed_knots IS NULL OR (speed_knots >= 0 AND speed_knots <= 60)
  ),
  CONSTRAINT noon_reports_course_range CHECK (
    course_degrees IS NULL OR (course_degrees >= 0 AND course_degrees <= 360)
  ),
  CONSTRAINT noon_reports_rpm_range CHECK (
    engine_rpm IS NULL OR (engine_rpm >= 0 AND engine_rpm <= 500)
  ),
  CONSTRAINT noon_reports_consumption_non_negative CHECK (
    fuel_consumption_tonnes IS NULL OR fuel_consumption_tonnes >= 0
  ),
  CONSTRAINT noon_reports_rob_non_negative CHECK (
    fuel_robs_tonnes IS NULL OR fuel_robs_tonnes >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_noon_reports_vessel_date ON noon_reports (vessel_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_noon_reports_imo ON noon_reports (imo);
CREATE INDEX IF NOT EXISTS idx_noon_reports_evaluated ON noon_reports (vessel_id) WHERE evaluated_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_noon_reports_vessel_dedup ON noon_reports (vessel_id, dedup_key) WHERE dedup_key IS NOT NULL;

COMMENT ON TABLE noon_reports IS
  'Noon report raw values plus the deterministic evaluation output (analysis, findings, correlations).';
COMMENT ON COLUMN noon_reports.fuel_consumption_tonnes IS
  'Total consumption since the previous noon report (tonnes). NULL when not reported.';
COMMENT ON COLUMN noon_reports.fuel_robs_tonnes IS
  'Total remaining on board at the report instant (tonnes). NULL when not reported.';
COMMENT ON COLUMN noon_reports.analysis IS
  'JSONB NoonReportAnalysis produced by the deterministic noon engine.';
COMMENT ON COLUMN noon_reports.findings IS
  'JSONB array of NoonFinding (severity/confidence/reason/remediation).';
COMMENT ON COLUMN noon_reports.dedup_key IS
  'Stable key over report content used to de-duplicate repeated evaluations.';

-- 1. UPDATED_AT TRIGGER ───────────────────────────────────────────────────────

CREATE TRIGGER noon_reports_touch_updated_at
  BEFORE UPDATE ON noon_reports
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 2. ROW-LEVEL SECURITY (deny-by-default, service-role only) ─────────────────

ALTER TABLE noon_reports ENABLE ROW LEVEL SECURITY;
