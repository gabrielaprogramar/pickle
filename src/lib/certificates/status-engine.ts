/**
 * certificates/status-engine.ts — deterministic certificate status derivation
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Pure functions only. No I/O. Thresholds are injected (never hardcoded).
 *
 * Derivation order (all deterministic):
 *   1. review_status === "REJECTED"        → INVALID  (reason REVIEW_REJECTED)
 *   2. validation_status === "invalid"     → INVALID  (reason VALIDATION_INVALID)
 *   3. review_required === true            → PENDING_REVIEW
 *   4. placeholder MISSING                 → MISSING  (requirement known, no evidence)
 *   5. placeholder UNKNOWN                 → UNKNOWN  (applicability uncertain)
 *   6. expiry_date is null                 → PENDING_REVIEW (MISSING_EXPIRY —
 *      never invent an expiry date)
 *   7. expiry_date passed                  → EXPIRED
 *   8. <= expiringSoonDays                 → EXPIRING_SOON
 *   9. else                               → VALID
 */

import type {
  CertificateRecord,
  CertificateSeverity,
  CertificateStatus,
  CertificateThresholds,
} from "./types";
import { CERTIFICATE_REASON_CODES } from "./types";

export interface DerivedStatus {
  readonly status: CertificateStatus;
  readonly reasonCode: string | null;
  readonly blocking: boolean;
  readonly reviewRequired: boolean;
}

export interface StatusEngineInput {
  readonly reviewStatus: string | null;
  readonly validationStatus: string | null;
  readonly reviewRequired: boolean;
  readonly blocking: boolean;
  readonly reasonCode: string | null;
  readonly expiryDate: string | null;
  readonly issueDate: string | null;
  /** True for MISSING / UNKNOWN placeholder rows produced by the requirements service. */
  readonly placeholder?: boolean;
}

/** Whole-day difference in days from `fromIso` to `toDateStr` (date-only). */
export function daysUntil(fromIso: string, toDateStr: string): number {
  const from = new Date(fromIso.slice(0, 10) + "T00:00:00.000Z");
  const to = new Date(toDateStr.slice(0, 10) + "T00:00:00.000Z");
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Deterministic status derivation. Exported for direct use in tests. */
export function deriveStatus(
  input: StatusEngineInput,
  thresholds: CertificateThresholds,
  now: string,
): DerivedStatus {
  if (input.reviewStatus === "REJECTED") {
    return {
      status: "INVALID",
      reasonCode: CERTIFICATE_REASON_CODES.REVIEW_REJECTED,
      blocking: false,
      reviewRequired: false,
    };
  }
  if (input.validationStatus === "invalid") {
    return {
      status: "INVALID",
      reasonCode: CERTIFICATE_REASON_CODES.VALIDATION_INVALID,
      blocking: input.blocking,
      reviewRequired: false,
    };
  }
  if (input.reviewRequired) {
    return {
      status: "PENDING_REVIEW",
      reasonCode: input.reasonCode ?? CERTIFICATE_REASON_CODES.PENDING_REVIEW,
      blocking: input.blocking,
      reviewRequired: true,
    };
  }
  if (input.placeholder) {
    return {
      status: input.reasonCode === CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY ? "UNKNOWN" : "MISSING",
      reasonCode: input.reasonCode ?? CERTIFICATE_REASON_CODES.MISSING_DOCUMENT,
      blocking: false,
      reviewRequired: false,
    };
  }
  if (input.expiryDate === null) {
    return {
      status: "PENDING_REVIEW",
      reasonCode: CERTIFICATE_REASON_CODES.MISSING_EXPIRY,
      blocking: false,
      reviewRequired: true,
    };
  }
  const days = daysUntil(now, input.expiryDate);
  if (days < 0) {
    return {
      status: "EXPIRED",
      reasonCode: null,
      blocking: input.blocking,
      reviewRequired: false,
    };
  }
  if (days <= thresholds.expiringSoonDays) {
    return {
      status: "EXPIRING_SOON",
      reasonCode: null,
      blocking: false,
      reviewRequired: false,
    };
  }
  return { status: "VALID", reasonCode: null, blocking: false, reviewRequired: false };
}

/** Recompute the derived status snapshot for a stored record. */
export function deriveRecordStatus(
  record: Omit<CertificateRecord, "status" | "reason_code" | "blocking" | "review_required"> & {
    readonly status?: CertificateStatus;
    readonly reason_code?: string | null;
    readonly blocking?: boolean;
    readonly review_required?: boolean;
  },
  thresholds: CertificateThresholds,
  now: string,
): DerivedStatus {
  const placeholder =
    record.source === "unknown" &&
    (record.reason_code === CERTIFICATE_REASON_CODES.MISSING_DOCUMENT ||
      record.reason_code === CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY);
  return deriveStatus(
    {
      reviewStatus: record.review_status,
      validationStatus: record.validation_status,
      reviewRequired: record.review_required ?? false,
      blocking: record.blocking ?? false,
      reasonCode: record.reason_code ?? null,
      expiryDate: record.expiry_date,
      issueDate: record.issue_date,
      placeholder,
    },
    thresholds,
    now,
  );
}

/** Severity for each deterministic event type. */
export function severityForEvent(
  eventType: string,
  blocking: boolean,
): CertificateSeverity {
  switch (eventType) {
    case "CERTIFICATE_EXPIRED":
      return blocking ? "CRITICAL" : "HIGH";
    case "CERTIFICATE_EXPIRING":
      return "MEDIUM";
    case "MISSING":
      return "MEDIUM";
    case "REVIEW_REQUIRED":
      return blocking ? "CRITICAL" : "HIGH";
    case "REPLACED":
      return "INFO";
    case "CREATED":
      return "INFO";
    case "UPDATED":
      return "INFO";
    default:
      return "INFO";
  }
}

/** Stable dedup key for a status snapshot (used to avoid duplicate events). */
export function buildExpiryDedupKey(
  vesselId: string,
  certificateType: string,
  status: CertificateStatus,
): string {
  return `${vesselId}:${certificateType}:${status}`;
}
