/**
 * index.ts — public barrel export for the Supabase module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * One clean import path for everything downstream (the API route, future
 * orchestration layers):
 *
 *   import {
 *     getSupabaseClient,
 *     createVoyageRepository,
 *   } from "@/lib/supabase";
 *
 * Re-exports ONLY the public surface: the client factory/singleton, the three
 * repository factories + their interfaces, the typed DB row types, and the
 * error classes callers may catch. Internals (mapper, config internals) stay
 * private to this folder.
 */

// Client + config.
export { createSupabaseClient, getSupabaseClient } from "./client";
export type { TypedSupabaseClient, Database } from "./client";
export { loadConfig } from "./config";
export type { SupabaseConfig } from "./config";

// Row types (1:1 with the migration) + insert payloads.
export type {
  VesselRow,
  VesselInsert,
  VoyageRow,
  VoyageInsert,
  AisPositionRow,
  AisPositionInsert,
} from "./types";

// Document domain union types.
export type {
  DocumentType,
  DocumentStatus,
  ProcessingJobType,
  ProcessingJobStatus,
  ProcessingLogLevel,
  ReviewTaskStatus,
  ReviewTaskPriority,
  DocumentRelationshipType,
  DocumentEntityType,
} from "./types";

// Fuel delivery domain row types + insert payloads.
export type {
  FuelTypeRow,
  FuelTypeInsert,
  FuelDeliveryRow,
  FuelDeliveryInsert,
  ReconciliationLogRow,
  ReconciliationLogInsert,
} from "./types";

// FuelEU domain row types + insert payloads.
export type {
  FuelEuRecordRow,
  FuelEuRecordInsert,
} from "./types";

// EU ETS domain row types + insert payloads.
export type {
  EuEtsRecordRow,
  EuEtsRecordInsert,
} from "./types";

// MRV domain row types + insert payloads.
export type {
  MrvReportRow,
  MrvReportInsert,
} from "./types";

// Phase 2C.4 domain row types + insert payloads.
export type {
  EnvironmentalZoneRow,
  EnvironmentalZoneInsert,
  PortCallRow,
  PortCallInsert,
  ZoneEventRow,
  ZoneEventInsert,
  VesselTrackRow,
  VesselTrackInsert,
  MapConfigRow,
  MapConfigInsert,
} from "./types";

// Part 1 — Regulatory Foundation domain row types + insert payloads.
export type {
  RegulatoryRuleRow,
  RegulatoryRuleInsert,
  RegulationApplicabilityRow,
  RegulationApplicabilityInsert,
  VoyageConsumptionRow,
  VoyageConsumptionInsert,
} from "./types";

// Document domain row types + insert payloads.
export type {
  DocumentRow,
  DocumentInsert,
  DocumentVersionRow,
  DocumentVersionInsert,
  ProcessingJobRow,
  ProcessingJobInsert,
  OcrResultRow,
  OcrResultInsert,
  DocumentEntityRow,
  DocumentEntityInsert,
  ProcessingLogRow,
  ProcessingLogInsert,
  ReviewTaskRow,
  ReviewTaskInsert,
  DocumentRelationshipRow,
  DocumentRelationshipInsert,
  AiExtractionRow,
  AiExtractionInsert,
  ValidationReportRow,
  ValidationReportInsert,
  ReviewAuditLogRow,
  ReviewAuditLogInsert,
  OcrQualityLevel,
  OcrReviewSuggestionKind,
  OcrReviewSuggestionPriority,
  OcrReviewSuggestionStatus,
  OcrQualityScoreRow,
  OcrQualityScoreInsert,
  OcrReviewSuggestionRow,
  OcrReviewSuggestionInsert,
  NoonReportRow,
  NoonReportInsert,
} from "./types";

// Phase 4.5 Product Foundation row types + insert payloads.
export type {
  OrganizationRow,
  OrganizationInsert,
  UserRoleRow,
  UserRoleInsert,
  OrganizationUserRow,
  OrganizationUserInsert,
  OrganizationSettingsRow,
  OrganizationSettingsInsert,
  OrganizationInviteRow,
  OrganizationInviteInsert,
  IntegrationCredentialRow,
  IntegrationCredentialInsert,
  AuthTokenRow,
  AuthTokenInsert,
} from "./types";

// Errors — callers branch with `instanceof`.
export {
  SupabaseError,
  SupabaseConfigError,
  RepositoryError,
  RepositoryIntegrityError,
  RepositoryUpstreamError,
  mapError,
} from "./errors";

// Repositories — the persistence API.
export { createVesselRepository } from "./repositories/vessels";
export type { VesselRepository, CreateVesselRepositoryOptions } from "./repositories/vessels";

export { createVoyageRepository } from "./repositories/voyages";
export type {
  VoyageRepository,
  CreateVoyageRepositoryOptions,
} from "./repositories/voyages";

export { createAisPositionsRepository } from "./repositories/ais_positions";
export type {
  AisPositionsRepository,
  CreateAisPositionsRepositoryOptions,
} from "./repositories/ais_positions";

// Document domain repositories.
export { createDocumentRepository } from "./repositories/documents";
export type {
  DocumentRepository,
  CreateDocumentRepositoryOptions,
} from "./repositories/documents";

export { createDocumentVersionRepository } from "./repositories/document_versions";
export type {
  DocumentVersionRepository,
  CreateDocumentVersionRepositoryOptions,
} from "./repositories/document_versions";

export { createProcessingJobRepository } from "./repositories/processing_jobs";
export type {
  ProcessingJobRepository,
  CreateProcessingJobRepositoryOptions,
} from "./repositories/processing_jobs";

export { createOcrResultRepository } from "./repositories/ocr_results";
export type {
  OcrResultRepository,
  CreateOcrResultRepositoryOptions,
} from "./repositories/ocr_results";

export { createDocumentEntityRepository } from "./repositories/document_entities";
export type {
  DocumentEntityRepository,
  CreateDocumentEntityRepositoryOptions,
} from "./repositories/document_entities";

export { createProcessingLogRepository } from "./repositories/processing_logs";
export type {
  ProcessingLogRepository,
  CreateProcessingLogRepositoryOptions,
} from "./repositories/processing_logs";

export { createReviewTaskRepository } from "./repositories/review_tasks";
export type {
  ReviewTaskRepository,
  CreateReviewTaskRepositoryOptions,
} from "./repositories/review_tasks";

export { createOcrQualityScoreRepository } from "./repositories/ocr_quality_scores";
export type {
  OcrQualityScoreRepository,
  CreateOcrQualityScoreRepositoryOptions,
} from "./repositories/ocr_quality_scores";

export { createOcrReviewSuggestionRepository } from "./repositories/ocr_review_suggestions";
export type {
  OcrReviewSuggestionRepository,
  CreateOcrReviewSuggestionRepositoryOptions,
} from "./repositories/ocr_review_suggestions";

export { createDocumentRelationshipRepository } from "./repositories/document_relationships";
export type {
  DocumentRelationshipRepository,
  CreateDocumentRelationshipRepositoryOptions,
} from "./repositories/document_relationships";

export { createNoonReportRepository } from "./repositories/noon_reports";
export type {
  NoonReportRepository,
  CreateNoonReportRepositoryOptions,
  NoonReportUpdate,
} from "./repositories/noon_reports";

export { createPortCallRepository } from "./repositories/port_calls";
export type {
  PortCallRepository,
  CreatePortCallRepositoryOptions,
} from "./repositories/port_calls";

// Phase 4.5 Product Foundation repositories.
export { createOrganizationRepository } from "./repositories/organizations";
export type {
  OrganizationRepository,
  CreateOrganizationRepositoryOptions,
  OrganizationUpdate,
} from "./repositories/organizations";

export { createUserRoleRepository } from "./repositories/user_roles";
export type {
  UserRoleRepository,
  CreateUserRoleRepositoryOptions,
} from "./repositories/user_roles";

export { createOrganizationUserRepository } from "./repositories/organization_users";
export type {
  OrganizationUserRepository,
  CreateOrganizationUserRepositoryOptions,
  OrganizationUserUpdate,
} from "./repositories/organization_users";

export { createOrganizationSettingsRepository } from "./repositories/organization_settings";
export type {
  OrganizationSettingsRepository,
  CreateOrganizationSettingsRepositoryOptions,
  OrganizationSettingsUpdate,
} from "./repositories/organization_settings";

export { createOrganizationInviteRepository } from "./repositories/organization_invites";
export type {
  OrganizationInviteRepository,
  CreateOrganizationInviteRepositoryOptions,
  OrganizationInviteUpdate,
} from "./repositories/organization_invites";

export { createIntegrationCredentialRepository } from "./repositories/integration_credentials";
export type {
  IntegrationCredentialRepository,
  CreateIntegrationCredentialRepositoryOptions,
  IntegrationCredentialUpdate,
} from "./repositories/integration_credentials";

export { createAuthTokenRepository } from "./repositories/auth_tokens";
export type {
  AuthTokenRepository,
  CreateAuthTokenRepositoryOptions,
  FindValidTokenOptions,
  AuthTokenUpdate,
} from "./repositories/auth_tokens";

// AI Extraction repository.
export { createAiExtractionRepository } from "./repositories/ai_extractions";
export type {
  AiExtractionRepository,
  CreateAiExtractionRepositoryOptions,
  AiExtractionRow as AiExtractionRepositoryRow,
  AiExtractionInsert as AiExtractionRepositoryInsert,
} from "./repositories/ai_extractions";

// Validation Report repository.
export { createValidationReportRepository } from "./repositories/validation_reports";
export type {
  ValidationReportRepository,
  CreateValidationReportRepositoryOptions,
  ValidationReportRow as ValidationReportRepositoryRow,
  ValidationReportInsert as ValidationReportRepositoryInsert,
} from "./repositories/validation_reports";

// Review Audit Log repository.
export { createReviewAuditLogRepository } from "./repositories/review_audit_log";
export type {
  ReviewAuditLogRepository,
  CreateReviewAuditLogRepositoryOptions,
} from "./repositories/review_audit_log";

// Org-wide immutable Audit Log repository.
export { createAuditLogRepository } from "./repositories/audit_log";
export type {
  AuditLogRepository,
  CreateAuditLogRepositoryOptions,
} from "./repositories/audit_log";

// Fuel Delivery repositories.
export { createFuelDeliveryRepository, createFuelTypeRepository } from "./repositories/fuel_deliveries";
export type {
  FuelDeliveryRepository,
  FuelTypeRepository,
  CreateFuelDeliveryRepositoryOptions,
} from "./repositories/fuel_deliveries";

// FuelEU repository.
export { createFuelEuRecordRepository } from "./repositories/fuel_eu_records";
export type { FuelEuRecordRepository } from "./repositories/fuel_eu_records";

// EU ETS repository.
export { createEuEtsRecordRepository } from "./repositories/eu_ets_records";
export type { EuEtsRecordRepository } from "./repositories/eu_ets_records";

// MRV repository.
export { createMrvReportRepository } from "./repositories/mrv_reports";
export type { MrvReportRepository } from "./repositories/mrv_reports";
export { createMrvMonitoringPlanRepository } from "./repositories/mrv_monitoring_plans";
export type {
  MrvMonitoringPlanRepository,
  CreateMrvMonitoringPlanRepositoryOptions,
} from "./repositories/mrv_monitoring_plans";
export { createMrvReportVersionRepository } from "./repositories/mrv_report_versions";
export type {
  MrvReportVersionRepository,
  CreateMrvReportVersionRepositoryOptions,
} from "./repositories/mrv_report_versions";

// Part 1 — Regulatory Foundation repositories.
export { createRegulatoryRuleRepository } from "./repositories/regulatory_rules";
export type {
  RegulatoryRuleRepository,
  CreateRegulatoryRuleRepositoryOptions,
} from "./repositories/regulatory_rules";

export { createRegulationApplicabilityRepository } from "./repositories/regulation_applicability";
export type {
  RegulationApplicabilityRepository,
  CreateRegulationApplicabilityRepositoryOptions,
} from "./repositories/regulation_applicability";

export { createVoyageConsumptionRepository } from "./repositories/voyage_consumption";
export type {
  VoyageConsumptionRepository,
  CreateVoyageConsumptionRepositoryOptions,
} from "./repositories/voyage_consumption";

// Email ingestion types.
export type {
  EmailIngestionLogRow,
  EmailIngestionLogInsert,
  EmailIngestionEvent,
  DocumentSourceChannel,
} from "./types";

// Email ingestion log repository.
export { createEmailIngestionLogRepository } from "./repositories/email_ingestion_log";
export type {
  EmailIngestionLogRepository,
  CreateEmailIngestionLogRepositoryOptions,
} from "./repositories/email_ingestion_log";

// Phase 2C.6 types.
export type {
  ReportType,
  ReportStatus,
  ReportRow,
  ReportInsert,
  VerifierPackageStatus,
  VerifierPackageRow,
  VerifierPackageInsert,
  NotificationSeverity,
  NotificationRow,
  NotificationInsert,
  NotificationPreferenceRow,
  NotificationPreferenceInsert,
} from "./types";

// Phase 3A AI Assistant types.
export type {
  KnowledgeSource,
  KnowledgeRegulation,
  KnowledgeDocumentRow,
  KnowledgeDocumentInsert,
  KnowledgeChunkRow,
  KnowledgeChunkInsert,
  ConversationStatus,
  AssistantConversationRow,
  AssistantConversationInsert,
  MessageRole,
  ToolStatus,
  AssistantMessageRow,
  AssistantMessageInsert,
  AssistantToolCallRow,
  AssistantToolCallInsert,
  AssistantEvaluationLogRow,
  AssistantEvaluationLogInsert,
} from "./types";

// Zod validation schemas.
export {
  DocumentTypeSchema,
  DocumentStatusSchema,
  ProcessingJobTypeSchema,
  ProcessingJobStatusSchema,
  ProcessingLogLevelSchema,
  ReviewTaskStatusSchema,
  ReviewTaskPrioritySchema,
  OcrQualityLevelSchema,
  OcrReviewSuggestionKindSchema,
  OcrReviewSuggestionPrioritySchema,
  OcrReviewSuggestionStatusSchema,
  DocumentRelationshipTypeSchema,
  DocumentEntityTypeSchema,
  DocumentInsertSchema,
  DocumentVersionInsertSchema,
  ProcessingJobInsertSchema,
  OcrResultInsertSchema,
  DocumentEntityInsertSchema,
  ProcessingLogInsertSchema,
  ReviewTaskInsertSchema,
  OcrQualityScoreInsertSchema,
  OcrReviewSuggestionInsertSchema,
  NoonReportInsertSchema,
  DocumentRelationshipInsertSchema,
  AiExtractionInsertSchema,
  ValidationReportInsertSchema,
  ReviewAuditLogInsertSchema,
  ReportTypeSchema,
  ReportStatusSchema,
  ReportInsertSchema,
  VerifierPackageStatusSchema,
  VerifierPackageInsertSchema,
  NotificationSeveritySchema,
  NotificationInsertSchema,
  NotificationPreferenceInsertSchema,
  KnowledgeSourceSchema,
  KnowledgeRegulationSchema,
  ConversationStatusSchema,
  MessageRoleSchema,
  ToolStatusSchema,
  KnowledgeDocumentInsertSchema,
  KnowledgeChunkInsertSchema,
  AssistantConversationInsertSchema,
  AssistantMessageInsertSchema,
  AssistantToolCallInsertSchema,
  AssistantEvaluationLogInsertSchema,
} from "./schemas";

// Phase 2C.6 repositories.
export { createComplianceReportRepository } from "./repositories/compliance_reports";
export type {
  ComplianceReportRepository,
  CreateComplianceReportRepositoryOptions,
} from "./repositories/compliance_reports";

export { createVerifierPackageRepository } from "./repositories/verifier_packages";
export type {
  VerifierPackageRepository,
  CreateVerifierPackageRepositoryOptions,
} from "./repositories/verifier_packages";

export { createNotificationRepository } from "./repositories/notifications";
export type {
  NotificationRepository,
  CreateNotificationRepositoryOptions,
} from "./repositories/notifications";

export { createNotificationPreferenceRepository } from "./repositories/notification_preferences";
export type {
  NotificationPreferenceRepository,
  CreateNotificationPreferenceRepositoryOptions,
} from "./repositories/notification_preferences";

// Phase 3A AI Assistant repositories.
export { createKnowledgeDocumentRepository } from "./repositories/knowledge_documents";
export type {
  KnowledgeDocumentRepository,
  CreateKnowledgeDocumentRepositoryOptions,
} from "./repositories/knowledge_documents";

export { createKnowledgeChunkRepository } from "./repositories/knowledge_chunks";
export type {
  KnowledgeChunkRepository,
  CreateKnowledgeChunkRepositoryOptions,
} from "./repositories/knowledge_chunks";

export { createAssistantConversationRepository } from "./repositories/assistant_conversations";
export type {
  AssistantConversationRepository,
  CreateAssistantConversationRepositoryOptions,
} from "./repositories/assistant_conversations";

export { createAssistantMessageRepository } from "./repositories/assistant_messages";
export type {
  AssistantMessageRepository,
  CreateAssistantMessageRepositoryOptions,
} from "./repositories/assistant_messages";

export { createAssistantToolCallRepository } from "./repositories/assistant_tool_calls";
export type {
  AssistantToolCallRepository,
  CreateAssistantToolCallRepositoryOptions,
} from "./repositories/assistant_tool_calls";

export { createAssistantEvaluationLogRepository } from "./repositories/assistant_evaluation_log";
export type {
  AssistantEvaluationLogRepository,
  CreateAssistantEvaluationLogRepositoryOptions,
} from "./repositories/assistant_evaluation_log";

// Phase 4.1 SOx ECA compliance watch repository.
export { createSoxComplianceRepository } from "./repositories/sox_compliance";
export type {
  SoxComplianceRepository,
  CreateSoxComplianceRepositoryOptions,
  SoxEventRow,
  SoxEventInsert,
  SoxWatchStateRow,
  SoxWatchStateInsert,
} from "./repositories/sox_compliance";

// Phase 4.2 Certificate & Statutory Document Registry repository.
export { createCertificateRepository } from "./repositories/certificates";
export type {
  CertificateRepository,
  CreateCertificateRepositoryOptions,
  FindCertificatesOptions,
  CertificateRow,
  CertificateInsert,
  CertificateEventRow,
  CertificateEventInsert,
} from "./repositories/certificates";

// Mapper (re-exported so the orchestration layer can build payloads directly if
// it ever needs to — e.g. a batch importer).
export { toVesselInsert, toVoyageInsert } from "./mapper";
