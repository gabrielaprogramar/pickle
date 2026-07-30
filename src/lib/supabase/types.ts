/**
 * types.ts — database row types + generated-style Database interface
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Two layers, mirroring the MarineTraffic module's approach:
 *
 *   1. Row types (VesselRow, VoyageRow, AisPositionRow) — EXACT mirrors of the
 *      columns defined in supabase/migrations/0001_init_ais_schema.sql. If the
 *      migration changes, change these here too. This is the only file that
 *      knows the physical column shape.
 *
 *   2. The `Database` interface — the shape @supabase/supabase-js uses for
 *      end-to-end type safety via `createClient<Database>()`. It follows the
 *      format the official Supabase CLI generates (`supabase gen types`), so a
 *      real generated file can replace this one verbatim later without changing
 *      a single downstream type.
 *
 * HOW IT FITS
 * client.ts creates `SupabaseClient<Database>`, giving every repository
 * compile-time-checked table/column names. Repositories never hand raw rows to
 * the app — they map to clean domain types in mapper.ts.
 */

// ── 1. ROW TYPES (1:1 with the migration) ────────────────────────────────────

/** One row of the `vessels` table. */
export type VesselRow = {
  readonly id: string;
  readonly imo: string;
  readonly name: string;
  readonly mmsi: string | null;
  readonly ship_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a vessel. Server-managed columns omitted. */
export type VesselInsert = {
  readonly imo: string;
  readonly name: string;
  readonly mmsi?: string | null;
  readonly ship_id?: string | null;
};

/** One row of the `voyages` table. */
export type VoyageRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly source_fetched_at: string;
  readonly source_is_mock: boolean;
  readonly departure_port_name: string;
  readonly departure_port_id: string | null;
  readonly departure_time: string | null;
  readonly arrival_port_name: string;
  readonly arrival_port_id: string | null;
  readonly arrival_time: string | null;
  readonly distance_nm: number | null;
  readonly created_at: string;
};

/** Payload for inserting a voyage. id/created_at are server-defaulted. */
export type VoyageInsert = {
  readonly vessel_id: string;
  readonly source_fetched_at: string;
  readonly source_is_mock: boolean;
  readonly departure_port_name: string;
  readonly departure_port_id?: string | null;
  readonly departure_time?: string | null;
  readonly arrival_port_name: string;
  readonly arrival_port_id?: string | null;
  readonly arrival_time?: string | null;
  readonly distance_nm?: number | null;
};

/** One row of the `ais_positions` table. */
export type AisPositionRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly ts: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sog: number | null;
  readonly cog: number | null;
  readonly heading: number | null;
  readonly nav_status: string | null;
  readonly created_at: string;
};

/** Payload for inserting a position. id/created_at are server-defaulted. */
export type AisPositionInsert = {
  readonly vessel_id: string;
  readonly ts: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sog?: number | null;
  readonly cog?: number | null;
  readonly heading?: number | null;
  readonly nav_status?: string | null;
};

// ── 1b. DOCUMENT DOMAIN UNION TYPES ────────────────────────────────────────

/** Document type classification. Controlled by documents_type_check in the DB. */
export type DocumentType =
  | "bdn"
  | "imo_dcs"
  | "eu_mrv"
  | "certificate"
  | "report"
  | "correspondence"
  | "logbook"
  | "other";

/** Document processing lifecycle status. Controlled by documents_status_check. */
export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "ocr_complete"
  | "extracted"
  | "under_review"
  | "approved"
  | "rejected"
  | "archived";

/** Processing job type. Controlled by processing_jobs_type_check. */
export type ProcessingJobType =
  | "ocr"
  | "entity_extraction"
  | "validation"
  | "classification";

/** Processing job lifecycle status. Controlled by processing_jobs_status_check. */
export type ProcessingJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Processing log severity level. Controlled by processing_logs_level_check. */
export type ProcessingLogLevel = "debug" | "info" | "warning" | "error";

/** Review task lifecycle status. Controlled by review_tasks_status_check. */
export type ReviewTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

/** Review task priority. Controlled by review_tasks_priority_check. */
export type ReviewTaskPriority = "low" | "normal" | "high" | "urgent";

/** Document relationship type. Controlled by document_relationships_type_check. */
export type DocumentRelationshipType =
  | "supersedes"
  | "amends"
  | "references"
  | "requires"
  | "attached_to";

/** Document entity type. Controlled by document_entities_type_check. */
export type DocumentEntityType =
  | "imo_number"
  | "vessel_name"
  | "port"
  | "date"
  | "certificate_number"
  | "flag_state"
  | "measure"
  | "other";

// ── 1c. DOCUMENT ROW TYPES (1:1 with migration 0002) ─────────────────────

/** One row of the `documents` table. */
export type DocumentRow = {
  readonly id: string;
  readonly vessel_id: string | null;
  readonly document_type: DocumentType;
  readonly status: DocumentStatus;
  readonly title: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly file_size: number | null;
  readonly storage_path: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a document. id/created_at/updated_at are server-defaulted. */
export type DocumentInsert = {
  readonly vessel_id?: string | null;
  readonly document_type: DocumentType;
  readonly status?: DocumentStatus;
  readonly title: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly file_size?: number | null;
  readonly storage_path: string;
  readonly metadata?: Record<string, unknown> | null;
};

/** One row of the `document_versions` table. */
export type DocumentVersionRow = {
  readonly id: string;
  readonly document_id: string;
  readonly version_number: number;
  readonly filename: string;
  readonly storage_path: string;
  readonly file_size: number | null;
  readonly uploaded_by: string | null;
  readonly upload_note: string | null;
  readonly created_at: string;
};

/** Payload for inserting a document version. id/created_at are server-defaulted. */
export type DocumentVersionInsert = {
  readonly document_id: string;
  readonly version_number: number;
  readonly filename: string;
  readonly storage_path: string;
  readonly file_size?: number | null;
  readonly uploaded_by?: string | null;
  readonly upload_note?: string | null;
};

/** One row of the `processing_jobs` table. */
export type ProcessingJobRow = {
  readonly id: string;
  readonly document_id: string;
  readonly document_version_id: string | null;
  readonly job_type: ProcessingJobType;
  readonly status: ProcessingJobStatus;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly error_message: string | null;
  readonly result: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting a processing job. id/status/created_at are server-defaulted. */
export type ProcessingJobInsert = {
  readonly document_id: string;
  readonly document_version_id?: string | null;
  readonly job_type: ProcessingJobType;
  readonly status?: ProcessingJobStatus;
  readonly started_at?: string | null;
  readonly completed_at?: string | null;
  readonly error_message?: string | null;
  readonly result?: Record<string, unknown> | null;
};

/** One row of the `ocr_results` table. */
export type OcrResultRow = {
  readonly id: string;
  readonly processing_job_id: string;
  readonly document_id: string;
  readonly raw_text: string;
  readonly extracted_data: Record<string, unknown> | null;
  readonly confidence: number | null;
  readonly created_at: string;
};

/** Payload for inserting an OCR result. id/created_at are server-defaulted. */
export type OcrResultInsert = {
  readonly processing_job_id: string;
  readonly document_id: string;
  readonly raw_text: string;
  readonly extracted_data?: Record<string, unknown> | null;
  readonly confidence?: number | null;
};

/** One row of the `document_entities` table. */
export type DocumentEntityRow = {
  readonly id: string;
  readonly document_id: string;
  readonly ocr_result_id: string | null;
  readonly entity_type: DocumentEntityType;
  readonly entity_value: string;
  readonly confidence: number | null;
  readonly start_offset: number | null;
  readonly end_offset: number | null;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting a document entity. id/created_at are server-defaulted. */
export type DocumentEntityInsert = {
  readonly document_id: string;
  readonly ocr_result_id?: string | null;
  readonly entity_type: DocumentEntityType;
  readonly entity_value: string;
  readonly confidence?: number | null;
  readonly start_offset?: number | null;
  readonly end_offset?: number | null;
  readonly metadata?: Record<string, unknown> | null;
};

/** One row of the `processing_logs` table. */
export type ProcessingLogRow = {
  readonly id: string;
  readonly processing_job_id: string;
  readonly level: ProcessingLogLevel;
  readonly message: string;
  readonly details: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting a processing log. id/created_at are server-defaulted. */
export type ProcessingLogInsert = {
  readonly processing_job_id: string;
  readonly level: ProcessingLogLevel;
  readonly message: string;
  readonly details?: Record<string, unknown> | null;
};

/** One row of the `review_tasks` table. */
export type ReviewTaskRow = {
  readonly id: string;
  readonly document_id: string;
  readonly assigned_to: string | null;
  readonly status: ReviewTaskStatus;
  readonly priority: ReviewTaskPriority;
  readonly due_at: string | null;
  readonly completed_at: string | null;
  readonly review_note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a review task. id/created_at/updated_at are server-defaulted. */
export type ReviewTaskInsert = {
  readonly document_id: string;
  readonly assigned_to?: string | null;
  readonly status?: ReviewTaskStatus;
  readonly priority?: ReviewTaskPriority;
  readonly due_at?: string | null;
  readonly completed_at?: string | null;
  readonly review_note?: string | null;
};

/** One row of the `document_relationships` table. */
export type DocumentRelationshipRow = {
  readonly id: string;
  readonly source_document_id: string;
  readonly target_document_id: string;
  readonly relationship_type: DocumentRelationshipType;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting a document relationship. id/created_at are server-defaulted. */
export type DocumentRelationshipInsert = {
  readonly source_document_id: string;
  readonly target_document_id: string;
  readonly relationship_type: DocumentRelationshipType;
  readonly metadata?: Record<string, unknown> | null;
};

// ── 1d. AI EXTRACTION ROW TYPES (1:1 with migration 0003) ──────────────────

/** One row of the `ai_extractions` table. */
export type AiExtractionRow = {
  readonly id: string;
  readonly document_id: string;
  readonly ocr_result_id: string | null;
  readonly status: string;
  readonly confidence: number | null;
  readonly summary: string | null;
  readonly document_type: string;
  readonly fields: Record<string, unknown>;
  readonly warnings: string[];
  readonly missing_fields: string[];
  readonly provider: string;
  readonly model: string;
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
  readonly latency_ms: number | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting an AI extraction. id/created_at/updated_at are server-defaulted. */
export type AiExtractionInsert = {
  readonly document_id: string;
  readonly ocr_result_id?: string | null;
  readonly status?: string;
  readonly confidence?: number | null;
  readonly summary?: string | null;
  readonly document_type: string;
  readonly fields?: Record<string, unknown>;
  readonly warnings?: string[];
  readonly missing_fields?: string[];
  readonly provider?: string;
  readonly model?: string;
  readonly prompt_tokens?: number | null;
  readonly completion_tokens?: number | null;
  readonly total_tokens?: number | null;
  readonly latency_ms?: number | null;
  readonly error_message?: string | null;
};

// ── 1e. VALIDATION REPORT ROW TYPES (1:1 with migration 0004) ───────────────

/** One row of the `validation_reports` table. */
export type ValidationReportRow = {
  readonly id: string;
  readonly document_id: string;
  readonly extraction_id: string | null;
  readonly status: string;
  readonly score: number;
  readonly rule_results: unknown[];
  readonly passed_count: number;
  readonly failed_count: number;
  readonly error_count: number;
  readonly warning_count: number;
  readonly blocking_issues: string[];
  readonly recommended_review: string[];
  readonly ready_for_review: boolean;
  readonly validator_version: string;
  readonly latency_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a validation report. id/created_at/updated_at are server-defaulted. */
export type ValidationReportInsert = {
  readonly document_id: string;
  readonly extraction_id?: string | null;
  readonly status?: string;
  readonly score?: number;
  readonly rule_results?: unknown[];
  readonly passed_count?: number;
  readonly failed_count?: number;
  readonly error_count?: number;
  readonly warning_count?: number;
  readonly blocking_issues?: string[];
  readonly recommended_review?: string[];
  readonly ready_for_review?: boolean;
  readonly validator_version?: string;
  readonly latency_ms?: number | null;
};

// ── 1f. DOCUMENT ENUM EXTENSION ─────────────────────────────────────────────

/** Add "bdn" to the document type union. */
export type BdnDocumentType = "bdn";

// ── 1g. FUEL DELIVERY ROW TYPES (1:1 with migration 0006) ───────────────────

/** One row of the `fuel_types` reference table. */
export type FuelTypeRow = {
  readonly id: string;
  readonly display_name: string;
  readonly category: string;
  readonly description: string | null;
  readonly co2_factor: number;
  readonly sox_factor: number;
  readonly pm_factor: number;
  readonly density_default: number | null;
  readonly is_drop_in: boolean;
  readonly created_at: string;
};

/** Payload for inserting a fuel type. id/created_at are server-defaulted. */
export type FuelTypeInsert = {
  readonly id: string;
  readonly display_name: string;
  readonly category: string;
  readonly description?: string | null;
  readonly co2_factor: number;
  readonly sox_factor?: number;
  readonly pm_factor?: number;
  readonly density_default?: number | null;
  readonly is_drop_in?: boolean;
};

/** One row of the `fuel_deliveries` table. */
export type FuelDeliveryRow = {
  readonly id: string;
  readonly document_id: string;
  readonly ocr_result_id: string | null;
  readonly ai_extraction_id: string | null;
  readonly vessel_id: string;
  readonly supplier: string;
  readonly delivery_port: string;
  readonly delivery_date: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly density_kgm3: number | null;
  readonly sulphur_content_pct: number | null;
  readonly bdn_reference: string | null;
  readonly status: string;
  readonly reconciled_voyage_id: string | null;
  readonly reconciled_at: string | null;
  readonly notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a fuel delivery. id/created_at/updated_at are server-defaulted. */
export type FuelDeliveryInsert = {
  readonly document_id: string;
  readonly ocr_result_id?: string | null;
  readonly ai_extraction_id?: string | null;
  readonly vessel_id: string;
  readonly supplier: string;
  readonly delivery_port: string;
  readonly delivery_date: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly density_kgm3?: number | null;
  readonly sulphur_content_pct?: number | null;
  readonly bdn_reference?: string | null;
  readonly status?: string;
  readonly reconciled_voyage_id?: string | null;
  readonly reconciled_at?: string | null;
  readonly notes?: string | null;
};

// ── 1h. FUEL EU RECORDS ROW TYPES (1:1 with migration 0007) ───────────────────

/** One row of the `fuel_eu_records` table. */
export type FuelEuRecordRow = {
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
  readonly iscc_missing_details: unknown;
  readonly ops_energy_mj: number;
  readonly ops_data_available: boolean;
  readonly parameter_version: string;
  readonly calculation_details: Record<string, unknown>;
  readonly calculated_at: string;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a FuelEU record. id/created_at/updated_at are server-defaulted. */
export type FuelEuRecordInsert = {
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
};

/** One row of the `reconciliation_log` table. */
export type ReconciliationLogRow = {
  readonly id: string;
  readonly fuel_delivery_id: string;
  readonly voyage_id: string | null;
  readonly match_type: string;
  readonly match_confidence: number | null;
  readonly match_reason: string;
  readonly matched_by: string;
  readonly previous_status: string;
  readonly new_status: string;
  readonly details: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting a reconciliation log entry. id/created_at are server-defaulted. */
export type ReconciliationLogInsert = {
  readonly fuel_delivery_id: string;
  readonly voyage_id?: string | null;
  readonly match_type: string;
  readonly match_confidence?: number | null;
  readonly match_reason: string;
  readonly matched_by?: string;
  readonly previous_status: string;
  readonly new_status: string;
  readonly details?: Record<string, unknown> | null;
};

// ── 1f. REVIEW AUDIT LOG ROW TYPES (1:1 with migration 0005) ────────────────

/** One row of the `review_audit_log` table. */
export type ReviewAuditLogRow = {
  readonly id: string;
  readonly review_task_id: string;
  readonly field_name: string | null;
  readonly action: string;
  readonly previous_value: unknown | null;
  readonly new_value: unknown | null;
  readonly reviewer: string;
  readonly notes: string | null;
  readonly created_at: string;
};

/** Payload for inserting a review audit log entry. id/created_at are server-defaulted. */
export type ReviewAuditLogInsert = {
  readonly review_task_id: string;
  readonly field_name?: string | null;
  readonly action: string;
  readonly previous_value?: unknown | null;
  readonly new_value?: unknown | null;
  readonly reviewer: string;
  readonly notes?: string | null;
};

export interface PaginationOptions {
  readonly limit: number;
  readonly offset: number;
}

/** A page of results from a collection read. */
export interface Page<T> {
  readonly rows: readonly T[];
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 50;

export function normalizePagination(
  limit: number | undefined,
  offset: number | undefined,
): PaginationOptions {
  const safeLimit = Number.isFinite(limit) && (limit as number) > 0
    ? Math.min(Math.trunc(limit as number), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const safeOffset = Number.isFinite(offset) && (offset as number) > 0
    ? Math.trunc(offset as number)
    : 0;
  return { limit: safeLimit, offset: safeOffset };
}

// ── 2. DATABASE INTERFACE (Supabase generated-types shape) ───────────────────

/**
 * The structure `createClient<Database>()` consumes. Modeled on the output of
 * `supabase gen types --lang=typescript` so a generated file is a drop-in.
 * Enums/Functions/RPCs are omitted intentionally — Phase 1B uses plain tables.
 */
/**
 * Empty Relationships array placeholder. Every table in a generated Database
 * interface declares its foreign-key relationships; postgrest-js's GenericTable
 * type requires this field. Phase 1B declares the FKs in SQL (ON DELETE
 * CASCADE) but we don't surface them in the type layer yet — an empty array
 * satisfies the contract. A future generated types file will populate this.
 */
type Relationships = [];

export type Database = {
  public: {
    Tables: {
      vessels: {
        Row: VesselRow;
        Insert: VesselInsert;
        Update: Partial<VesselInsert>;
        Relationships: Relationships;
      };
      voyages: {
        Row: VoyageRow;
        Insert: VoyageInsert;
        Update: Partial<VoyageInsert>;
        Relationships: Relationships;
      };
      ais_positions: {
        Row: AisPositionRow;
        Insert: AisPositionInsert;
        Update: Partial<AisPositionInsert>;
        Relationships: Relationships;
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: Partial<DocumentInsert>;
        Relationships: Relationships;
      };
      document_versions: {
        Row: DocumentVersionRow;
        Insert: DocumentVersionInsert;
        Update: Partial<DocumentVersionInsert>;
        Relationships: Relationships;
      };
      processing_jobs: {
        Row: ProcessingJobRow;
        Insert: ProcessingJobInsert;
        Update: Partial<ProcessingJobInsert>;
        Relationships: Relationships;
      };
      ocr_results: {
        Row: OcrResultRow;
        Insert: OcrResultInsert;
        Update: Partial<OcrResultInsert>;
        Relationships: Relationships;
      };
      document_entities: {
        Row: DocumentEntityRow;
        Insert: DocumentEntityInsert;
        Update: Partial<DocumentEntityInsert>;
        Relationships: Relationships;
      };
      processing_logs: {
        Row: ProcessingLogRow;
        Insert: ProcessingLogInsert;
        Update: Partial<ProcessingLogInsert>;
        Relationships: Relationships;
      };
      review_tasks: {
        Row: ReviewTaskRow;
        Insert: ReviewTaskInsert;
        Update: Partial<ReviewTaskInsert>;
        Relationships: Relationships;
      };
      document_relationships: {
        Row: DocumentRelationshipRow;
        Insert: DocumentRelationshipInsert;
        Update: Partial<DocumentRelationshipInsert>;
        Relationships: Relationships;
      };
      ai_extractions: {
        Row: AiExtractionRow;
        Insert: AiExtractionInsert;
        Update: Partial<AiExtractionInsert>;
        Relationships: Relationships;
      };
      validation_reports: {
        Row: ValidationReportRow;
        Insert: ValidationReportInsert;
        Update: Partial<ValidationReportInsert>;
        Relationships: Relationships;
      };
      review_audit_log: {
        Row: ReviewAuditLogRow;
        Insert: ReviewAuditLogInsert;
        Update: Partial<ReviewAuditLogInsert>;
        Relationships: Relationships;
      };
      fuel_types: {
        Row: FuelTypeRow;
        Insert: FuelTypeInsert;
        Update: Partial<FuelTypeInsert>;
        Relationships: Relationships;
      };
      fuel_deliveries: {
        Row: FuelDeliveryRow;
        Insert: FuelDeliveryInsert;
        Update: Partial<FuelDeliveryInsert>;
        Relationships: Relationships;
      };
      reconciliation_log: {
        Row: ReconciliationLogRow;
        Insert: ReconciliationLogInsert;
        Update: Partial<ReconciliationLogInsert>;
        Relationships: Relationships;
      };
      fuel_eu_records: {
        Row: FuelEuRecordRow;
        Insert: FuelEuRecordInsert;
        Update: Partial<FuelEuRecordInsert>;
        Relationships: Relationships;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  // Required by supabase-js's DatabaseWithoutInternals<Database> pattern.
  // The generated types file always includes this; we declare it explicitly so
  // that Omit<Database, '__InternalSupabase'> resolves identically to the real
  // generated output. The PostgrestVersion must be a string literal matching
  // the version supabase-js expects (v2.110 defaults to "12").
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
}
