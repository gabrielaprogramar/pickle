import type { FuelDeliveryRow } from "@/lib/supabase/types";
import type { Applicability } from "@/lib/regulatory/applicability";
import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { FuelEuComplianceStatus, FuelEuException } from "./compliance";

// ── PK / version constants ─────────────────────────────────────────────────

export const FUELEU_CALCULATION_VERSION = "3.0.0";

/** Re-export compliance status + exception types. */
export type { FuelEuComplianceStatus, FuelEuException } from "./compliance";
export type { Applicability };

// ── Compliance sign ─────────────────────────────────────────────────────────

/**
 * Sign convention: compliance_balance = target - actual. positive = surplus.
 * `null` means the balance could not be resolved (UNKNOWN) — never coerced.
 */
export type ComplianceSign = "surplus" | "zero" | "deficit";

// ── Voyage scope (FuelEU geographic weighting) ──────────────────────────────

/**
 * FuelEU applies 100% of a voyage's energy for intra-EU voyages and (for a
 * non-EU-flagged ship) 50% for voyages to/from the EU. Simply restating how a
 * voyage is classified so the engine can weight energy without re-implementing
 * the authoritative port classifier.
 */
export type FuelEuVoyageScopeType =
  | "INTRA_EU"
  | "EU_TO_THIRD"
  | "THIRD_TO_EU"
  | "NON_EU"
  | "UNKNOWN";

export interface FuelEuVoyageContribution {
  readonly voyage_id: string;
  readonly departure_port: string;
  readonly arrival_port: string;
  readonly scope_type: FuelEuVoyageScopeType;
  /** Share of this voyage's energy counted into FuelEU (1.0 intra-EU, 0.5 to/from EU, 0 non-EU, null UNKNOWN). */
  readonly scope_factor: number | null;
  readonly scope_resolved: boolean;
  readonly energy_mj: number;
  readonly total_wtw_emissions_gco2e: number;
  readonly ghg_intensity_gco2e_per_mj: number | null;
  readonly unknown_ports: readonly string[];
  readonly consumption_status: string | null;
}

// ── Per-fuel energy contribution ───────────────────────────────────────────

export interface FuelEuEnergyContribution {
  readonly voyage_id: string | null;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly method: string;
  readonly confidence: string;
  readonly status: string;
  readonly lhv_mj_per_kg: number;
  readonly lhv_source: string;
  readonly energy_mj: number;
  readonly wtw_factor_gco2e_per_mj: number;
  readonly wtw_factor_source: string;
  readonly wtw_emissions_gco2e: number;
  readonly is_biofuel: boolean;
  readonly biofuel_status: string | null;
}

// ── Pooling / banking / borrowing positions ─────────────────────────────────

export type FuelEuBalanceTool =
  | "BANKING"
  | "BORROWING"
  | "POOLING"
  | "NONE";

export interface FuelEuBalanceToolResult {
  readonly tool: FuelEuBalanceTool | null;
  readonly status:
    | "APPLIED"
    | "UNAVAILABLE"
    | "REQUIRES_REVIEW"
    | "POOLING_REQUIRES_REVIEW";
  readonly detail: string | null;
  /** Banked/borrowed/pooled surplus energy (MJ) applied to the deficit, if any. */
  readonly energy_mj_applied: number | null;
  readonly evidence: ReadonlyArray<string>;
}

// ── Compliance result ───────────────────────────────────────────────────────

export interface FuelEuCalculationResult {
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status: "draft" | "final" | "superseded";

  readonly gt: number | null;
  readonly is_in_scope: boolean;
  readonly compliance_applicable: boolean;
  readonly compliance_scope_resolved: boolean;
  readonly compliance_status: FuelEuComplianceStatus;
  readonly exceptions: ReadonlyArray<FuelEuException>;

  /** Energy counted into FuelEU (after scope weighting). NULL when unresolved. */
  readonly energy_input_mj: number | null;
  /** WtW emissions over in-scope energy. NULL when unresolved. */
  readonly total_wtw_emissions_gco2e: number | null;
  readonly ghg_intensity_gco2e_per_mj: number | null;

  readonly baseline_gco2e_per_mj: number | null;
  readonly target_gco2e_per_mj: number | null;
  readonly target_source: string | null;
  readonly reduction_pct: number | null;
  /** target - actual. NULL when unresolved. */
  readonly compliance_balance: number | null;
  readonly surplus_or_deficit: ComplianceSign | null;

  readonly biofuel_energy_mj: number | null;
  readonly fossil_energy_mj: number | null;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details: ReadonlyArray<{
    fuel_type: string;
    voyage_id: string | null;
    certificate_status: string;
    detail: string;
  }>;

  readonly ops_energy_mj: number | null;
  readonly ops_data_available: boolean;

  readonly penalty_exposure_estimate: number | null;
  readonly penalty_is_estimate: boolean;
  readonly penalty_assessed_eur: number | null;
  readonly penalty_formula_version: string | null;

  readonly banking: FuelEuBalanceToolResult;
  readonly borrowing: FuelEuBalanceToolResult;
  readonly pooling: FuelEuBalanceToolResult;

  readonly voyage_contributions: ReadonlyArray<FuelEuVoyageContribution>;
  readonly voyage_ids: ReadonlyArray<string>;
  readonly energy_contributions: ReadonlyArray<FuelEuEnergyContribution>;
  readonly unknown_ports: ReadonlyArray<string>;
  readonly consumption_rows: ReadonlyArray<VoyageConsumptionRow>;

  readonly calculated_at: string;
}

// ── Calculation input ──────────────────────────────────────────────────────

export interface FuelEuCalculationInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly gt: number | null;
  readonly parameter_version_override?: string;
  readonly status?: "draft" | "final" | "superseded";

  readonly vessel_profile?: {
    readonly flag: string | null;
    readonly vessel_type: string | null;
    readonly vessel_category: string | null;
  };

  /** Precomputed FUEL_EU applicability decision (from regulation_applicability). */
  readonly applicability?: {
    readonly status: Applicability;
    readonly is_decision_final: boolean;
    readonly rule_version?: number;
    readonly rule_effective_from?: string;
    readonly rule_effective_until?: string | null;
    readonly basis?: Record<string, unknown>;
    readonly notes?: string | null;
  } | null;

  /** Canonical per-voyage consumption (voyage_consumption). Single source of fuel truth. */
  readonly consumption?: ReadonlyArray<VoyageConsumptionRow>;

  /** Voyage geographic facts (ports + authoritative country hints) for scope weighting. */
  readonly voyages?: ReadonlyArray<{
    readonly id: string;
    readonly departure_port: string;
    readonly arrival_port: string;
    readonly departure_country?: string | null;
    readonly arrival_country?: string | null;
    /** Weighted scope factor (1.0 intra-EU, 0.5 to/from EU, 0 non-EU, null UNKNOWN). */
    readonly scope_factor?: number | null;
    readonly scope_type?: FuelEuVoyageScopeType;
    readonly unknown_ports?: readonly string[];
  }>;

  /** Versioned rule parameters the engine reads (baseline, target, penalty). */
  readonly rules?: {
    readonly baseline_gco2e_per_mj: number | null;
    readonly target_gco2e_per_mj: number | null;
    readonly target_source: string | null;
    readonly reduction_pct: number | null;
    readonly penalty_eur_per_tonne_vlsfoe: number | null;
    readonly penalty_formula_version: string | null;
  };

  /** OPS energy tied to the canonical port-call/activity model. `null` (not 0)
   *  means OPS data is unavailable — never fabricate an OPS=0 figure. */
  readonly ops_energy_mj?: number | null;
  readonly ops_data_available?: boolean;

  /**
   * Biofuel certification evidence keyed by fuel type. Absent → the biofuel's
   * low-carbon credit is NOT assumed; it is surfaced as requiring evidence.
   */
  readonly biofuel_certification?: ReadonlyArray<{
    readonly fuel_type: string;
    readonly voyage_id: string | null;
    readonly certificate_status:
      | "VALID"
      | "MISSING"
      | "EXPIRED"
      | "UNSUPPORTED"
      | "CONFLICT";
    readonly detail: string;
  }>;

  /** Authoritative penalty assessment (EUR) if one was formally made. */
  readonly penalty_assessed_eur?: number | null;

  /** Explicit banking/borrowing/pooling directions from the operator. */
  readonly banking_requested?: boolean;
  readonly borrowing_requested?: boolean;
  readonly pooling_requested?: boolean;
  readonly pool_snapshot?: ReadonlyArray<{
    readonly vessel_id: string;
    readonly imo: string;
    /** NOTE: raw intensity balance in gCO₂e/MJ — NOT energy MJ. A surplus can
     *  only be expressed in energy terms as (intensity_balance/baseline) ×
     *  total_energy_mj, which requires baseline + energy inputs not available on
     *  this snapshot. Pooling is deferred (never APPLIED) in Part 3.6 for this
     *  reason, so this value is informational/review only. */
    readonly surplus_intensity_gco2e_per_mj: number;
  }>;
}

// ── Pooling data ───────────────────────────────────────────────────────────

export interface VesselPoolingPosition {
  readonly vessel_id: string;
  readonly vessel_name: string;
  readonly imo: string;
  readonly reporting_year: number;
  readonly total_energy_mj: number | null;
  readonly actual_intensity: number | null;
  readonly target_intensity: number | null;
  readonly compliance_balance: number | null;
  readonly surplus_or_deficit: ComplianceSign | null;
  readonly poolable_balance: number | null;
  readonly penalty_exposure_estimate: number | null;
}

// ── DB row / insert types ──────────────────────────────────────────────────

export interface FuelEuRecordRow {
  readonly id: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly status: string;
  readonly energy_input_mj: number | null;
  readonly total_wtw_emissions_gco2e: number | null;
  readonly ghg_intensity_gco2e_per_mj: number | null;
  readonly target_gco2e_per_mj: number | null;
  readonly compliance_balance: number | null;
  readonly surplus_or_deficit: string | null;
  readonly penalty_exposure_estimate: number | null;
  readonly penalty_formula_version: string | null;
  readonly biofuel_energy_mj: number | null;
  readonly fossil_energy_mj: number | null;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details: Record<string, unknown> | null;
  readonly ops_energy_mj: number | null;
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
  readonly energy_input_mj: number | null;
  readonly total_wtw_emissions_gco2e: number | null;
  readonly ghg_intensity_gco2e_per_mj: number | null;
  readonly target_gco2e_per_mj: number | null;
  readonly compliance_balance: number | null;
  readonly surplus_or_deficit: string | null;
  readonly penalty_exposure_estimate?: number | null;
  readonly penalty_formula_version?: string | null;
  readonly biofuel_energy_mj: number | null;
  readonly fossil_energy_mj: number | null;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details?: unknown;
  readonly ops_energy_mj: number | null;
  readonly ops_data_available: boolean;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at?: string;
}
