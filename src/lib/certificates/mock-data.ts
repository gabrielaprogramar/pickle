/**
 * certificates/mock-data.ts — deterministic mock registry for the Aurelia (IMO 9074729)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors the Phase 4.2 mock spec:
 *   IAPP current, ISCC expiring, SMC + DOC + Class current,
 *   BWM conditional/unknown, one expired (LOAD_LINE), one pending review
 *   (SAFETY_CERTIFICATE). No external APIs — fully deterministic.
 */

import type { CertificateRecord } from "./types";
import { CERTIFICATE_REASON_CODES } from "./types";
import type { VesselCertProfile } from "./requirements";

export const CERT_MOCK_NOW = "2026-07-10T12:00:00.000Z";

export const CERT_MOCK_VESSEL = Object.freeze({
  vesselId: "vsl-aurelia",
  imo: "9074729",
  name: "Aurelia",
});

export const CERT_MOCK_PROFILE: VesselCertProfile = Object.freeze({
  imo: "9074729",
  name: "Aurelia",
  vesselType: "commercial",
  gt: 1250,
  lengthM: 60,
  ballastTanks: null,
});

function record(
  overrides: Partial<CertificateRecord> & {
    readonly id: string;
    readonly certificate_type: string;
    readonly status: CertificateRecord["status"];
  },
): CertificateRecord {
  return {
    vessel_id: CERT_MOCK_VESSEL.vesselId,
    imo: CERT_MOCK_VESSEL.imo,
    document_id: null,
    certificate_number: null,
    issuing_authority: null,
    class_society: null,
    issue_date: null,
    expiry_date: null,
    source: "document_ocr",
    validation_status: "valid",
    review_status: "NOT_REQUIRED",
    review_required: false,
    blocking: false,
    reason_code: null,
    confidence: null,
    notes: null,
    version: 1,
    supersedes_id: null,
    is_current: true,
    created_at: "2026-01-15T09:00:00.000Z",
    updated_at: "2026-01-15T09:00:00.000Z",
    ...overrides,
  };
}

export function buildMockCertificateRegistry(now: string = CERT_MOCK_NOW): {
  readonly now: string;
  readonly vessel: typeof CERT_MOCK_VESSEL;
  readonly records: ReadonlyArray<CertificateRecord>;
} {
  const records: ReadonlyArray<CertificateRecord> = [
    record({
      id: "cert-iapp",
      certificate_type: "AIR_POLLUTION_PREVENTION",
      certificate_number: "IAPP-2024-0581",
      issuing_authority: "Transport Malta",
      issue_date: "2024-05-15",
      expiry_date: "2027-05-14",
      status: "VALID",
    }),
    record({
      id: "cert-iscc",
      certificate_type: "ISCC",
      certificate_number: "ISCC-0012-99821",
      issuing_authority: "ISCC System",
      issue_date: "2024-09-20",
      expiry_date: "2026-09-20",
      status: "EXPIRING_SOON",
    }),
    record({
      id: "cert-smc",
      certificate_type: "SAFETY_MANAGEMENT",
      certificate_number: "SMC-2023-4457",
      issuing_authority: "Transport Malta",
      class_society: "DNV",
      issue_date: "2023-08-01",
      expiry_date: "2028-07-31",
      status: "VALID",
    }),
    record({
      id: "cert-doc",
      certificate_type: "SAFETY_MANAGEMENT",
      certificate_number: "DOC-2023-0811",
      issuing_authority: "Transport Malta",
      issue_date: "2023-08-01",
      expiry_date: "2028-07-31",
      status: "VALID",
      notes: "Company Document of Compliance (organization-level record mirrored to the vessel).",
    }),
    record({
      id: "cert-class",
      certificate_type: "CLASS_CERTIFICATE",
      certificate_number: "DNV-9074729-CL",
      issuing_authority: "DNV",
      class_society: "DNV",
      issue_date: "2024-04-10",
      expiry_date: "2027-04-09",
      status: "VALID",
    }),
    record({
      id: "cert-bwm",
      certificate_type: "BALLAST_WATER",
      certificate_number: null,
      issuing_authority: null,
      issue_date: null,
      expiry_date: null,
      status: "UNKNOWN",
      source: "unknown",
      validation_status: "pending",
      review_status: "PENDING",
      review_required: true,
      reason_code: CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY,
      notes: "Ballast-tank capability not on file — BWM applicability is conditional and requires review.",
    }),
    record({
      id: "cert-loadline",
      certificate_type: "LOAD_LINE",
      certificate_number: "LL-2021-0113",
      issuing_authority: "Transport Malta",
      issue_date: "2021-11-02",
      expiry_date: "2026-03-15",
      status: "EXPIRED",
    }),
    record({
      id: "cert-safety-review",
      certificate_type: "SAFETY_CERTIFICATE",
      certificate_number: null,
      issuing_authority: null,
      issue_date: null,
      expiry_date: null,
      status: "PENDING_REVIEW",
      source: "document_ocr",
      validation_status: "pending",
      review_status: "PENDING",
      review_required: true,
      reason_code: CERTIFICATE_REASON_CODES.PENDING_REVIEW,
      notes: "Safety equipment certificate scan awaiting human review; no expiry date extracted yet.",
    }),
  ];

  return { now, vessel: CERT_MOCK_VESSEL, records };
}
