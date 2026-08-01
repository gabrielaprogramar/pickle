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
  readonly gross_tonnage: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a vessel. Server-managed columns omitted. */
export type VesselInsert = {
  readonly imo: string;
  readonly name: string;
  readonly mmsi?: string | null;
  readonly ship_id?: string | null;
  readonly gross_tonnage?: number | null;
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

/** Document source channel. Controlled by documents_source_channel_check. */
export type DocumentSourceChannel = "MANUAL" | "EMAIL";

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
  readonly source_channel: DocumentSourceChannel;
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
  readonly source_channel?: DocumentSourceChannel;
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
  readonly reason_code: string | null;
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
  readonly reason_code?: string | null;
};

// ── 1c. OCR QUALITY / REVIEW ROW TYPES (1:1 with migration 0015) ────────────

/** OCR quality level. Controlled by ocr_quality_scores_level_check. */
export type OcrQualityLevel = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

/** OCR repair suggestion kind. Controlled by ocr_review_suggestions_kind_check. */
export type OcrReviewSuggestionKind =
  | "IMO_CHECKSUM"
  | "DATE_FORMAT"
  | "FUEL_SPELLING"
  | "PORT_SPELLING"
  | "CERTIFICATE_NUMBER_SPACING"
  | "MERGED_CHARACTERS";

/** Review priority at suggestion time. Controlled by ocr_review_suggestions_priority_check. */
export type OcrReviewSuggestionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Suggestion workflow state. Controlled by ocr_review_suggestions_status_check. */
export type OcrReviewSuggestionStatus = "open" | "accepted" | "rejected" | "resolved";

/** One row of the `ocr_quality_scores` table. */
export type OcrQualityScoreRow = {
  readonly id: string;
  readonly ocr_result_id: string;
  readonly document_id: string;
  readonly detected_family: string;
  readonly overall_quality_score: number;
  readonly level: OcrQualityLevel;
  readonly page_quality: number;
  readonly text_coverage: number;
  readonly field_coverage: number;
  readonly confidence_score: number;
  readonly confidence_distribution: Record<string, number>;
  readonly issues: unknown[];
  readonly missing_mandatory_fields: string[];
  readonly created_at: string;
};

/** Payload for inserting an OCR quality score. id/created_at are server-defaulted. */
export type OcrQualityScoreInsert = {
  readonly ocr_result_id: string;
  readonly document_id: string;
  readonly detected_family: string;
  readonly overall_quality_score: number;
  readonly level: OcrQualityLevel;
  readonly page_quality: number;
  readonly text_coverage: number;
  readonly field_coverage: number;
  readonly confidence_score: number;
  readonly confidence_distribution: Record<string, number>;
  readonly issues: unknown[];
  readonly missing_mandatory_fields: string[];
};

/** One row of the `ocr_review_suggestions` table. */
export type OcrReviewSuggestionRow = {
  readonly id: string;
  readonly ocr_result_id: string;
  readonly document_id: string;
  readonly field_key: string;
  readonly kind: OcrReviewSuggestionKind;
  readonly original_value: string;
  readonly suggested_value: string;
  readonly confidence: number;
  readonly reason: string;
  readonly priority: OcrReviewSuggestionPriority;
  readonly status: OcrReviewSuggestionStatus;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting an OCR review suggestion. id/created_at/updated_at are server-defaulted. */
export type OcrReviewSuggestionInsert = {
  readonly ocr_result_id: string;
  readonly document_id: string;
  readonly field_key: string;
  readonly kind: OcrReviewSuggestionKind;
  readonly original_value: string;
  readonly suggested_value: string;
  readonly confidence: number;
  readonly reason: string;
  readonly priority: OcrReviewSuggestionPriority;
  readonly status?: OcrReviewSuggestionStatus;
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

// ── 1p. EMAIL INGESTION LOG ROW TYPES (1:1 with migration 0010) ─────────────

/** Email ingestion event type. Controlled by email_ingestion_log_event_check. */
export type EmailIngestionEvent =
  | "EMAIL_RECEIVED"
  | "ATTACHMENT_ACCEPTED"
  | "ATTACHMENT_REJECTED"
  | "DUPLICATE_DETECTED"
  | "DOCUMENT_CREATED"
  | "PROCESSING_QUEUED"
  | "PROCESSING_STARTED"
  | "PROCESSING_FAILED";

/** One row of the `email_ingestion_log` table. */
export type EmailIngestionLogRow = {
  readonly id: string;
  readonly message_id: string;
  readonly sender: string;
  readonly recipient: string;
  readonly subject: string | null;
  readonly imo: string | null;
  readonly vessel_id: string | null;
  readonly document_id: string | null;
  readonly event: EmailIngestionEvent;
  readonly details: Record<string, unknown> | null;
  readonly created_at: string;
};

/** Payload for inserting an email ingestion log entry. id/created_at are server-defaulted. */
export type EmailIngestionLogInsert = {
  readonly message_id: string;
  readonly sender: string;
  readonly recipient: string;
  readonly subject?: string | null;
  readonly imo?: string | null;
  readonly vessel_id?: string | null;
  readonly document_id?: string | null;
  readonly event: EmailIngestionEvent;
  readonly details?: Record<string, unknown> | null;
};

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

// ── 1i. EU ETS RECORDS ROW TYPES (1:1 with migration 0008) ────────────────────

/** One row of the `eu_ets_records` table. */
export type EuEtsRecordRow = {
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
};

/** Payload for inserting an EU ETS record. id/created_at/updated_at are server-defaulted. */
export type EuEtsRecordInsert = {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly calculation_version: string;
  readonly gt?: number | null;
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
};

// ── 1j. MRV REPORTS ROW TYPES (1:1 with migration 0008) ───────────────────────

/** One row of the `mrv_reports` table. */
export type MrvReportRow = {
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
};

/** Payload for inserting an MRV report. id/created_at/updated_at are server-defaulted. */
export type MrvReportInsert = {
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
};

// ── 1k. ENVIRONMENTAL ZONE ROW TYPES (1:1 with migration 0009) ─────────────

export type EnvironmentalZoneRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly geometry_type: string;
  readonly geometry_coordinates: unknown;
  readonly description: string | null;
  readonly regulation_reference: string | null;
  readonly geometry_version: string;
  readonly jurisdiction: string | null;
  readonly effective_from: string;
  readonly effective_until: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type EnvironmentalZoneInsert = {
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly geometry_type: string;
  readonly geometry_coordinates: unknown;
  readonly description?: string | null;
  readonly regulation_reference?: string | null;
  readonly geometry_version?: string;
  readonly jurisdiction?: string | null;
  readonly effective_from: string;
  readonly effective_until?: string | null;
  readonly is_active?: boolean;
};

// ── 1l. PORT CALL ROW TYPES (1:1 with migration 0009) ──────────────────────

export type PortCallRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly port_name: string;
  readonly port_id: string | null;
  readonly port_country: string | null;
  readonly port_latitude: number | null;
  readonly port_longitude: number | null;
  readonly arr_ts: string | null;
  readonly dep_ts: string | null;
  readonly is_mock: boolean;
  readonly source: string;
  readonly source_fetched_at: string | null;
  readonly created_at: string;
};

export type PortCallInsert = {
  readonly vessel_id: string;
  readonly voyage_id?: string | null;
  readonly port_name: string;
  readonly port_id?: string | null;
  readonly port_country?: string | null;
  readonly port_latitude?: number | null;
  readonly port_longitude?: number | null;
  readonly arr_ts?: string | null;
  readonly dep_ts?: string | null;
  readonly is_mock?: boolean;
  readonly source?: string;
  readonly source_fetched_at?: string | null;
};

// ── 1m. ZONE EVENT ROW TYPES (1:1 with migration 0009) ────────────────────

export type ZoneEventRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly zone_id: string;
  readonly event_type: string;
  readonly ais_position_id: string | null;
  readonly detected_at: string;
  readonly entry_ts: string | null;
  readonly exit_ts: string | null;
  readonly duration_minutes: number | null;
  readonly coordinates: unknown;
  readonly details: unknown;
  readonly calculation_version: string;
  readonly created_at: string;
};

export type ZoneEventInsert = {
  readonly vessel_id: string;
  readonly zone_id: string;
  readonly event_type: string;
  readonly ais_position_id?: string | null;
  readonly detected_at: string;
  readonly entry_ts?: string | null;
  readonly exit_ts?: string | null;
  readonly duration_minutes?: number | null;
  readonly coordinates?: unknown;
  readonly details?: unknown;
  readonly calculation_version?: string;
};

// ── 1n. VESSEL TRACK ROW TYPES (1:1 with migration 0009) ───────────────────

export type VesselTrackRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly track: unknown;
  readonly point_count: number;
  readonly distance_nm: number | null;
  readonly start_ts: string;
  readonly end_ts: string;
  readonly calculation_version: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type VesselTrackInsert = {
  readonly vessel_id: string;
  readonly voyage_id?: string | null;
  readonly track: unknown;
  readonly point_count: number;
  readonly distance_nm?: number | null;
  readonly start_ts: string;
  readonly end_ts: string;
  readonly calculation_version?: string;
};

// ── 1o. MAP CONFIG ROW TYPES (1:1 with migration 0009) ─────────────────────

export type MapConfigRow = {
  readonly id: string;
  readonly provider: string;
  readonly tile_url: string | null;
  readonly tile_attribution: string | null;
  readonly default_center_lat: number;
  readonly default_center_lng: number;
  readonly default_zoom: number;
  readonly min_zoom: number;
  readonly max_zoom: number;
  readonly is_mock: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type MapConfigInsert = {
  readonly provider?: string;
  readonly tile_url?: string | null;
  readonly tile_attribution?: string | null;
  readonly default_center_lat?: number;
  readonly default_center_lng?: number;
  readonly default_zoom?: number;
  readonly min_zoom?: number;
  readonly max_zoom?: number;
  readonly is_mock?: boolean;
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

// ── 1r. SOX ECA COMPLIANCE ROW TYPES (1:1 with migration 0013) ──────────────

/** One row of the `sox_compliance_events` table (append-only). */
export type SoxComplianceEventRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: string;
  readonly zone_state: string;
  readonly watch_status: string;
  readonly severity: string;
  readonly rule_id: string | null;
  readonly rule_result: unknown;
  readonly evidence_status: string | null;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly ais_position_id: string | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly calculation_version: string;
  readonly details: unknown;
  readonly dedup_key: string | null;
  readonly created_at: string;
};

/** Payload for inserting a compliance event. id/created_at are server-defaulted. */
export type SoxComplianceEventInsert = {
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: string;
  readonly zone_state: string;
  readonly watch_status: string;
  readonly severity: string;
  readonly rule_id?: string | null;
  readonly rule_result?: unknown;
  readonly evidence_status?: string | null;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly ais_position_id?: string | null;
  readonly applicable_limit_pct?: number | null;
  readonly sulphur_content_pct?: number | null;
  readonly selected_delivery_id?: string | null;
  readonly parameter_version: string;
  readonly geometry_version?: string | null;
  readonly calculation_version: string;
  readonly details?: unknown;
  readonly dedup_key?: string | null;
};

/** One row of the `sox_watch_state` table (current snapshot per vessel). */
export type SoxWatchStateRow = {
  readonly vessel_id: string;
  readonly imo: string;
  readonly status: string;
  readonly severity: string;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly zone_state: string;
  readonly evidence_status: string | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly last_entry_ts: string | null;
  readonly last_exit_ts: string | null;
  readonly latest_event_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly review_required: boolean;
  readonly last_evaluated_at: string;
  readonly updated_at: string;
};

/** Payload for upserting watch state. updated_at is server-managed. */
export type SoxWatchStateInsert = {
  readonly vessel_id: string;
  readonly imo: string;
  readonly status: string;
  readonly severity: string;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly zone_state: string;
  readonly evidence_status?: string | null;
  readonly applicable_limit_pct?: number | null;
  readonly sulphur_content_pct?: number | null;
  readonly selected_delivery_id?: string | null;
  readonly last_entry_ts?: string | null;
  readonly last_exit_ts?: string | null;
  readonly latest_event_id?: string | null;
  readonly parameter_version: string;
  readonly geometry_version?: string | null;
  readonly review_required: boolean;
  readonly last_evaluated_at: string;
};

// ── 1s. CERTIFICATE REGISTRY ROW TYPES (1:1 with migration 0014) ────────────

/** One row of the `certificate_registry` table (current or historical). */
export type CertificateRegistryRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly document_id: string | null;
  readonly certificate_type: string;
  readonly certificate_number: string | null;
  readonly issuing_authority: string | null;
  readonly class_society: string | null;
  readonly issue_date: string | null;
  readonly expiry_date: string | null;
  readonly status: string;
  readonly source: string;
  readonly validation_status: string | null;
  readonly review_status: string | null;
  readonly review_required: boolean;
  readonly blocking: boolean;
  readonly reason_code: string | null;
  readonly confidence: number | null;
  readonly notes: string | null;
  readonly version: number;
  readonly supersedes_id: string | null;
  readonly is_current: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a certificate record. id/version/created_at/updated_at are server-defaulted. */
export type CertificateRegistryInsert = {
  readonly vessel_id: string;
  readonly imo: string;
  readonly document_id?: string | null;
  readonly certificate_type: string;
  readonly certificate_number?: string | null;
  readonly issuing_authority?: string | null;
  readonly class_society?: string | null;
  readonly issue_date?: string | null;
  readonly expiry_date?: string | null;
  readonly status: string;
  readonly source: string;
  readonly validation_status?: string | null;
  readonly review_status?: string | null;
  readonly review_required?: boolean;
  readonly blocking?: boolean;
  readonly reason_code?: string | null;
  readonly confidence?: number | null;
  readonly notes?: string | null;
  readonly version?: number;
  readonly supersedes_id?: string | null;
  readonly is_current?: boolean;
};

/** One row of the `certificate_registry_events` table (append-only). */
export type CertificateRegistryEventRow = {
  readonly id: string;
  readonly certificate_id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: string;
  readonly severity: string;
  readonly previous_status: string | null;
  readonly new_status: string | null;
  readonly reason_code: string | null;
  readonly details: unknown;
  readonly dedup_key: string | null;
  readonly created_at: string;
};

/** Payload for inserting a certificate registry event. id/created_at are server-defaulted. */
export type CertificateRegistryEventInsert = {
  readonly certificate_id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: string;
  readonly severity: string;
  readonly previous_status?: string | null;
  readonly new_status?: string | null;
  readonly reason_code?: string | null;
  readonly details?: unknown;
  readonly dedup_key?: string | null;
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
// ── 1h. REPORTING + NOTIFICATION ROW TYPES (1:1 with migration 0011) ────────

/** Report type classification. Controlled by compliance_reports_type_check. */
export type ReportType =
  | "thetis_mrv"
  | "fueleu"
  | "green_zone"
  | "fleet_summary"
  | "esg_package";

/** Report lifecycle status. Controlled by compliance_reports_status_check. */
export type ReportStatus =
  | "DRAFT"
  | "READY"
  | "GENERATED"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "FAILED";

/** One row of the `compliance_reports` table. */
export type ReportRow = {
  readonly id: string;
  readonly report_type: ReportType;
  readonly vessel_id: string | null;
  readonly vessel_ids: Record<string, unknown> | null;
  readonly title: string;
  readonly reporting_year: number;
  readonly season: string | null;
  readonly status: ReportStatus;
  readonly calculation_version: string | null;
  readonly source_data_refs: Record<string, unknown> | null;
  readonly storage_path: string | null;
  readonly file_size: number | null;
  readonly checksum: string | null;
  readonly content: Record<string, unknown> | null;
  readonly generated_at: string | null;
  readonly generated_by: string | null;
  readonly submitted_at: string | null;
  readonly verified_at: string | null;
  readonly verification_notes: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a compliance report. id/created_at/updated_at are server-defaulted. */
export type ReportInsert = {
  readonly report_type: ReportType;
  readonly vessel_id?: string | null;
  readonly vessel_ids?: Record<string, unknown> | null;
  readonly title: string;
  readonly reporting_year: number;
  readonly season?: string | null;
  readonly status?: ReportStatus;
  readonly calculation_version?: string | null;
  readonly source_data_refs?: Record<string, unknown> | null;
  readonly storage_path?: string | null;
  readonly file_size?: number | null;
  readonly checksum?: string | null;
  readonly content?: Record<string, unknown> | null;
  readonly generated_at?: string | null;
  readonly generated_by?: string | null;
  readonly submitted_at?: string | null;
  readonly verified_at?: string | null;
  readonly verification_notes?: string | null;
  readonly metadata?: Record<string, unknown>;
};

/** Verifier package lifecycle status. Controlled by verifier_packages_status_check. */
export type VerifierPackageStatus = "DRAFT" | "GENERATING" | "GENERATED" | "FAILED";

/** One row of the `verifier_packages` table. */
export type VerifierPackageRow = {
  readonly id: string;
  readonly vessel_id: string | null;
  readonly reporting_year: number;
  readonly status: VerifierPackageStatus;
  readonly title: string;
  readonly manifest: Record<string, unknown>;
  readonly storage_path: string | null;
  readonly file_size: number | null;
  readonly checksum: string | null;
  readonly package_version: string;
  readonly validation_result: Record<string, unknown> | null;
  readonly generated_at: string | null;
  readonly generated_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a verifier package. id/created_at/updated_at are server-defaulted. */
export type VerifierPackageInsert = {
  readonly vessel_id?: string | null;
  readonly reporting_year: number;
  readonly status?: VerifierPackageStatus;
  readonly title: string;
  readonly manifest?: Record<string, unknown>;
  readonly storage_path?: string | null;
  readonly file_size?: number | null;
  readonly checksum?: string | null;
  readonly package_version?: string;
  readonly validation_result?: Record<string, unknown> | null;
  readonly generated_at?: string | null;
  readonly generated_by?: string | null;
};

/** Notification severity level. Controlled by notifications_severity_check. */
export type NotificationSeverity = "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";

/** One row of the `notifications` table. */
export type NotificationRow = {
  readonly id: string;
  readonly recipient_id: string;
  readonly notification_type: string;
  readonly severity: NotificationSeverity;
  readonly vessel_id: string | null;
  readonly organization_id: string | null;
  readonly title: string;
  readonly message: string;
  readonly payload: Record<string, unknown> | null;
  readonly is_read: boolean;
  readonly read_at: string | null;
  readonly source_event: string | null;
  readonly source_id: string | null;
  readonly created_at: string;
};

/** Payload for inserting a notification. id/created_at are server-defaulted. */
export type NotificationInsert = {
  readonly recipient_id: string;
  readonly notification_type: string;
  readonly severity: NotificationSeverity;
  readonly vessel_id?: string | null;
  readonly organization_id?: string | null;
  readonly title: string;
  readonly message: string;
  readonly payload?: Record<string, unknown> | null;
  readonly is_read?: boolean;
  readonly read_at?: string | null;
  readonly source_event?: string | null;
  readonly source_id?: string | null;
};

/** One row of the `notification_preferences` table. */
export type NotificationPreferenceRow = {
  readonly id: string;
  readonly recipient_id: string;
  readonly notification_type: string | null;
  readonly enabled: boolean;
  readonly email_enabled: boolean;
  readonly in_app_enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a notification preference. id/created_at/updated_at are server-defaulted. */
export type NotificationPreferenceInsert = {
  readonly recipient_id: string;
  readonly notification_type?: string | null;
  readonly enabled?: boolean;
  readonly email_enabled?: boolean;
  readonly in_app_enabled?: boolean;
};

// ── 1q. AI ASSISTANT ROW TYPES (Phase 3A) ──────────────────────────────────

/** Knowledge source document type classification. */
export type KnowledgeSource =
  | "eu_ets_directive"
  | "fueleu_regulation"
  | "thetis_mrv_guidance"
  | "marpol_annex_vi"
  | "fueleu_guidance"
  | "poseidon_policy";

/** Knowledge regulation classification. */
export type KnowledgeRegulation =
  | "EU_ETS"
  | "FuelEU"
  | "THETIS_MRV"
  | "MARPOL"
  | "POSEIDON";

/** One row of the `knowledge_documents` table. */
export type KnowledgeDocumentRow = {
  readonly id: string;
  readonly source: KnowledgeSource;
  readonly regulation: KnowledgeRegulation;
  readonly title: string;
  readonly article_section: string | null;
  readonly effective_date: string | null;
  readonly version: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting a knowledge document. id/created_at/updated_at are server-defaulted. */
export type KnowledgeDocumentInsert = {
  readonly source: KnowledgeSource;
  readonly regulation: KnowledgeRegulation;
  readonly title: string;
  readonly article_section?: string | null;
  readonly effective_date?: string | null;
  readonly version?: string;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
};

/** One row of the `knowledge_chunks` table. */
export type KnowledgeChunkRow = {
  readonly id: string;
  readonly document_id: string;
  readonly chunk_index: number;
  readonly content: string;
  readonly article_section: string | null;
  readonly heading: string | null;
  readonly embedding: unknown | null;
  readonly token_count: number | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
};

/** Payload for inserting a knowledge chunk. id/created_at are server-defaulted. */
export type KnowledgeChunkInsert = {
  readonly document_id: string;
  readonly chunk_index: number;
  readonly content: string;
  readonly article_section?: string | null;
  readonly heading?: string | null;
  readonly embedding?: unknown | null;
  readonly token_count?: number | null;
  readonly metadata?: Record<string, unknown>;
};

/** Conversation lifecycle status. */
export type ConversationStatus = "ACTIVE" | "ARCHIVED" | "DELETED";

/** One row of the `assistant_conversations` table. */
export type AssistantConversationRow = {
  readonly id: string;
  readonly user_id: string;
  readonly organization_id: string | null;
  readonly title: string;
  readonly model_id: string;
  readonly prompt_version: string;
  readonly status: ConversationStatus;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
};

/** Payload for inserting an assistant conversation. id/created_at/updated_at are server-defaulted. */
export type AssistantConversationInsert = {
  readonly user_id: string;
  readonly organization_id?: string | null;
  readonly title?: string;
  readonly model_id?: string;
  readonly prompt_version?: string;
  readonly status?: ConversationStatus;
  readonly metadata?: Record<string, unknown>;
};

/** Message role classification. */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/** Tool call execution status. */
export type ToolStatus = "pending" | "running" | "success" | "error";

/** One row of the `assistant_messages` table. */
export type AssistantMessageRow = {
  readonly id: string;
  readonly conversation_id: string;
  readonly role: MessageRole;
  readonly content: string | null;
  readonly tool_call_id: string | null;
  readonly tool_name: string | null;
  readonly tool_input: Record<string, unknown> | null;
  readonly tool_output: Record<string, unknown> | null;
  readonly tool_status: string | null;
  readonly citations: Array<Record<string, unknown>>;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
};

/** Payload for inserting an assistant message. id/created_at are server-defaulted. */
export type AssistantMessageInsert = {
  readonly conversation_id: string;
  readonly role: MessageRole;
  readonly content?: string | null;
  readonly tool_call_id?: string | null;
  readonly tool_name?: string | null;
  readonly tool_input?: Record<string, unknown> | null;
  readonly tool_output?: Record<string, unknown> | null;
  readonly tool_status?: string | null;
  readonly citations?: Array<Record<string, unknown>>;
  readonly metadata?: Record<string, unknown>;
};

/** One row of the `assistant_tool_calls` table. */
export type AssistantToolCallRow = {
  readonly id: string;
  readonly conversation_id: string;
  readonly message_id: string | null;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_output: Record<string, unknown> | null;
  readonly success: boolean;
  readonly error_message: string | null;
  readonly latency_ms: number | null;
  readonly permission_granted: boolean;
  readonly created_at: string;
};

/** Payload for inserting an assistant tool call. id/created_at are server-defaulted. */
export type AssistantToolCallInsert = {
  readonly conversation_id: string;
  readonly message_id?: string | null;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_output?: Record<string, unknown> | null;
  readonly success?: boolean;
  readonly error_message?: string | null;
  readonly latency_ms?: number | null;
  readonly permission_granted?: boolean;
};

/** One row of the `assistant_evaluation_log` table. */
export type AssistantEvaluationLogRow = {
  readonly id: string;
  readonly test_name: string;
  readonly assistant_type: string;
  readonly query: string;
  readonly response: string | null;
  readonly citation_accuracy: number | null;
  readonly retrieval_precision: number | null;
  readonly hallucination_flag: boolean;
  readonly tool_selection_accuracy: number | null;
  readonly response_latency_ms: number | null;
  readonly no_math_leak_violation: boolean;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
};

/** Payload for inserting an evaluation log entry. id/created_at are server-defaulted. */
export type AssistantEvaluationLogInsert = {
  readonly test_name: string;
  readonly assistant_type?: string;
  readonly query: string;
  readonly response?: string | null;
  readonly citation_accuracy?: number | null;
  readonly retrieval_precision?: number | null;
  readonly hallucination_flag?: boolean;
  readonly tool_selection_accuracy?: number | null;
  readonly response_latency_ms?: number | null;
  readonly no_math_leak_violation?: boolean;
  readonly metadata?: Record<string, unknown>;
};

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
      eu_ets_records: {
        Row: EuEtsRecordRow;
        Insert: EuEtsRecordInsert;
        Update: Partial<EuEtsRecordInsert>;
        Relationships: Relationships;
      };
      mrv_reports: {
        Row: MrvReportRow;
        Insert: MrvReportInsert;
        Update: Partial<MrvReportInsert>;
        Relationships: Relationships;
      };
      environmental_zones: {
        Row: EnvironmentalZoneRow;
        Insert: EnvironmentalZoneInsert;
        Update: Partial<EnvironmentalZoneInsert>;
        Relationships: Relationships;
      };
      port_calls: {
        Row: PortCallRow;
        Insert: PortCallInsert;
        Update: Partial<PortCallInsert>;
        Relationships: Relationships;
      };
      zone_events: {
        Row: ZoneEventRow;
        Insert: ZoneEventInsert;
        Update: Partial<ZoneEventInsert>;
        Relationships: Relationships;
      };
      vessel_tracks: {
        Row: VesselTrackRow;
        Insert: VesselTrackInsert;
        Update: Partial<VesselTrackInsert>;
        Relationships: Relationships;
      };
      map_config: {
        Row: MapConfigRow;
        Insert: MapConfigInsert;
        Update: Partial<MapConfigInsert>;
        Relationships: Relationships;
      };
      email_ingestion_log: {
        Row: EmailIngestionLogRow;
        Insert: EmailIngestionLogInsert;
        Update: Partial<EmailIngestionLogInsert>;
        Relationships: Relationships;
      };
      compliance_reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: Partial<ReportInsert>;
        Relationships: Relationships;
      };
      verifier_packages: {
        Row: VerifierPackageRow;
        Insert: VerifierPackageInsert;
        Update: Partial<VerifierPackageInsert>;
        Relationships: Relationships;
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
        Relationships: Relationships;
      };
      notification_preferences: {
        Row: NotificationPreferenceRow;
        Insert: NotificationPreferenceInsert;
        Update: Partial<NotificationPreferenceInsert>;
        Relationships: Relationships;
      };
      knowledge_documents: {
        Row: KnowledgeDocumentRow;
        Insert: KnowledgeDocumentInsert;
        Update: Partial<KnowledgeDocumentInsert>;
        Relationships: Relationships;
      };
      knowledge_chunks: {
        Row: KnowledgeChunkRow;
        Insert: KnowledgeChunkInsert;
        Update: Partial<KnowledgeChunkInsert>;
        Relationships: Relationships;
      };
      assistant_conversations: {
        Row: AssistantConversationRow;
        Insert: AssistantConversationInsert;
        Update: Partial<AssistantConversationInsert>;
        Relationships: Relationships;
      };
      assistant_messages: {
        Row: AssistantMessageRow;
        Insert: AssistantMessageInsert;
        Update: Partial<AssistantMessageInsert>;
        Relationships: Relationships;
      };
      assistant_tool_calls: {
        Row: AssistantToolCallRow;
        Insert: AssistantToolCallInsert;
        Update: Partial<AssistantToolCallInsert>;
        Relationships: Relationships;
      };
      assistant_evaluation_log: {
        Row: AssistantEvaluationLogRow;
        Insert: AssistantEvaluationLogInsert;
        Update: Partial<AssistantEvaluationLogInsert>;
        Relationships: Relationships;
      };
      sox_compliance_events: {
        Row: SoxComplianceEventRow;
        Insert: SoxComplianceEventInsert;
        Update: Partial<SoxComplianceEventInsert>;
        Relationships: Relationships;
      };
      sox_watch_state: {
        Row: SoxWatchStateRow;
        Insert: SoxWatchStateInsert;
        Update: Partial<SoxWatchStateInsert>;
        Relationships: Relationships;
      };
      certificate_registry: {
        Row: CertificateRegistryRow;
        Insert: CertificateRegistryInsert;
        Update: Partial<CertificateRegistryInsert>;
        Relationships: Relationships;
      };
      certificate_registry_events: {
        Row: CertificateRegistryEventRow;
        Insert: CertificateRegistryEventInsert;
        Update: Partial<CertificateRegistryEventInsert>;
        Relationships: Relationships;
      };
      ocr_quality_scores: {
        Row: OcrQualityScoreRow;
        Insert: OcrQualityScoreInsert;
        Update: Partial<OcrQualityScoreInsert>;
        Relationships: Relationships;
      };
      ocr_review_suggestions: {
        Row: OcrReviewSuggestionRow;
        Insert: OcrReviewSuggestionInsert;
        Update: Partial<OcrReviewSuggestionInsert>;
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
