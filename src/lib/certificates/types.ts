/**
 * certificates/types.ts — Certificate & Statutory Document Registry domain types
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A record NEVER detaches from its evidence: every record carries document_id
 * (the evidence file). Status is derived by a deterministic engine over stored
 * snapshot fields — no LLM is ever involved in status derivation.
 *
 * Thresholds (e.g. the >90 day VALID / <=90 day EXPIRING_SOON split) are
 * configuration, never hardcoded in the UI.
 */

export const CERTIFICATES_VERSION = "1.0.0";
export const CERTIFICATE_STATUS_VERSION = "1.0.0";

export type CertificateStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "MISSING"
  | "PENDING_REVIEW"
  | "INVALID"
  | "UNKNOWN";

export type CertificateEventType =
  | "CREATED"
  | "UPDATED"
  | "CERTIFICATE_EXPIRING"
  | "CERTIFICATE_EXPIRED"
  | "REPLACED"
  | "MISSING"
  | "REVIEW_REQUIRED";

/** Notification severity scale (INFO|MEDIUM|HIGH|CRITICAL — not WARNING). */
export type CertificateSeverity = "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CertificateSource =
  | "document_ocr"
  | "manual"
  | "api"
  | "import"
  | "unknown";

export type CertificateValidationStatus = "pending" | "valid" | "invalid";

export type CertificateReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NOT_REQUIRED";

/** Known certificate types. Free-form (registry allows new types without redesign). */
export const KNOWN_CERTIFICATE_TYPES = [
  "AIR_POLLUTION_PREVENTION", // IAPP — MARPOL Annex VI
  "SAFETY_MANAGEMENT", // DOC + SMC — ISM Code
  "ISPS", // ISSC — SOLAS XI-2
  "LOAD_LINE",
  "TONNAGE",
  "BALLAST_WATER", // BWM Convention
  "MARPOL", // IOPP — MARPOL Annex I
  "SEEMP", // SEEMP Part II / Part III
  "ISCC",
  "CLASS_CERTIFICATE",
  "SAFETY_CERTIFICATE", // SOLAS safety equipment / construction
  "OTHER",
] as const;

export type KnownCertificateType = (typeof KNOWN_CERTIFICATE_TYPES)[number];

export interface CertificateRecord {
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
  readonly status: CertificateStatus;
  readonly source: CertificateSource;
  readonly validation_status: CertificateValidationStatus | null;
  readonly review_status: CertificateReviewStatus | null;
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
}

/** Insert payload (id/version/created_at/updated_at server-defaulted). */
export interface CertificateRecordInsert {
  readonly vessel_id: string;
  readonly imo: string;
  readonly document_id?: string | null;
  readonly certificate_type: string;
  readonly certificate_number?: string | null;
  readonly issuing_authority?: string | null;
  readonly class_society?: string | null;
  readonly issue_date?: string | null;
  readonly expiry_date?: string | null;
  readonly status: CertificateStatus;
  readonly source: CertificateSource;
  readonly validation_status?: CertificateValidationStatus | null;
  readonly review_status?: CertificateReviewStatus | null;
  readonly review_required?: boolean;
  readonly blocking?: boolean;
  readonly reason_code?: string | null;
  readonly confidence?: number | null;
  readonly notes?: string | null;
  readonly version?: number;
  readonly supersedes_id?: string | null;
  readonly is_current?: boolean;
}

/** One append-only audit row. */
export interface CertificateEvent {
  readonly id: string;
  readonly certificate_id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: CertificateEventType;
  readonly severity: CertificateSeverity;
  readonly previous_status: string | null;
  readonly new_status: string | null;
  readonly reason_code: string | null;
  readonly details: Record<string, unknown> | null;
  readonly dedup_key: string | null;
  readonly created_at: string;
}

/** Insert payload for a registry event (id/created_at server-defaulted). */
export interface CertificateEventInsert {
  readonly certificate_id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: CertificateEventType;
  readonly severity: CertificateSeverity;
  readonly previous_status?: string | null;
  readonly new_status?: string | null;
  readonly reason_code?: string | null;
  readonly details?: Record<string, unknown> | null;
  readonly dedup_key?: string | null;
}

/** Configurable expiry thresholds. Never hardcoded in the UI. */
export interface CertificateThresholds {
  /** Days before expiry when a VALID certificate becomes EXPIRING_SOON. */
  readonly expiringSoonDays: number;
}

export const DEFAULT_CERTIFICATE_THRESHOLDS: CertificateThresholds = {
  expiringSoonDays: 90,
};

/** Deterministic reason codes for non-VALID states. */
export const CERTIFICATE_REASON_CODES = {
  IMO_MISMATCH: "IMO_MISMATCH",
  MISSING_EXPIRY: "MISSING_EXPIRY",
  MISSING_DOCUMENT: "MISSING_DOCUMENT",
  UNCERTAIN_APPLICABILITY: "UNCERTAIN_APPLICABILITY",
  PENDING_REVIEW: "PENDING_REVIEW",
  VALIDATION_INVALID: "VALIDATION_INVALID",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  NOT_COVERED_BY_RESEARCH: "NOT_COVERED_BY_RESEARCH",
} as const;

export type CertificateReasonCode =
  (typeof CERTIFICATE_REASON_CODES)[keyof typeof CERTIFICATE_REASON_CODES];

/** Requirement determination for one certificate type (source-driven). */
export type RequirementApplicability = "REQUIRED" | "NOT_REQUIRED" | "UNKNOWN";

export interface RequirementSpec {
  readonly certificate_type: string;
  readonly label: string;
  readonly applicability: RequirementApplicability;
  /** Source document reference, e.g. "REGULATORY_RESEARCH.md §4". */
  readonly source: string;
  /** Short regulatory reference, e.g. "MARPOL Annex VI (≥400 GT international)". */
  readonly reference: string;
  readonly requiresReview: boolean;
  readonly notes: string | null;
}
