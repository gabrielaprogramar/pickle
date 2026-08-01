/**
 * certificates/index.ts — public barrel for the Certificate & Statutory Document Registry
 */

export {
  CERTIFICATES_VERSION,
  CERTIFICATE_STATUS_VERSION,
  DEFAULT_CERTIFICATE_THRESHOLDS,
  KNOWN_CERTIFICATE_TYPES,
  CERTIFICATE_REASON_CODES,
} from "./types";
export type {
  CertificateStatus,
  CertificateEventType,
  CertificateSeverity,
  CertificateSource,
  CertificateValidationStatus,
  CertificateReviewStatus,
  CertificateRecord,
  CertificateRecordInsert,
  CertificateEvent,
  CertificateEventInsert,
  CertificateThresholds,
  CertificateReasonCode,
  RequirementApplicability,
  RequirementSpec,
} from "./types";

export {
  deriveStatus,
  deriveRecordStatus,
  daysUntil,
  severityForEvent,
  buildExpiryDedupKey,
} from "./status-engine";
export type { StatusEngineInput, DerivedStatus } from "./status-engine";

export {
  evaluateRequirements,
  knownCertificateTypes,
  placeholderRecordFor,
  certificateTypeLabel,
  TYPE_DETERMINATIONS,
} from "./requirements";
export type { VesselCertProfile, TypeDetermination } from "./requirements";

export {
  captainCertificateReadiness,
  captainCertificateReadinessText,
  complianceCertificateExplanation,
  maintenanceCertificateSummary,
  searchCertificatePhrases,
} from "./handoff";
export type { CertificateHandoffStatement, CertificateHandoffTarget } from "./handoff";

export {
  buildCertificateNotification,
  certificateNotificationTypeForEvent,
} from "./notifications";
export type {
  CertificateNotificationInput,
  CertificateSeverity as CertificateNotificationSeverity,
} from "./notifications";

export { CertificateService, viewFor } from "./service";
export type {
  CertificateRepository,
  CertificateServiceDeps,
  CertificateVessel,
  CertificateView,
  RegisterCertificateInput,
  RegisterOutcome,
  EvaluateOutcome,
  ReviewDecision,
} from "./service";

export {
  CERT_MOCK_NOW,
  CERT_MOCK_VESSEL,
  CERT_MOCK_PROFILE,
  buildMockCertificateRegistry,
} from "./mock-data";
