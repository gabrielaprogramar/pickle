import type { NotificationEventType } from "@/lib/notifications";
import type { MaintenanceNotificationSeed } from "./mock-data";

export interface MaintenanceNotification {
  readonly type: NotificationEventType;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly timestamp: string;
}

const MAINTENANCE_EVENT_TYPES: ReadonlyArray<NotificationEventType> = [
  "survey_due",
  "survey_overdue",
  "certificate_expiring",
  "iscc_certificate_expiring",
  "iscc_certificate_missing",
  "monitoring_plan_review_due",
  "blocking_maintenance_detected",
];

export interface MaintenanceNotificationService {
  listForVessel(seeds: ReadonlyArray<MaintenanceNotificationSeed>): ReadonlyArray<MaintenanceNotification>;
  supportedEventTypes(): ReadonlyArray<NotificationEventType>;
  text(notifications: ReadonlyArray<MaintenanceNotification>): string;
}

export function createMaintenanceNotificationService(): MaintenanceNotificationService {
  function listForVessel(
    seeds: ReadonlyArray<MaintenanceNotificationSeed>,
  ): ReadonlyArray<MaintenanceNotification> {
    return seeds
      .filter((s) => (MAINTENANCE_EVENT_TYPES as ReadonlyArray<string>).includes(s.type))
      .map((s) => ({
        type: s.type as NotificationEventType,
        title: s.title,
        message: s.message,
        severity: s.severity,
        timestamp: s.timestamp,
      }));
  }

  function text(notifications: ReadonlyArray<MaintenanceNotification>): string {
    if (notifications.length === 0) {
      return "You have no maintenance alerts.";
    }
    return notifications
      .map((n) => `- ${n.title}: ${n.message} (${n.timestamp.slice(0, 10)})`)
      .join("\n");
  }

  return {
    listForVessel,
    supportedEventTypes: () => [...MAINTENANCE_EVENT_TYPES],
    text,
  };
}
