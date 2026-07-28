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
