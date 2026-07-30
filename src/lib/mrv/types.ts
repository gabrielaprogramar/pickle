export const MRV_CALCULATION_VERSION = "1.0.0";

// ── Completeness ───────────────────────────────────────────────────────────

export type MrvCompletenessStatus = "VALID" | "WARNING" | "BLOCKED";
export type ChecklistStatus = "PASS" | "WARNING" | "BLOCKED";

export interface MrvCompletenessCheck {
  readonly check_name: string;
  readonly passed: boolean;
  readonly severity: "error" | "warning";
  readonly message: string;
}

// ── Voyage entry for report ────────────────────────────────────────────────

export interface MrvVoyageEntry {
  readonly voyage_id: string;
  readonly departure_port: string;
  readonly arrival_port: string;
  readonly departure_date: string;
  readonly arrival_date: string;
  readonly distance_nm: number | null;
  readonly fuel_type: string;
  readonly fuel_consumption_mt: number;
  readonly co2_tonnes: number;
  readonly voyage_type: string;
  readonly data_quality: string;
}

// ── Report result ──────────────────────────────────────────────────────────

export interface MrvReportResult {
  readonly calculation_version: string;
  readonly parameter_version: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly status: string;

  readonly completeness_status: MrvCompletenessStatus;
  readonly completeness_checks: ReadonlyArray<MrvCompletenessCheck>;
  readonly blocking_issues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;

  readonly total_voyages: number;
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly monitoring_plan_version: string | null;
  readonly methodology: string;

  readonly voyage_entries: ReadonlyArray<MrvVoyageEntry>;
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
  readonly generated_at?: string;
}
