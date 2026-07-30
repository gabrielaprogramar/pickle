/**
 * schemas.ts — Zod validation schemas for document domain insert payloads
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The TypeScript types in types.ts provide compile-time safety. Zod schemas
 * provide RUNTIME validation — catching bad input before it reaches Supabase.
 * This is the single source of truth for what constitutes valid insert data;
 * the TypeScript row/insert types are derived from these schemas via z.infer.
 *
 * Every schema mirrors the corresponding CHECK constraints in migration 0002.
 * If the migration adds a new enum value or constraint, change it here first,
 * then update the migration.
 *
 * HOW IT FITS
 * The API route (Phase 2B) validates incoming request bodies against these
 * schemas. Repositories accept already-validated payloads (the TypeScript types)
 * so they never need to re-validate.
 */

import { z } from "zod";

// ── Enum literals (mirror CHECK constraints in migration 0002) ───────────────

export const DocumentTypeSchema = z.enum([
  "bdn",
  "imo_dcs",
  "eu_mrv",
  "certificate",
  "report",
  "correspondence",
  "logbook",
  "other",
]);

export const DocumentStatusSchema = z.enum([
  "uploaded",
  "processing",
  "ocr_complete",
  "extracted",
  "under_review",
  "approved",
  "rejected",
  "archived",
]);

export const ProcessingJobTypeSchema = z.enum([
  "ocr",
  "entity_extraction",
  "validation",
  "classification",
]);

export const ProcessingJobStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const ProcessingLogLevelSchema = z.enum([
  "debug",
  "info",
  "warning",
  "error",
]);

export const ReviewTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const ReviewTaskPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const DocumentRelationshipTypeSchema = z.enum([
  "supersedes",
  "amends",
  "references",
  "requires",
  "attached_to",
]);

export const DocumentEntityTypeSchema = z.enum([
  "imo_number",
  "vessel_name",
  "port",
  "date",
  "certificate_number",
  "flag_state",
  "measure",
  "other",
]);

// ── Insert schemas ──────────────────────────────────────────────────────────

export const DocumentInsertSchema = z.object({
  vessel_id: z.string().uuid().nullable().optional(),
  document_type: DocumentTypeSchema,
  status: DocumentStatusSchema.optional(),
  title: z.string().min(1).max(1024),
  filename: z.string().min(1).max(512),
  mime_type: z.string().min(1).max(255),
  file_size: z.number().int().nonnegative().nullable().optional(),
  storage_path: z.string().min(1).max(2048),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const DocumentVersionInsertSchema = z.object({
  document_id: z.string().uuid(),
  version_number: z.number().int().positive(),
  filename: z.string().min(1).max(512),
  storage_path: z.string().min(1).max(2048),
  file_size: z.number().int().nonnegative().nullable().optional(),
  uploaded_by: z.string().max(255).nullable().optional(),
  upload_note: z.string().max(2048).nullable().optional(),
});

export const ProcessingJobInsertSchema = z.object({
  document_id: z.string().uuid(),
  document_version_id: z.string().uuid().nullable().optional(),
  job_type: ProcessingJobTypeSchema,
  status: ProcessingJobStatusSchema.optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  error_message: z.string().max(4096).nullable().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const OcrResultInsertSchema = z.object({
  processing_job_id: z.string().uuid(),
  document_id: z.string().uuid(),
  raw_text: z.string().min(1),
  extracted_data: z.record(z.string(), z.unknown()).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const DocumentEntityInsertSchema = z.object({
  document_id: z.string().uuid(),
  ocr_result_id: z.string().uuid().nullable().optional(),
  entity_type: DocumentEntityTypeSchema,
  entity_value: z.string().min(1).max(4096),
  confidence: z.number().min(0).max(1).nullable().optional(),
  start_offset: z.number().int().nonnegative().nullable().optional(),
  end_offset: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const ProcessingLogInsertSchema = z.object({
  processing_job_id: z.string().uuid(),
  level: ProcessingLogLevelSchema,
  message: z.string().min(1).max(4096),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const ReviewTaskInsertSchema = z.object({
  document_id: z.string().uuid(),
  assigned_to: z.string().max(255).nullable().optional(),
  status: ReviewTaskStatusSchema.optional(),
  priority: ReviewTaskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  review_note: z.string().max(8192).nullable().optional(),
});

export const DocumentRelationshipInsertSchema = z.object({
  source_document_id: z.string().uuid(),
  target_document_id: z.string().uuid(),
  relationship_type: DocumentRelationshipTypeSchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

// ── AI Extraction insert schema ─────────────────────────────────────────────

export const AiExtractionInsertSchema = z.object({
  document_id: z.string().uuid(),
  ocr_result_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "completed", "failed", "unknown_document"]).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  summary: z.string().max(8192).nullable().optional(),
  document_type: z.string().min(1).max(255),
  fields: z.record(z.string(), z.unknown()).optional(),
  warnings: z.array(z.string()).optional(),
  missing_fields: z.array(z.string()).optional(),
  provider: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  prompt_tokens: z.number().int().nonnegative().nullable().optional(),
  completion_tokens: z.number().int().nonnegative().nullable().optional(),
  total_tokens: z.number().int().nonnegative().nullable().optional(),
  latency_ms: z.number().int().nonnegative().nullable().optional(),
  error_message: z.string().max(4096).nullable().optional(),
});

// ── Validation Report insert schema ────────────────────────────────────────

export const ValidationReportInsertSchema = z.object({
  document_id: z.string().uuid(),
  extraction_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "passed", "warning", "failed", "error"]).optional(),
  score: z.number().int().min(0).max(100).optional(),
  rule_results: z.array(z.record(z.string(), z.unknown())).optional(),
  passed_count: z.number().int().nonnegative().optional(),
  failed_count: z.number().int().nonnegative().optional(),
  error_count: z.number().int().nonnegative().optional(),
  warning_count: z.number().int().nonnegative().optional(),
  blocking_issues: z.array(z.string()).optional(),
  recommended_review: z.array(z.string()).optional(),
  ready_for_review: z.boolean().optional(),
  validator_version: z.string().max(64).optional(),
  latency_ms: z.number().int().nonnegative().nullable().optional(),
});

// ── Review Audit Log insert schema ──────────────────────────────────────────

const AUDIT_ACTIONS = [
  "approved", "rejected", "needs_changes", "escalated",
  "field_approved", "field_rejected", "field_edited",
  "field_uncertain", "comment_added", "assigned",
] as const;

export const ReviewAuditLogInsertSchema = z.object({
  review_task_id: z.string().uuid(),
  field_name: z.string().max(255).nullable().optional(),
  action: z.enum(AUDIT_ACTIONS),
  previous_value: z.unknown().nullable().optional(),
  new_value: z.unknown().nullable().optional(),
  reviewer: z.string().max(255),
  notes: z.string().max(8192).nullable().optional(),
});

// ── Derived TypeScript types (use these instead of hand-written types) ────────

export type DocumentInsertInput = z.infer<typeof DocumentInsertSchema>;
export type DocumentVersionInsertInput = z.infer<typeof DocumentVersionInsertSchema>;
export type ProcessingJobInsertInput = z.infer<typeof ProcessingJobInsertSchema>;
export type OcrResultInsertInput = z.infer<typeof OcrResultInsertSchema>;
export type DocumentEntityInsertInput = z.infer<typeof DocumentEntityInsertSchema>;
export type ProcessingLogInsertInput = z.infer<typeof ProcessingLogInsertSchema>;
export type ReviewTaskInsertInput = z.infer<typeof ReviewTaskInsertSchema>;
export type DocumentRelationshipInsertInput = z.infer<typeof DocumentRelationshipInsertSchema>;
export type AiExtractionInsertInput = z.infer<typeof AiExtractionInsertSchema>;
export type ValidationReportInsertInput = z.infer<typeof ValidationReportInsertSchema>;

// ── Fuel Delivery insert schema ─────────────────────────────────────────────

export const FuelDeliveryInsertSchema = z.object({
  document_id: z.string().uuid(),
  ocr_result_id: z.string().uuid().nullable().optional(),
  ai_extraction_id: z.string().uuid().nullable().optional(),
  vessel_id: z.string().uuid(),
  supplier: z.string().min(1).max(512),
  delivery_port: z.string().min(1).max(256),
  delivery_date: z.string(),
  fuel_type: z.string().min(1).max(128),
  quantity_mt: z.number().positive(),
  density_kgm3: z.number().positive().nullable().optional(),
  sulphur_content_pct: z.number().min(0).max(10).nullable().optional(),
  bdn_reference: z.string().max(256).nullable().optional(),
  status: z.enum(["pending", "verified", "reconciled", "disputed", "rejected"]).optional(),
  reconciled_voyage_id: z.string().uuid().nullable().optional(),
  reconciled_at: z.string().nullable().optional(),
  notes: z.string().max(4096).nullable().optional(),
});

export type FuelDeliveryInsertInput = z.infer<typeof FuelDeliveryInsertSchema>;

export const ReconciliationLogInsertSchema = z.object({
  fuel_delivery_id: z.string().uuid(),
  voyage_id: z.string().uuid().nullable().optional(),
  match_type: z.enum(["auto", "manual", "override", "break"]),
  match_confidence: z.number().min(0).max(100).nullable().optional(),
  match_reason: z.string().min(1).max(2048),
  matched_by: z.string().max(256).optional(),
  previous_status: z.string().min(1),
  new_status: z.string().min(1),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ReconciliationLogInsertInput = z.infer<typeof ReconciliationLogInsertSchema>;

// ── Phase 2C.6 Reporting & Notification schemas ──────────────────────────────

export const ReportTypeSchema = z.enum([
  "thetis_mrv", "fueleu", "green_zone", "fleet_summary", "esg_package",
]);

export const ReportStatusSchema = z.enum([
  "DRAFT", "READY", "GENERATED", "SUBMITTED", "VERIFIED", "REJECTED", "FAILED",
]);

export const ReportInsertSchema = z.object({
  report_type: ReportTypeSchema,
  vessel_id: z.string().uuid().nullable().optional(),
  vessel_ids: z.record(z.string(), z.unknown()).nullable().optional(),
  title: z.string().min(1).max(1024),
  reporting_year: z.number().int().min(2000).max(2100),
  season: z.string().max(64).nullable().optional(),
  status: ReportStatusSchema.optional(),
  calculation_version: z.string().max(64).nullable().optional(),
  source_data_refs: z.record(z.string(), z.unknown()).nullable().optional(),
  storage_path: z.string().max(2048).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
  checksum: z.string().max(128).nullable().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  generated_at: z.string().nullable().optional(),
  generated_by: z.string().max(255).nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  verification_notes: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ReportInsertInput = z.infer<typeof ReportInsertSchema>;

export const VerifierPackageStatusSchema = z.enum(["DRAFT", "GENERATING", "GENERATED", "FAILED"]);

export const VerifierPackageInsertSchema = z.object({
  vessel_id: z.string().uuid().nullable().optional(),
  reporting_year: z.number().int().min(2000).max(2100),
  status: VerifierPackageStatusSchema.optional(),
  title: z.string().min(1).max(1024),
  manifest: z.record(z.string(), z.unknown()).optional(),
  storage_path: z.string().max(2048).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
  checksum: z.string().max(128).nullable().optional(),
  package_version: z.string().max(64).optional(),
  validation_result: z.record(z.string(), z.unknown()).nullable().optional(),
  generated_at: z.string().nullable().optional(),
  generated_by: z.string().max(255).nullable().optional(),
});

export type VerifierPackageInsertInput = z.infer<typeof VerifierPackageInsertSchema>;

export const NotificationSeveritySchema = z.enum(["INFO", "MEDIUM", "HIGH", "CRITICAL"]);

export const NotificationInsertSchema = z.object({
  recipient_id: z.string().min(1).max(255),
  notification_type: z.string().min(1).max(128),
  severity: NotificationSeveritySchema,
  vessel_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().max(255).nullable().optional(),
  title: z.string().min(1).max(512),
  message: z.string().min(1).max(4096),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  is_read: z.boolean().optional(),
  read_at: z.string().nullable().optional(),
  source_event: z.string().max(128).nullable().optional(),
  source_id: z.string().max(255).nullable().optional(),
});

export type NotificationInsertInput = z.infer<typeof NotificationInsertSchema>;

export const NotificationPreferenceInsertSchema = z.object({
  recipient_id: z.string().min(1).max(255),
  notification_type: z.string().max(128).nullable().optional(),
  enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
});

export type NotificationPreferenceInsertInput = z.infer<typeof NotificationPreferenceInsertSchema>;
