/**
 * certificates/notifications.ts — certificate registry notification mapping
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Maps a persisted certificate registry event to the shared notification system.
 * Event severities already use the notification scale (INFO|MEDIUM|HIGH|CRITICAL),
 * so no remapping is needed. The five deterministic expiry/review event types are
 * routed here; CREATED/UPDATED/REPLACED resolve per type below.
 */

import type {
  NotificationEvent,
  NotificationEventType,
} from "@/lib/notifications";
import type { CertificateEvent, CertificateSeverity } from "./types";

export type { CertificateSeverity };

export function certificateNotificationTypeForEvent(
  event: Pick<CertificateEvent, "event_type" | "severity">,
): NotificationEventType | null {
  switch (event.event_type) {
    case "CERTIFICATE_EXPIRED":
      return "certificate_expired";
    case "CERTIFICATE_EXPIRING":
      return "certificate_expiring";
    case "MISSING":
      return "certificate_missing";
    case "REVIEW_REQUIRED":
      return "certificate_review_required";
    case "REPLACED":
      return "certificate_replaced";
    case "CREATED":
    case "UPDATED":
      return null;
    default:
      return null;
  }
}

export interface CertificateNotificationInput {
  readonly event: CertificateEvent;
  readonly certificate: {
    readonly id: string;
    readonly imo: string;
    readonly vessel_id: string;
    readonly certificate_type: string;
    readonly certificate_number: string | null;
    readonly certificate_title?: string;
  };
}

export function buildCertificateNotification({
  event,
  certificate,
}: CertificateNotificationInput): NotificationEvent | null {
  const type = certificateNotificationTypeForEvent(event);
  if (!type) return null;

  const label = certificate.certificate_title ?? certificate.certificate_type;
  const number = certificate.certificate_number ?? "no certificate number on file";

  let title: string;
  let message: string;

  switch (type) {
    case "certificate_expired":
      title = `Certificate expired — ${label} (IMO ${certificate.imo})`;
      message =
        `${label} (${number}) passed its expiry date on ${(event.details?.expiry_date as string | undefined) ?? "file"}. ` +
        `This is derived from the expiry date on the evidence — review the record and renew.`;
      break;
    case "certificate_expiring":
      title = `Certificate expiring soon — ${label} (IMO ${certificate.imo})`;
      message =
        `${label} (${number}) expires on ${(event.details?.expiry_date as string | undefined) ?? "file"} ` +
        `(${event.details?.days_remaining ?? "?"} days remaining). Renew before expiry.`;
      break;
    case "certificate_missing":
      title = `Certificate missing — ${label} (IMO ${certificate.imo})`;
      message =
        `${label} is a known requirement (${(event.details?.reference as string | undefined) ?? "see requirement source"}) ` +
        `but no evidence is on file. Upload the certificate document.`;
      break;
    case "certificate_review_required":
      title = `Certificate review required — ${label} (IMO ${certificate.imo})`;
      message =
        `${label} (${number}) requires human review: ${(event.reason_code ?? "PENDING_REVIEW").replaceAll("_", " ").toLowerCase()}. ` +
        `No expiry date is invented — resolve the review task.`;
      break;
    case "certificate_replaced":
      title = `Certificate record replaced — ${label} (IMO ${certificate.imo})`;
      message = `${label} (${number}) was superseded by a new registry version (v${event.details?.version ?? "?"}).`;
      break;
    default:
      return null;
  }

  return {
    type,
    recipient_id: "ops-001",
    vessel_id: certificate.vessel_id,
    organization_id: "org-001",
    title,
    message,
    severity: event.severity,
    payload: {
      certificate_id: certificate.id,
      imo: certificate.imo,
      certificate_type: certificate.certificate_type,
      certificate_number: certificate.certificate_number,
      event_type: event.event_type,
      reason_code: event.reason_code,
      expiry_date: event.details?.expiry_date ?? null,
    },
    source_event: event.event_type,
    source_id: event.id,
  };
}
