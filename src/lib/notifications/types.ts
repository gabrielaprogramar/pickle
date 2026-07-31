export const NOTIFICATION_SYSTEM_VERSION = "1.0.0";

export type NotificationEventType =
  | "ets_deadline_warning"
  | "ets_deadline_urgent"
  | "ets_deadline_overdue"
  | "fueleu_deadline_warning"
  | "fueleu_deadline_urgent"
  | "fueleu_deadline_overdue"
  | "bdn_auto_accepted"
  | "bdn_review_required"
  | "bdn_ocr_failed"
  | "compliance_violation_error"
  | "compliance_violation_warning"
  | "ais_data_gap"
  | "ais_sync_failed"
  | "green_zone_port_alert"
  | "iscc_certificate_expiring"
  | "iscc_certificate_missing"
  | "report_generated"
  | "verifier_package_generated"
  | "verifier_package_failed"
  | "survey_due"
  | "survey_overdue"
  | "certificate_expiring"
  | "monitoring_plan_review_due"
  | "blocking_maintenance_detected";

export interface NotificationEvent {
  readonly type: NotificationEventType;
  readonly recipient_id: string;
  readonly vessel_id?: string | null;
  readonly organization_id?: string | null;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly payload?: Record<string, unknown> | null;
  readonly source_event?: string | null;
  readonly source_id?: string | null;
}

export interface EmailNotification {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string | null;
  readonly notificationType: string;
}

export interface DeadlineInfo {
  readonly deadline_type: string;
  readonly label: string;
  readonly due_date: string;
  readonly days_remaining: number;
  readonly status: "OK" | "WARNING" | "URGENT" | "OVERDUE";
}
