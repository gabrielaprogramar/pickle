/**
 * certificates/__tests__/notifications.test.ts — registry event → notification mapping
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the five deterministic certificate notification types route correctly
 * from registry events, that CREATED/UPDATED do NOT dispatch, and that payload
 * severities use the INFO|MEDIUM|HIGH|CRITICAL scale.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  certificateNotificationTypeForEvent,
  buildCertificateNotification,
} from "../notifications";
import type { CertificateEvent } from "../types";

function event(
  overrides: Partial<CertificateEvent> = {},
): CertificateEvent {
  return {
    id: "evt-1",
    certificate_id: "cert-iapp",
    vessel_id: "vsl-aurelia",
    imo: "9074729",
    event_ts: "2026-07-10T12:00:00.000Z",
    event_type: "CERTIFICATE_EXPIRING",
    severity: "MEDIUM",
    previous_status: "VALID",
    new_status: "EXPIRING_SOON",
    reason_code: null,
    details: { expiry_date: "2026-09-20", days_remaining: 72 },
    dedup_key: "vsl-aurelia:ISCC:EXPIRING_SOON",
    created_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

const CERTIFICATE = {
  id: "cert-iscc",
  imo: "9074729",
  vessel_id: "vsl-aurelia",
  certificate_type: "ISCC",
  certificate_number: "ISCC-0012-99821",
};

describe("certificateNotificationTypeForEvent", () => {
  it("maps the five deterministic expiry/review event types", () => {
    expect(certificateNotificationTypeForEvent(event({ event_type: "CERTIFICATE_EXPIRING" }))).toBe("certificate_expiring");
    expect(certificateNotificationTypeForEvent(event({ event_type: "CERTIFICATE_EXPIRED" }))).toBe("certificate_expired");
    expect(certificateNotificationTypeForEvent(event({ event_type: "MISSING" }))).toBe("certificate_missing");
    expect(certificateNotificationTypeForEvent(event({ event_type: "REVIEW_REQUIRED" }))).toBe("certificate_review_required");
    expect(certificateNotificationTypeForEvent(event({ event_type: "REPLACED" }))).toBe("certificate_replaced");
  });

  it("returns null for CREATED and UPDATED", () => {
    expect(certificateNotificationTypeForEvent(event({ event_type: "CREATED" }))).toBeNull();
    expect(certificateNotificationTypeForEvent(event({ event_type: "UPDATED" }))).toBeNull();
  });
});

describe("buildCertificateNotification", () => {
  it("builds a certificate_expiring notification with the expiring copy", () => {
    const n = buildCertificateNotification({
      event: event(),
      certificate: CERTIFICATE,
    });
    expect(n).toBeTruthy();
    expect(n!.type).toBe("certificate_expiring");
    expect(n!.severity).toBe("MEDIUM");
    expect(n!.vessel_id).toBe("vsl-aurelia");
    expect(n!.title).toContainString("ISCC");
    expect(n!.message).toContainString("2026-09-20");
    expect(n!.payload?.certificate_id).toBe("cert-iscc");
    expect(n!.source_id).toBe("evt-1");
  });

  it("builds a certificate_expired notification with the expired copy", () => {
    const n = buildCertificateNotification({
      event: event({ event_type: "CERTIFICATE_EXPIRED", severity: "HIGH", new_status: "EXPIRED" }),
      certificate: CERTIFICATE,
    });
    expect(n!.type).toBe("certificate_expired");
    expect(n!.severity).toBe("HIGH");
    expect(n!.message).toContainString("passed its expiry date");
  });

  it("builds a certificate_missing notification", () => {
    const n = buildCertificateNotification({
      event: event({
        event_type: "MISSING",
        severity: "MEDIUM",
        details: { reference: "Load Line Convention (≥24 m international)" },
        reason_code: "MISSING_DOCUMENT",
      }),
      certificate: { ...CERTIFICATE, certificate_number: null },
    });
    expect(n!.type).toBe("certificate_missing");
    expect(n!.message).toContainString("no evidence is on file");
  });

  it("builds a certificate_review_required notification that never invents an expiry", () => {
    const n = buildCertificateNotification({
      event: event({
        event_type: "REVIEW_REQUIRED",
        severity: "HIGH",
        reason_code: "MISSING_EXPIRY",
        details: { expiry_date: null },
      }),
      certificate: CERTIFICATE,
    });
    expect(n!.type).toBe("certificate_review_required");
    expect(n!.severity).toBe("HIGH");
    expect(n!.message).toContainString("missing expiry");
    expect(n!.message).toContainString("No expiry date is invented");
  });

  it("returns null for a CREATED event", () => {
    const n = buildCertificateNotification({
      event: event({ event_type: "CREATED", severity: "INFO" }),
      certificate: CERTIFICATE,
    });
    expect(n).toBeNull();
  });

  it("keeps severities on the INFO|MEDIUM|HIGH|CRITICAL scale", () => {
    for (const eventType of ["CERTIFICATE_EXPIRING", "CERTIFICATE_EXPIRED", "MISSING", "REVIEW_REQUIRED", "REPLACED"] as const) {
      const n = buildCertificateNotification({
        event: event({ event_type: eventType, severity: eventType === "CERTIFICATE_EXPIRED" ? "HIGH" : eventType === "REPLACED" ? "INFO" : eventType === "CERTIFICATE_EXPIRING" || eventType === "MISSING" ? "MEDIUM" : "HIGH" }),
        certificate: CERTIFICATE,
      });
      expect(["INFO", "MEDIUM", "HIGH", "CRITICAL"].includes(n!.severity)).toBe(true);
    }
  });
});

run();
