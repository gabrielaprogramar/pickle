export const ETS_CALCULATION_VERSION = "1.0.0";

// ── Scope ──────────────────────────────────────────────────────────────────

export type EtsScope = "IN_SCOPE" | "OUT_OF_SCOPE" | "UNKNOWN_DATA";
export type MrvScope = "IN_SCOPE" | "OUT_OF_SCOPE" | "UNKNOWN_DATA";

export function etsScopeForGt(gt: number | null): EtsScope {
  if (gt === null || gt === undefined) return "UNKNOWN_DATA";
  if (gt >= 5000) return "IN_SCOPE";
  return "OUT_OF_SCOPE";
}

export function mrvScopeForGt(gt: number | null): MrvScope {
  if (gt === null || gt === undefined) return "UNKNOWN_DATA";
  if (gt >= 400) return "IN_SCOPE";
  return "OUT_OF_SCOPE";
}

// ── Voyage coverage ────────────────────────────────────────────────────────

export type VoyageCoverageType =
  | "INTRA_EU"
  | "EU_TO_THIRD"
  | "THIRD_TO_EU"
  | "NON_EU";

export interface VoyageCoverageContribution {
  readonly voyage_id: string;
  readonly departure_port: string;
  readonly arrival_port: string;
  readonly coverage_type: VoyageCoverageType;
  readonly coverage_factor: number;
  readonly ttw_co2_tonnes: number;
  readonly covered_co2_tonnes: number;
}

// ── Deadline ───────────────────────────────────────────────────────────────

export type DeadlineStatus = "OK" | "WARNING" | "URGENT" | "OVERDUE";

export interface DeadlineInfo {
  readonly type: "surrender" | "mrv_reporting";
  readonly label: string;
  readonly deadline_date: string;
  readonly days_remaining: number;
  readonly status: DeadlineStatus;
}

// ── Calculation result ─────────────────────────────────────────────────────

export interface EtsCalculationResult {
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly vessel_id: string;
  readonly reporting_year: number;

  readonly gt: number | null;
  readonly ets_scope: EtsScope;
  readonly mrv_scope: MrvScope;
  readonly is_in_scope: boolean;

  readonly total_ttw_co2_tonnes: number;
  readonly covered_co2_tonnes: number;
  readonly coverage_rate: number;
  readonly coverage_rate_version: string;

  readonly eua_obligation_tonnes: number;
  readonly eua_price_eur: number | null;
  readonly eua_price_available: boolean;
  readonly estimated_cost_eur: number | null;

  readonly surrender_deadline: DeadlineInfo | null;
  readonly mrv_deadline: DeadlineInfo | null;

  readonly voyage_contributions: ReadonlyArray<VoyageCoverageContribution>;
  readonly voyage_ids: ReadonlyArray<string>;
  readonly delivery_ids: ReadonlyArray<string>;

  /** Port names that could not be classified (not silently coerced). */
  readonly unknown_ports: ReadonlyArray<string>;

  readonly calculated_at: string;
}

// ── Calculation input ──────────────────────────────────────────────────────

export interface EtsCalculationInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly gt: number | null;
  readonly deliveries: ReadonlyArray<{
    id: string;
    fuel_type: string;
    quantity_mt: number;
    delivery_date: string;
  }>;
  readonly voyages: ReadonlyArray<{
    id: string;
    departure_port: string;
    arrival_port: string;
  }>;
  readonly parameter_version_override?: string;
  readonly eua_price_eur?: number | null;
}

// ── DB types ───────────────────────────────────────────────────────────────

export interface EuEtsRecordRow {
  readonly id: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly gt: number | null;
  readonly ets_scope: string;
  readonly mrv_scope: string;
  readonly total_ttw_co2_tonnes: number;
  readonly covered_co2_tonnes: number;
  readonly coverage_rate: number;
  readonly coverage_rate_version: string;
  readonly eua_obligation_tonnes: number;
  readonly eua_price_eur: number | null;
  readonly eua_price_available: boolean;
  readonly estimated_cost_eur: number | null;
  readonly surrender_deadline: string | null;
  readonly surrender_status: string | null;
  readonly mrv_deadline: string | null;
  readonly mrv_deadline_status: string | null;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface EuEtsRecordInsert {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly gt: number | null;
  readonly ets_scope: string;
  readonly mrv_scope: string;
  readonly total_ttw_co2_tonnes: number;
  readonly covered_co2_tonnes: number;
  readonly coverage_rate: number;
  readonly coverage_rate_version: string;
  readonly eua_obligation_tonnes: number;
  readonly eua_price_eur?: number | null;
  readonly eua_price_available: boolean;
  readonly estimated_cost_eur?: number | null;
  readonly surrender_deadline?: string | null;
  readonly surrender_status?: string | null;
  readonly mrv_deadline?: string | null;
  readonly mrv_deadline_status?: string | null;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at?: string;
}
