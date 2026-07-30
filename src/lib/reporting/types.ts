export const REPORTING_VERSION = "1.0.0";

export type ThetisMrvReportContent = {
  readonly vessel_id: string;
  readonly vessel_name: string;
  readonly imo: string;
  readonly reporting_year: number;
  readonly total_voyages: number;
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly methodology: string;
  readonly monitoring_plan_version: string | null;
  readonly mrv_report_id: string;
  readonly source_report: Record<string, unknown>;
  readonly generated_at: string;
};

export type FuelEuReportContent = {
  readonly vessel_id: string;
  readonly vessel_name: string;
  readonly imo: string;
  readonly reporting_year: number;
  readonly ghg_intensity: number;
  readonly target_intensity: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: string;
  readonly penalty_estimate: number | null;
  readonly biofuel_energy_mj: number;
  readonly ops_energy_mj: number;
  readonly source_record_id: string;
  readonly source_calculation: Record<string, unknown>;
  readonly generated_at: string;
};

export type GreenZoneReportContent = {
  readonly vessel_id: string;
  readonly vessel_name: string;
  readonly imo: string;
  readonly season: string | null;
  readonly zone_events_count: number;
  readonly zones_entered: ReadonlyArray<{
    readonly zone_code: string;
    readonly zone_name: string;
    readonly category: string;
    readonly entry_count: number;
    readonly total_duration_minutes: number;
  }>;
  readonly port_call_count: number;
  readonly source_event_ids: ReadonlyArray<string>;
  readonly generated_at: string;
};

export type FleetSummaryReportContent = {
  readonly fleet_name: string;
  readonly reporting_year: number;
  readonly vessel_count: number;
  readonly vessel_summaries: ReadonlyArray<{
    readonly vessel_id: string;
    readonly vessel_name: string;
    readonly imo: string;
    readonly mrv_status: string | null;
    readonly fueleu_status: string | null;
    readonly ets_status: string | null;
    readonly mrv_co2_tonnes: number | null;
    readonly fueleu_balance: number | null;
  }>;
  readonly generated_at: string;
};

export type EsgPackageContent = Record<string, unknown>;
