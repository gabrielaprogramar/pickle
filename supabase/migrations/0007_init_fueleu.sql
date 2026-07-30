-- 0007_init_fueleu.sql
-- FuelEU Maritime deterministic compliance engine.
-- Stores annual FuelEU calculation results per vessel with full provenance.
-- Every record is reproducible: calculation inputs + parameter version + factor sources
-- are preserved alongside the output.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fuel_eu_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  reporting_year              INTEGER NOT NULL CHECK (reporting_year >= 2025),
  calculation_version         TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'final', 'superseded')),

  -- Energy and emissions aggregates (deterministic)
  energy_input_mj             NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_wtw_emissions_gco2e   NUMERIC(20,4) NOT NULL DEFAULT 0,
  ghg_intensity_gco2e_per_mj  NUMERIC(12,6) NOT NULL DEFAULT 0,
  target_gco2e_per_mj         NUMERIC(12,6) NOT NULL DEFAULT 0,
  compliance_balance          NUMERIC(12,6) NOT NULL DEFAULT 0,
  surplus_or_deficit          TEXT NOT NULL DEFAULT 'zero'
                              CHECK (surplus_or_deficit IN ('surplus', 'zero', 'deficit')),

  -- Penalty
  penalty_exposure_estimate   NUMERIC(14,2),
  penalty_formula_version     TEXT,

  -- Energy breakdown
  biofuel_energy_mj           NUMERIC(20,4) NOT NULL DEFAULT 0,
  fossil_energy_mj            NUMERIC(20,4) NOT NULL DEFAULT 0,

  -- ISCC gaps
  iscc_missing_flag           BOOLEAN NOT NULL DEFAULT false,
  iscc_missing_details        JSONB,

  -- OPS / shore power
  ops_energy_mj               NUMERIC(20,4) NOT NULL DEFAULT 0,
  ops_data_available          BOOLEAN NOT NULL DEFAULT false,

  -- Auditability / provenance
  parameter_version           TEXT NOT NULL,
  calculation_details         JSONB NOT NULL DEFAULT '{}',
  calculated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_eu_vessel_year
  ON fuel_eu_records (vessel_id, reporting_year);
CREATE INDEX IF NOT EXISTS idx_fuel_eu_vessel_id
  ON fuel_eu_records (vessel_id);
CREATE INDEX IF NOT EXISTS idx_fuel_eu_reporting_year
  ON fuel_eu_records (reporting_year);

ALTER TABLE fuel_eu_records ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  fuel_eu_records                         IS 'Annual FuelEU Maritime compliance calculation results per vessel.';
COMMENT ON COLUMN fuel_eu_records.calculation_version     IS 'Semantic version of the calculation engine that produced this result.';
COMMENT ON COLUMN fuel_eu_records.energy_input_mj         IS 'Total energy input from all fuel deliveries in MJ.';
COMMENT ON COLUMN fuel_eu_records.total_wtw_emissions_gco2e IS 'Total well-to-wake GHG emissions in gCO₂eq.';
COMMENT ON COLUMN fuel_eu_records.ghg_intensity_gco2e_per_mj IS 'Energy-weighted annual GHG intensity.';
COMMENT ON COLUMN fuel_eu_records.target_gco2e_per_mj     IS 'FuelEU target for the reporting year.';
COMMENT ON COLUMN fuel_eu_records.compliance_balance       IS 'target - actual. Positive = surplus, negative = deficit.';
COMMENT ON COLUMN fuel_eu_records.surplus_or_deficit       IS 'Classification of compliance balance sign.';
COMMENT ON COLUMN fuel_eu_records.penalty_exposure_estimate IS 'Estimated penalty in EUR. Not legally authoritative.';
COMMENT ON COLUMN fuel_eu_records.penalty_formula_version  IS 'Version of the penalty formula used for the estimate.';
COMMENT ON COLUMN fuel_eu_records.biofuel_energy_mj        IS 'Energy from ISCC-certified or assumed biofuel deliveries.';
COMMENT ON COLUMN fuel_eu_records.fossil_energy_mj         IS 'Energy from fossil fuel deliveries.';
COMMENT ON COLUMN fuel_eu_records.iscc_missing_flag        IS 'True when a biofuel delivery lacks ISCC evidence.';
COMMENT ON COLUMN fuel_eu_records.iscc_missing_details     IS 'Details of which deliveries are missing ISCC evidence.';
COMMENT ON COLUMN fuel_eu_records.ops_energy_mj            IS 'Energy from on-shore power (OPS) if available.';
COMMENT ON COLUMN fuel_eu_records.ops_data_available       IS 'Whether OPS consumption data was available for reporting.';
COMMENT ON COLUMN fuel_eu_records.parameter_version        IS 'Version identifier of the regulatory parameters used.';
COMMENT ON COLUMN fuel_eu_records.calculation_details      IS 'Full input trace: fuel delivery IDs, per-delivery contributions, factor references.';
