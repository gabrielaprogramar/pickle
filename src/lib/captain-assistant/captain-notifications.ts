import type { NotificationEventType } from "@/lib/notifications";
import type { CaptainNotificationSeed } from "./mock-data";

export interface CaptainNotification {
  readonly type: NotificationEventType;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly timestamp: string;
}

const CAPTAIN_EVENT_TYPES: ReadonlyArray<NotificationEventType> = [
  "bdn_auto_accepted",
  "bdn_review_required",
  "bdn_ocr_failed",
  "green_zone_port_alert",
  "iscc_certificate_expiring",
  "iscc_certificate_missing",
];

export interface CaptainNotificationService {
  listForVessel(seeds: ReadonlyArray<CaptainNotificationSeed>): ReadonlyArray<CaptainNotification>;
  supportedEventTypes(): ReadonlyArray<NotificationEventType>;
  text(notifications: ReadonlyArray<CaptainNotification>): string;
}

export function createCaptainNotificationService(): CaptainNotificationService {
  function listForVessel(seeds: ReadonlyArray<CaptainNotificationSeed>): ReadonlyArray<CaptainNotification> {
    return seeds
      .filter((s) => (CAPTAIN_EVENT_TYPES as ReadonlyArray<string>).includes(s.type))
      .map((s) => ({
        type: s.type as NotificationEventType,
        title: s.title,
        message: s.message,
        severity: s.severity,
        timestamp: s.timestamp,
      }));
  }

  function text(notifications: ReadonlyArray<CaptainNotification>): string {
    if (notifications.length === 0) {
      return "You have no alerts.";
    }
    return notifications
      .map((n) => `- ${n.title}: ${n.message} (${n.timestamp.slice(0, 10)})`)
      .join("\n");
  }

  return {
    listForVessel,
    supportedEventTypes: () => [...CAPTAIN_EVENT_TYPES],
    text,
  };
}
