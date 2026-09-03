export const MRV_CALCULATION_VERSION = "2.0.0";

// ── Completeness ───────────────────────────────────────────────────────────

export type MrvCompletenessStatus = "VALID" | "WARNING" | "BLOCKED";
export type ChecklistStatus = "PASS" | "WARNING" | "BLOCKED";

export interface MrvCompletenessCheck {
  readonly check_name: string;
  readonly passed: boolean;
  readonly severity: "error" | "warning";
  readonly message: string;
}

// ── Monitoring Plan domain model (Annex I, Implementing Reg. 2023/2449) ────

/**
 * THETIS-MRV monitoring plan workflow statuses (mirrors the THETIS-MRV
 * workflow: Draft → Submitted to Verifier → Submitted to AA → Approved;
 * a newer approved plan SUPERSEDES an older one).
 */
export const MONITORING_PLAN_STATUSES = [
  "DRAFT",
  "UNDER_REVISION",
  "SUBMITTED_TO_VERIFIER",
  "SUBMITTED_TO_AA",
  "APPROVED",
  "SUPERSEDED",
] as const;
export type MrvMonitoringPlanStatus = (typeof MONITORING_PLAN_STATUSES)[number];

export interface MrvMonitoringPlan {
  readonly id: string;
  readonly vessel_id: string;
  readonly version: number;
  readonly status: MrvMonitoringPlanStatus;
  readonly methodology: "default" | "alternative";
  readonly monitoring_method: "A" | "B" | "C" | "D" | null;
  readonly effective_from: string | null;
  readonly effective_until: string | null;
  readonly emission_factors_snapshot: Record<string, unknown>;
  readonly activity_data_procedures: Record<string, unknown>;
  readonly data_gap_methods: Record<string, unknown>;
  readonly source_reference: string | null;
  readonly approved_at: string | null;
}

/** Outcome of deterministic active-plan resolution for a vessel on a date. */
export type MonitoringPlanResolution =
  | { readonly status: "RESOLVED"; readonly plan: MrvMonitoringPlan }
  | { readonly status: "NOT_FOUND"; readonly reason: string }
  | {
      readonly status: "REQUIRES_REVIEW";
      readonly reason: string;
      readonly candidates: ReadonlyArray<MrvMonitoringPlan>;
    }
  | {
      readonly status: "NOT_APPROVED";
      readonly reason: string;
      readonly plan: MrvMonitoringPlan;
    };

// ── Report lifecycle state machine (see lifecycle.ts) ──────────────────────

export const MRV_LIFECYCLE = [
  "DATA_INCOMPLETE",
  "DRAFT",
  "VALIDATED",
  "REQUIRES_REVIEW",
  "SCHEMA_VALIDATED_LOCALLY",
  "VERIFIED",
  "EXPORTED",
  "SUPERSEDED",
] as const;
export type MrvLifecycle = (typeof MRV_LIFECYCLE)[number];

// ── Stocktake of a single fuel type for the year (Annex II Part D) ─────────

export interface MrvFuelStocktake {
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly co2_factor: number;
  readonly co2_tonnes: number;
  readonly source: string;
}

// ── Voyage entry for report ────────────────────────────────────────────────

export interface MrvVoyageEntry {
  readonly voyage_id: string;
  readonly departure_port: string;
  readonly arrival_port: string;
  readonly departure_date: string;
  readonly arrival_date: string;
  /** Distance travelled in nautical miles; null when not auditable. */
  readonly distance_nm: number | null;
  /** Total time at sea (arr - dep) in hours; null when times incomplete. */
  readonly time_at_sea_hours: number | null;
  readonly fuel_type: string;
  readonly fuel_consumption_mt: number;
  readonly co2_tonnes: number;
  readonly voyage_type: string;
  /** Data completeness for THIS voyage's distance/time/consumption metrics. */
  readonly distance_quality: "AUDITED" | "DATA_INCOMPLETE" | "REQUIRES_REVIEW" | "NOT_APPLICABLE";
  readonly time_quality: "AUDITED" | "DATA_INCOMPLETE" | "REQUIRES_REVIEW" | "NOT_APPLICABLE";
  readonly consumption_method: string;
  readonly consumption_status: string;
  readonly data_quality: string;
}

// ── Report version (append-only revision) ──────────────────────────────────

export interface MrvReportVersion {
  readonly version_number: number;
  readonly submission_status: "DRAFT" | "SCHEMA_VALIDATED_LOCALLY" | "VERIFIED" | "SUBMITTED" | "SUPERSEDED";
  readonly period_start: string;
  readonly period_end: string;
  readonly total_fuel_mt: number;
  readonly fuel_by_type: Record<string, number>;
  readonly co2_tonnes: number;
  readonly ch4_co2e_tonnes: number;
  readonly n2o_co2e_tonnes: number;
  readonly total_co2e_tonnes: number;
  readonly total_distance_nm: number | null;
  readonly total_time_at_sea_hours: number | null;
  readonly source_consumption_ids: string[];
  readonly source_voyage_ids: string[];
}

// ── Report result ──────────────────────────────────────────────────────────

export interface MrvReportResult {
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status: string;
  readonly lifecycle: MrvLifecycle;

  readonly completeness_status: MrvCompletenessStatus;
  readonly completeness_checks: ReadonlyArray<MrvCompletenessCheck>;
  readonly blocking_issues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;

  readonly total_voyages: number;
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly total_co2e_tonnes: number | null;
  readonly total_distance_nm: number | null;
  readonly total_time_at_sea_hours: number | null;
  readonly fuel_stocktakes: ReadonlyArray<MrvFuelStocktake>;
  readonly monitored_period_start: string | null;
  readonly monitored_period_end: string | null;
  readonly monitoring_plan_version: string | null;
  readonly monitoring_plan_ver: number | null;
  readonly methodology: string;

  readonly voyage_entries: ReadonlyArray<MrvVoyageEntry>;
  readonly version: MrvReportVersion | null;
  readonly delivery_ids: ReadonlyArray<string>;
  readonly voyage_ids: ReadonlyArray<string>;
  readonly report_data: Readonly<Record<string, unknown>>;

  readonly generated_at: string;
}

// ── Pre-submission checklist ───────────────────────────────────────────────

export interface MrvChecklistItem {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface MrvChecklistResult {
  readonly status: ChecklistStatus;
  readonly items: ReadonlyArray<MrvChecklistItem>;
  readonly blocking_items: ReadonlyArray<string>;
  readonly warning_items: ReadonlyArray<string>;
}

// ── Export ─────────────────────────────────────────────────────────────────

export interface MrvExportResult {
  readonly format: "xml" | "csv";
  readonly content: string;
  readonly content_hash: string;
  readonly generated_at: string;
  readonly validation_status: ChecklistStatus;
  /**
   * Verification posture for external submission. This system performs LOCAL,
   * deterministic schema validation only. THETIS-MRV direct submission is NOT
   * performed and is never claimed. Values:
   *   'SCHEMA_VALIDATED_LOCALLY' — validated locally against the Annex II
   *     field set; NOT submitted to THETIS.
   *   'BLOCKED'                   — blocking validation issues prevented export.
   */
  readonly submission_status: "SCHEMA_VALIDATED_LOCALLY" | "BLOCKED";
}

// ── Verifier package ───────────────────────────────────────────────────────

export interface MrvVerifierPackage {
  readonly report_id: string;
  readonly annual_report: string;
  readonly source_bdn_count: number;
  readonly voyage_export_count: number;
  readonly discrepancy_notes: ReadonlyArray<string>;
  readonly validation_results_ref: string;
  readonly audit_references: ReadonlyArray<string>;
  /**
   * Deterministic hash over the source-record identifiers the verifier package
   * is reconstructed from, so the package is reproducible from stored records.
   */
  readonly reproducibility_hash: string | null;
  readonly generated_at: string;
}

// ── DB types ───────────────────────────────────────────────────────────────

export interface MrvReportRow {
  readonly id: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status: string;
  readonly completeness_status: string;
  readonly completeness_checks: unknown[];
  readonly blocking_issues: unknown[];
  readonly warnings: unknown[];
  readonly checklist_status: string | null;
  readonly checklist_details: Record<string, unknown> | null;
  readonly export_format: string | null;
  readonly export_generated_at: string | null;
  readonly export_content_hash: string | null;
  readonly export_file_path: string | null;
  readonly report_data: Record<string, unknown>;
  readonly total_voyages: number;
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly monitoring_plan_version: string | null;
  readonly methodology: string;
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly ets_record_id: string | null;
  readonly lifecycle: string | null;
  readonly period_start: string | null;
  readonly period_end: string | null;
  readonly monitoring_plan_ver: number | null;
  readonly total_distance_nm: number | null;
  readonly total_time_at_sea_hours: number | null;
  readonly generated_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MrvReportInsert {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status?: string;
  readonly completeness_status: string;
  readonly completeness_checks?: unknown[];
  readonly blocking_issues?: unknown[];
  readonly warnings?: unknown[];
  readonly checklist_status?: string | null;
  readonly checklist_details?: Record<string, unknown> | null;
  readonly export_format?: string | null;
  readonly export_generated_at?: string | null;
  readonly export_content_hash?: string | null;
  readonly export_file_path?: string | null;
  readonly report_data: Record<string, unknown>;
  readonly total_voyages: number;
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly monitoring_plan_version?: string | null;
  readonly methodology?: string;
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly ets_record_id?: string | null;
  readonly lifecycle?: string | null;
  readonly period_start?: string | null;
  readonly period_end?: string | null;
  readonly monitoring_plan_ver?: number | null;
  readonly total_distance_nm?: number | null;
  readonly total_time_at_sea_hours?: number | null;
  readonly generated_at?: string;
}
