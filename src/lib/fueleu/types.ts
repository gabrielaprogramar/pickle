import type { FuelDeliveryRow } from "@/lib/supabase/types";

// ── PK / version constants ─────────────────────────────────────────────────

export const FUELEU_CALCULATION_VERSION = "1.0.0";

// ── Compliance result ──────────────────────────────────────────────────────

/** Sign convention: compliance_balance = target - actual. positive = surplus. */
export type ComplianceSign = "surplus" | "zero" | "deficit";

/** Per-delivery contribution to the annual FuelEU result. */
export interface FuelEuDeliveryContribution {
  readonly fuel_delivery_id: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly quantity_kg: number;
  readonly lhv_mj_per_kg: number;
  readonly lhv_source: string;
  readonly energy_mj: number;
  readonly wtw_factor_gco2e_per_mj: number;
  readonly wtw_factor_source: string;
  readonly wtw_emissions_gco2e: number;
  readonly is_biofuel: boolean;
}

/** Result of a single FuelEU compliance calculation. */
export interface FuelEuCalculationResult {
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status: "draft" | "final" | "superseded";

  readonly deliveries_used: number;
  readonly deliveries_total: number;

  readonly energy_input_mj: number;
  readonly total_wtw_emissions_gco2e: number;
  readonly ghg_intensity_gco2e_per_mj: number;

  readonly target_gco2e_per_mj: number;
  readonly reduction_pct: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: ComplianceSign;

  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details: ReadonlyArray<{
    fuel_delivery_id: string;
    fuel_type: string;
    supplier: string;
  }>;

  readonly ops_energy_mj: number;
  readonly ops_data_available: boolean;

  readonly penalty_exposure_estimate: number | null;
  readonly penalty_formula_version: string | null;
  readonly penalty_is_estimate: boolean;

  readonly contributions: ReadonlyArray<FuelEuDeliveryContribution>;
  readonly fuel_delivery_ids: ReadonlyArray<string>;

  readonly calculated_at: string;
}

// ── Calculation input ──────────────────────────────────────────────────────

export interface FuelEuCalculationInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly deliveries: ReadonlyArray<FuelDeliveryRow>;
  readonly ops_energy_mj?: number;
  readonly parameter_version_override?: string;
  /** IDs of fuel deliveries known to lack ISCC certification. */
  readonly iscc_missing_delivery_ids?: ReadonlyArray<string>;
}

// ── Pooling data ───────────────────────────────────────────────────────────

export interface VesselPoolingPosition {
  readonly vessel_id: string;
  readonly vessel_name: string;
  readonly imo: string;
  readonly reporting_year: number;
  readonly total_energy_mj: number;
  readonly actual_intensity: number;
  readonly target_intensity: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: ComplianceSign;
  readonly poolable_balance: number;
  readonly penalty_exposure_estimate: number | null;
}

// ── DB row / insert types ──────────────────────────────────────────────────

export interface FuelEuRecordRow {
  readonly id: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly status: string;
  readonly energy_input_mj: number;
  readonly total_wtw_emissions_gco2e: number;
  readonly ghg_intensity_gco2e_per_mj: number;
  readonly target_gco2e_per_mj: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: string;
  readonly penalty_exposure_estimate: number | null;
  readonly penalty_formula_version: string | null;
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details: Record<string, unknown> | null;
  readonly ops_energy_mj: number;
  readonly ops_data_available: boolean;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FuelEuRecordInsert {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly status?: string;
  readonly energy_input_mj: number;
  readonly total_wtw_emissions_gco2e: number;
  readonly ghg_intensity_gco2e_per_mj: number;
  readonly target_gco2e_per_mj: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: string;
  readonly penalty_exposure_estimate?: number | null;
  readonly penalty_formula_version?: string | null;
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details?: unknown;
  readonly ops_energy_mj: number;
  readonly ops_data_available: boolean;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at?: string;
}
