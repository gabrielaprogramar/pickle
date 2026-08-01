/**
 * certificates/handoff.ts — handoff surface for the Captain / Compliance / Maintenance / Search assistants
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Assistants REUSE certificate registry state through this fixed vocabulary.
 * They only read deterministic derived statuses — no LLM computes certificate
 * validity. Each string is a stable contract the assistant prompt/tools quote.
 */

import type { CertificateRecord, CertificateStatus, CertificateThresholds } from "./types";
import { DEFAULT_CERTIFICATE_THRESHOLDS } from "./types";
import { daysUntil, deriveStatus } from "./status-engine";

export type CertificateHandoffTarget = "captain" | "compliance" | "maintenance" | "search";

export interface CertificateHandoffStatement {
  readonly target: CertificateHandoffTarget;
  readonly question: string;
  readonly answer: string;
}

export function certificateTitle(record: CertificateRecord): string {
  return record.certificate_type;
}

/** Captain — "Are all certificates in order for our next port call?" */
export function captainCertificateReadiness(
  records: ReadonlyArray<CertificateRecord>,
  now: string,
  thresholds: CertificateThresholds = DEFAULT_CERTIFICATE_THRESHOLDS,
): CertificateHandoffStatement {
  return {
    target: "captain",
    question: "Are all certificates in order for our next port call?",
    answer: captainCertificateReadinessText(records, now, thresholds),
  };
}

export function captainCertificateReadinessText(
  records: ReadonlyArray<CertificateRecord>,
  now: string,
  thresholds: CertificateThresholds = DEFAULT_CERTIFICATE_THRESHOLDS,
): string {
  const current = records.filter((r) => r.is_current);
  if (current.length === 0) {
    return "No certificate records are on file for this vessel, so I cannot confirm certificate readiness. Please upload the certificate documents.";
  }

  const blocking = current.filter((r) => {
    const d = deriveStatus(
      {
        reviewStatus: r.review_status,
        validationStatus: r.validation_status,
        reviewRequired: r.review_required,
        blocking: r.blocking,
        reasonCode: r.reason_code,
        expiryDate: r.expiry_date,
        issueDate: r.issue_date,
      },
      thresholds,
      now,
    );
    return d.status === "EXPIRED" || d.status === "INVALID" || (d.status === "PENDING_REVIEW" && d.blocking);
  });

  const expiring = current.filter((r) => {
    const d = deriveStatus(
      {
        reviewStatus: r.review_status,
        validationStatus: r.validation_status,
        reviewRequired: r.review_required,
        blocking: r.blocking,
        reasonCode: r.reason_code,
        expiryDate: r.expiry_date,
        issueDate: r.issue_date,
      },
      thresholds,
      now,
    );
    return d.status === "EXPIRING_SOON";
  });

  if (blocking.length > 0) {
    return `Not fully ready: ${blocking.length} certificate record(s) are expired, invalid, or blocked pending review (${blocking
      .map((r) => certificateTitle(r))
      .join(", ")}). Status is derived from evidence on file — resolve before the port call.`;
  }
  if (expiring.length > 0) {
    return `Certificate records are current, but ${expiring
      .map((r) => `${certificateTitle(r)} (${r.expiry_date})`)
      .join(", ")} expire within ${thresholds.expiringSoonDays} days. Plan renewals.`;
  }
  return "Certificate records are current on the evidence on file. No expirations within the next 90 days.";
}

/** Compliance — regulatory meaning of one certificate's derived status. */
export function complianceCertificateExplanation(
  record: CertificateRecord,
  now: string,
  thresholds: CertificateThresholds = DEFAULT_CERTIFICATE_THRESHOLDS,
): CertificateHandoffStatement {
  const d = deriveStatus(
    {
      reviewStatus: record.review_status,
      validationStatus: record.validation_status,
      reviewRequired: record.review_required,
      blocking: record.blocking,
      reasonCode: record.reason_code,
      expiryDate: record.expiry_date,
      issueDate: record.issue_date,
    },
    thresholds,
    now,
  );
  return {
    target: "compliance",
    question: "Explain this certificate's status",
    answer: `Certificate ${certificateTitle(record)} (${record.certificate_number ?? "no number"}) is ${d.status} on the evidence on file. ${explainStatus(d.status, record)} No expiry date is ever inferred — ${record.expiry_date ?? "no expiry date on file"}.`,
  };
}

function explainStatus(status: CertificateStatus, record: CertificateRecord): string {
  switch (status) {
    case "VALID":
      return `Its expiry date ${record.expiry_date} is beyond the expiring window.`;
    case "EXPIRING_SOON":
      return `It expires ${record.expiry_date}, within the configured expiring-soon window (default 90 days).`;
    case "EXPIRED":
      return `Its expiry date ${record.expiry_date} has passed — this is derived from the date on the evidence.`;
    case "MISSING":
      return `It is a known requirement but no evidence document is on file. Absence of evidence is not treated as compliance.`;
    case "PENDING_REVIEW":
      return `It requires human review (${record.reason_code ?? "PENDING_REVIEW"}) — the record is not asserted as valid until review resolves.`;
    case "INVALID":
      return `Its validation or review outcome is invalid; the record must be corrected or re-evidenced.`;
    case "UNKNOWN":
      return `Applicability or evidence is uncertain (${record.reason_code ?? "UNKNOWN"}) and a review task is required before it can be declared valid.`;
    default:
      return `Status ${status} is derived from the registry without assertion of underlying compliance.`;
  }
}

/** Maintenance — deterministic deadline summary for the maintenance assistant. */
export function maintenanceCertificateSummary(
  records: ReadonlyArray<CertificateRecord>,
  now: string,
  thresholds: CertificateThresholds = DEFAULT_CERTIFICATE_THRESHOLDS,
): CertificateHandoffStatement {
  const current = records.filter((r) => r.is_current);
  const expiring = current.filter((r) => r.expiry_date !== null && daysUntil(now, r.expiry_date) <= thresholds.expiringSoonDays && daysUntil(now, r.expiry_date) >= 0);
  const expired = current.filter((r) => r.expiry_date !== null && daysUntil(now, r.expiry_date) < 0);
  const pending = current.filter((r) => r.review_required);

  const lines: string[] = [];
  if (expired.length > 0) lines.push(`Expired: ${expired.map((r) => certificateTitle(r)).join(", ")}`);
  if (expiring.length > 0) lines.push(`Expiring soon: ${expiring.map((r) => certificateTitle(r)).join(", ")}`);
  if (pending.length > 0) lines.push(`Pending review: ${pending.map((r) => certificateTitle(r)).join(", ")}`);
  if (lines.length === 0) lines.push("No certificate expiry, expiration, or review items.");

  return {
    target: "maintenance",
    question: "Summarize certificate deadlines",
    answer: lines.join(". ") + ".",
  };
}

/** Search — vocabulary the Search assistant uses to retrieve registry records. */
export function searchCertificatePhrases(): ReadonlyArray<string> {
  return [
    "certificates expiring soon",
    "expired certificates",
    "certificates missing evidence",
    "certificates pending review",
    "certificate records for a vessel",
  ];
}
