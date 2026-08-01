/**
 * certificates/__tests__/status-engine.test.ts — deterministic status derivation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure-function tests for deriveStatus / deriveRecordStatus / severityForEvent /
 * buildExpiryDedupKey. Thresholds are injected (never hardcoded) so we can verify
 * the >90 day VALID / <=90 day EXPIRING_SOON split and a custom window.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  deriveStatus,
  deriveRecordStatus,
  severityForEvent,
  buildExpiryDedupKey,
} from "../status-engine";
import type { StatusEngineInput } from "../status-engine";
import {
  CERTIFICATE_REASON_CODES,
  DEFAULT_CERTIFICATE_THRESHOLDS,
} from "../types";
import type { CertificateRecord } from "../types";

const NOW = "2026-07-10T12:00:00.000Z";
const THRESHOLDS = DEFAULT_CERTIFICATE_THRESHOLDS;

function input(overrides: Partial<StatusEngineInput> = {}): StatusEngineInput {
  return {
    reviewStatus: null,
    validationStatus: "valid",
    reviewRequired: false,
    blocking: false,
    reasonCode: null,
    expiryDate: "2027-07-10",
    issueDate: "2024-07-10",
    ...overrides,
  };
}

function record(overrides: Partial<CertificateRecord> = {}): CertificateRecord {
  return {
    id: "cert-1",
    vessel_id: "vsl-aurelia",
    imo: "9074729",
    document_id: "doc-1",
    certificate_type: "LOAD_LINE",
    certificate_number: "LL-001",
    issuing_authority: "Flag",
    class_society: null,
    issue_date: "2024-01-01",
    expiry_date: "2026-09-20",
    status: "VALID",
    source: "document_ocr",
    validation_status: "valid",
    review_status: "NOT_REQUIRED",
    review_required: false,
    blocking: false,
    reason_code: null,
    confidence: 0.9,
    notes: null,
    version: 1,
    supersedes_id: null,
    is_current: true,
    created_at: "2024-01-02T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveStatus — expiry ladder (90-day default)", () => {
  it("derives VALID when more than 90 days remain", () => {
    const d = deriveStatus(input({ expiryDate: "2027-07-10" }), THRESHOLDS, NOW);
    expect(d.status).toBe("VALID");
    expect(d.reasonCode).toBeNull();
    expect(d.blocking).toBe(false);
    expect(d.reviewRequired).toBe(false);
  });

  it("derives EXPIRING_SOON at exactly 90 days (threshold inclusive)", () => {
    const d = deriveStatus(input({ expiryDate: "2026-10-08" }), THRESHOLDS, NOW);
    expect(d.status).toBe("EXPIRING_SOON");
    expect(d.reasonCode).toBeNull();
  });

  it("derives EXPIRING_SOON when within the window", () => {
    const d = deriveStatus(input({ expiryDate: "2026-09-20" }), THRESHOLDS, NOW);
    expect(d.status).toBe("EXPIRING_SOON");
  });

  it("derives EXPIRED once the expiry date has passed", () => {
    const d = deriveStatus(input({ expiryDate: "2026-03-15" }), THRESHOLDS, NOW);
    expect(d.status).toBe("EXPIRED");
    expect(d.reasonCode).toBeNull();
  });

  it("treats zero remaining days as EXPIRING_SOON (not yet EXPIRED)", () => {
    const d = deriveStatus(input({ expiryDate: "2026-07-10" }), THRESHOLDS, NOW);
    expect(d.status).toBe("EXPIRING_SOON");
  });
});

describe("deriveStatus — threshold injection", () => {
  it("uses an injected window instead of the default", () => {
    const custom = { expiringSoonDays: 30 };
    const d = deriveStatus(input({ expiryDate: "2026-08-01" }), custom, NOW);
    expect(d.status).toBe("EXPIRING_SOON");
  });

  it("derives VALID outside a shorter injected window", () => {
    const custom = { expiringSoonDays: 7 };
    const d = deriveStatus(input({ expiryDate: "2026-08-20" }), custom, NOW);
    expect(d.status).toBe("VALID");
  });
});

describe("deriveStatus — review and validation gates", () => {
  it("derives INVALID with REVIEW_REJECTED when review was rejected", () => {
    const d = deriveStatus(
      input({ reviewStatus: "REJECTED", expiryDate: "2027-07-10" }),
      THRESHOLDS,
      NOW,
    );
    expect(d.status).toBe("INVALID");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.REVIEW_REJECTED);
    expect(d.reviewRequired).toBe(false);
  });

  it("derives INVALID with VALIDATION_INVALID when validation failed", () => {
    const d = deriveStatus(
      input({ validationStatus: "invalid", expiryDate: "2027-07-10" }),
      THRESHOLDS,
      NOW,
    );
    expect(d.status).toBe("INVALID");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.VALIDATION_INVALID);
  });

  it("derives PENDING_REVIEW (preserving the reason) when review is required", () => {
    const d = deriveStatus(
      input({
        reviewRequired: true,
        blocking: true,
        reasonCode: CERTIFICATE_REASON_CODES.IMO_MISMATCH,
      }),
      THRESHOLDS,
      NOW,
    );
    expect(d.status).toBe("PENDING_REVIEW");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.IMO_MISMATCH);
    expect(d.blocking).toBe(true);
    expect(d.reviewRequired).toBe(true);
  });

  it("never invents an expiry: null expiry derives PENDING_REVIEW MISSING_EXPIRY", () => {
    const d = deriveStatus(input({ expiryDate: null }), THRESHOLDS, NOW);
    expect(d.status).toBe("PENDING_REVIEW");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.MISSING_EXPIRY);
    expect(d.reviewRequired).toBe(true);
  });
});

describe("deriveStatus — placeholders", () => {
  it("derives MISSING for a known requirement with no evidence", () => {
    const d = deriveStatus(
      input({
        placeholder: true,
        reviewRequired: false,
        expiryDate: null,
        reasonCode: CERTIFICATE_REASON_CODES.MISSING_DOCUMENT,
      }),
      THRESHOLDS,
      NOW,
    );
    expect(d.status).toBe("MISSING");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.MISSING_DOCUMENT);
  });

  it("derives UNKNOWN for an uncertain-applicability placeholder", () => {
    const d = deriveStatus(
      input({
        placeholder: true,
        reviewRequired: false,
        expiryDate: null,
        reasonCode: CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY,
      }),
      THRESHOLDS,
      NOW,
    );
    expect(d.status).toBe("UNKNOWN");
    expect(d.reasonCode).toBe(CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY);
  });
});

describe("deriveRecordStatus — recompute from a stored record", () => {
  it("re-derives the snapshot fields for a record", () => {
    const d = deriveRecordStatus(record({ expiry_date: "2026-09-20" }), THRESHOLDS, NOW);
    expect(d.status).toBe("EXPIRING_SOON");
  });
});

describe("severityForEvent — INFO|MEDIUM|HIGH|CRITICAL scale", () => {
  it("maps CERTIFICATE_EXPIRED to HIGH, CRITICAL when blocking", () => {
    expect(severityForEvent("CERTIFICATE_EXPIRED", false)).toBe("HIGH");
    expect(severityForEvent("CERTIFICATE_EXPIRED", true)).toBe("CRITICAL");
  });

  it("maps CERTIFICATE_EXPIRING and MISSING to MEDIUM", () => {
    expect(severityForEvent("CERTIFICATE_EXPIRING", false)).toBe("MEDIUM");
    expect(severityForEvent("MISSING", false)).toBe("MEDIUM");
  });

  it("maps REVIEW_REQUIRED to HIGH, CRITICAL when blocking", () => {
    expect(severityForEvent("REVIEW_REQUIRED", false)).toBe("HIGH");
    expect(severityForEvent("REVIEW_REQUIRED", true)).toBe("CRITICAL");
  });

  it("maps CREATED / UPDATED / REPLACED to INFO", () => {
    expect(severityForEvent("CREATED", false)).toBe("INFO");
    expect(severityForEvent("UPDATED", false)).toBe("INFO");
    expect(severityForEvent("REPLACED", false)).toBe("INFO");
  });

  it("never returns the WARNING scale", () => {
    const values = ["CREATED", "UPDATED", "CERTIFICATE_EXPIRING", "CERTIFICATE_EXPIRED", "REPLACED", "MISSING", "REVIEW_REQUIRED"]
      .map((t) => severityForEvent(t, true));
    for (const v of values) {
      expect(["INFO", "MEDIUM", "HIGH", "CRITICAL"].includes(v)).toBe(true);
    }
  });
});

describe("buildExpiryDedupKey", () => {
  it("is stable per vessel, type and status", () => {
    const a = buildExpiryDedupKey("vsl-1", "LOAD_LINE", "EXPIRED");
    const b = buildExpiryDedupKey("vsl-1", "LOAD_LINE", "EXPIRED");
    expect(a).toBe(b);
  });

  it("differs across certificates of different types", () => {
    const a = buildExpiryDedupKey("vsl-1", "LOAD_LINE", "EXPIRED");
    const c = buildExpiryDedupKey("vsl-1", "ISCC", "EXPIRED");
    expect(a !== c).toBe(true);
  });
});

run();
