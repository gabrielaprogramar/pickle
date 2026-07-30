-- 0006_init_fuel_deliveries.sql
-- Fuel delivery / BDN reconciliation data layer.
-- Adds reference fuel types, delivery records, reconciliation log.
-- Every delivery is traceable to its source BDN document + OCR result.
-- Reconciliation links fuel deliveries to voyages for compliance calculation.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. REFERENCE FUEL TYPES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fuel_types (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('residual', 'distillate', 'alternative', 'biofuel', 'lng', 'lpg', 'methanol', 'hydrogen', 'ammonia', 'other')),
  description         TEXT,
  co2_factor          NUMERIC(8,4) NOT NULL COMMENT 'kg CO₂ per kg fuel',
  sox_factor          NUMERIC(8,6) NOT NULL DEFAULT 0 COMMENT 'kg SOx per kg fuel per % sulphur content',
  pm_factor           NUMERIC(8,6) NOT NULL DEFAULT 0 COMMENT 'kg PM per kg fuel',
  density_default     NUMERIC(5,1) COMMENT 'Default density in kg/m³ at 15°C',
  is_drop_in          BOOLEAN NOT NULL DEFAULT true COMMENT 'Can be used as direct replacement',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard fuel types
INSERT INTO fuel_types (id, display_name, category, co2_factor, sox_factor, pm_factor, density_default, is_drop_in) VALUES
  ('hfo_380',    'HFO 380',         'residual',    3.114, 0.020, 0.0020, 991.0, true),
  ('hfo_180',    'HFO 180',         'residual',    3.114, 0.020, 0.0018, 985.0, true),
  ('hfo',        'HFO (general)',   'residual',    3.114, 0.020, 0.0018, 988.0, true),
  ('rmg_380',    'RMG 380',         'residual',    3.114, 0.020, 0.0020, 991.0, true),
  ('rmk_380',    'RMK 380',         'residual',    3.114, 0.020, 0.0020, 991.0, true),
  ('vlsfo',      'VLSFO',           'residual',    3.151, 0.005, 0.0010, 920.0, true),
  ('ulfso',      'ULSFO',           'residual',    3.151, 0.001, 0.0008, 900.0, true),
  ('lsmgo',      'LSMGO',           'distillate',  3.206, 0.001, 0.0005, 890.0, true),
  ('mgo',        'MGO',             'distillate',  3.206, 0.010, 0.0005, 890.0, true),
  ('mdo',        'MDO',             'distillate',  3.206, 0.010, 0.0005, 895.0, true),
  ('lng',        'LNG',             'lng',          2.750, 0.000, 0.0000, 460.0, false),
  ('lpg',        'LPG',             'lpg',          3.000, 0.000, 0.0000, 540.0, false),
  ('methanol',   'Methanol',        'methanol',     1.375, 0.000, 0.0000, 793.0, false),
  ('biodiesel',  'Biodiesel (B100)','biofuel',      2.850, 0.001, 0.0003, 880.0, true),
  ('b30',        'B30 (30% bio)',   'residual',     3.061, 0.004, 0.0008, 910.0, true),
  ('hydrogen',   'Hydrogen',        'hydrogen',     0.000, 0.000, 0.0000, 0.0,   false),
  ('ammonia',    'Ammonia',         'ammonia',      0.000, 0.000, 0.0000, 680.0, false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE  fuel_types               IS 'Reference fuel types with emission factors and physical properties.';
COMMENT ON COLUMN fuel_types.co2_factor    IS 'CO₂ emission factor in kg CO₂ per kg fuel burnt (TtW).';
COMMENT ON COLUMN fuel_types.sox_factor    IS 'SOx emission factor per % sulphur content, in kg SOx per kg fuel.';
COMMENT ON COLUMN fuel_types.pm_factor     IS 'Particulate matter factor in kg PM per kg fuel burnt.';

-- 2. FUEL DELIVERIES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fuel_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ocr_result_id         UUID REFERENCES ocr_results(id) ON DELETE SET NULL,
  ai_extraction_id      UUID REFERENCES ai_extractions(id) ON DELETE SET NULL,
  vessel_id             UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  supplier              TEXT NOT NULL,
  delivery_port         TEXT NOT NULL,
  delivery_date         TIMESTAMPTZ NOT NULL,
  fuel_type             TEXT NOT NULL REFERENCES fuel_types(id),
  quantity_mt           NUMERIC(12,3) NOT NULL CHECK (quantity_mt > 0),
  density_kgm3          NUMERIC(6,1) CHECK (density_kgm3 > 0),
  sulphur_content_pct   NUMERIC(5,3) CHECK (sulphur_content_pct >= 0 AND sulphur_content_pct <= 10),
  bdn_reference         TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verified', 'reconciled', 'disputed', 'rejected')),
  reconciled_voyage_id  UUID REFERENCES voyages(id) ON DELETE SET NULL,
  reconciled_at         TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_document_id  ON fuel_deliveries (document_id);
CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_vessel_id    ON fuel_deliveries (vessel_id);
CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_voyage_id    ON fuel_deliveries (reconciled_voyage_id);
CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_delivery_date ON fuel_deliveries (delivery_date);
CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_status       ON fuel_deliveries (status);

ALTER TABLE fuel_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  fuel_deliveries                    IS 'Fuel delivery records from Bunker Delivery Notes (BDNs).';
COMMENT ON COLUMN fuel_deliveries.document_id        IS 'Source BDN document that produced this delivery.';
COMMENT ON COLUMN fuel_deliveries.ocr_result_id      IS 'OCR extraction result used to create this record.';
COMMENT ON COLUMN fuel_deliveries.ai_extraction_id   IS 'AI extraction result used to validate/enrich this record.';
COMMENT ON COLUMN fuel_deliveries.fuel_type          IS 'Normalized fuel type key referencing fuel_types.';
COMMENT ON COLUMN fuel_deliveries.quantity_mt        IS 'Quantity delivered in metric tonnes.';
COMMENT ON COLUMN fuel_deliveries.density_kgm3       IS 'Density at 15°C in kg/m³ as reported on the BDN.';
COMMENT ON COLUMN fuel_deliveries.sulphur_content_pct IS 'Sulphur content as percentage by mass.';
COMMENT ON COLUMN fuel_deliveries.reconciled_voyage_id IS 'Voyage this delivery has been reconciled against.';
COMMENT ON COLUMN fuel_deliveries.bdn_reference      IS 'BDN reference number from the source document.';

-- 3. RECONCILIATION LOG (append-only audit trail) ─────────────────────────────

CREATE TABLE IF NOT EXISTS reconciliation_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_delivery_id      UUID NOT NULL REFERENCES fuel_deliveries(id) ON DELETE CASCADE,
  voyage_id             UUID REFERENCES voyages(id) ON DELETE SET NULL,
  match_type            TEXT NOT NULL CHECK (match_type IN ('auto', 'manual', 'override', 'break')),
  match_confidence      NUMERIC(5,2) CHECK (match_confidence >= 0 AND match_confidence <= 100),
  match_reason          TEXT NOT NULL,
  matched_by            TEXT NOT NULL DEFAULT 'system',
  previous_status       TEXT NOT NULL,
  new_status            TEXT NOT NULL,
  details               JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_delivery_id ON reconciliation_log (fuel_delivery_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_voyage_id   ON reconciliation_log (voyage_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_created_at  ON reconciliation_log (created_at DESC);

ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  reconciliation_log                   IS 'Append-only audit log for BDN ↔ voyage reconciliation events.';
COMMENT ON COLUMN reconciliation_log.match_type        IS 'How the match was made: auto, manual, override, or break (sever).';
COMMENT ON COLUMN reconciliation_log.match_confidence  IS 'Confidence score 0-100 for automated matches.';
COMMENT ON COLUMN reconciliation_log.match_reason      IS 'Human-readable explanation of why this match was made.';
COMMENT ON COLUMN reconciliation_log.matched_by        IS 'Who or what performed the match (system or user identifier).';
COMMENT ON COLUMN reconciliation_log.previous_status   IS 'Status of the fuel delivery before this event.';
COMMENT ON COLUMN reconciliation_log.new_status        IS 'Status of the fuel delivery after this event.';
