/**
 * noon-report/notifications.ts — noon report notification mapping
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Maps high-value findings from a noon report evaluation to the shared
 * notification system. INFO-level findings are suppressed (they are not worth
 * a notification), matching the SOx ECA notification convention.
 *
 * Introduced event types (see src/lib/notifications/types.ts):
 *   noon_report_received        — new noon report stored
 *   noon_impossible_fuel        — consumption exceeds opening ROB + deliveries
 *   noon_unexpected_consumption — consumption deviates from the ROB delta
 *   noon_heavy_weather          — wind ≥ 28 kt at report time
 *   noon_unexpected_delay       — behind schedule / predicted late arrival
 *   noon_fuel_discrepancy       — fuel correlation delivery inconsistency
 *   noon_voyage_anomaly         — voyage correlation anomaly
 *   noon_rob_inconsistency      — ROB delta vs reported consumption mismatch
 *   noon_low_confidence         — extraction confidence below threshold
 */

import type { NotificationEvent, NotificationEventType } from "@/lib/notifications";
import type { NoonFinding, NoonReportAnalysis, NoonReportDomain } from "./types";

export function findingToNotificationSeverity(severity: NoonFinding["severity"]): NotificationEvent["severity"] {
  switch (severity) {
    case "BLOCKING":
    case "ERROR":
      return "HIGH";
    case "WARNING":
      return "MEDIUM";
    default:
      return "INFO";
  }
}

/** Map a finding to the notification event type (null = do not notify). */
export function noonNotificationTypeForFinding(
  finding: NoonFinding,
): NotificationEventType | null {
  switch (finding.id) {
    case "noon.fuel.impossible_consumption":
      return "noon_impossible_fuel";
    case "noon.fuel.rob_inconsistency":
      return "noon_rob_inconsistency";
    case "noon.fuel.delivery_discrepancy":
      return "noon_fuel_discrepancy";
    case "noon.weather.significant":
      return "noon_heavy_weather";
    case "noon.deviation.consumption":
      return "noon_unexpected_consumption";
    case "noon.deviation.arrival":
    case "noon.voyage.late_arrival":
    case "noon.voyage.behind_schedule":
      return "noon_unexpected_delay";
    case "noon.voyage.anomaly":
      return "noon_voyage_anomaly";
    case "noon.data_quality.low_confidence":
      return "noon_low_confidence";
    default:
      return null;
  }
}

export interface NoonNotificationInput {
  readonly report: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
  readonly findings: ReadonlyArray<NoonFinding>;
  readonly reportReceived?: boolean;
}

/** Build the list of notifications to dispatch for an evaluated report. */
export function buildNoonNotifications(
  input: NoonNotificationInput,
): NotificationEvent[] {
  const { report, analysis, findings } = input;
  const vessel = analysis.vessel;
  const notifications: NotificationEvent[] = [];

  if (input.reportReceived) {
    notifications.push({
      type: "noon_report_received",
      recipient_id: "ops-001",
      vessel_id: vessel.vesselId,
      organization_id: "org-001",
      title: `Noon report received — ${vessel.name}`,
      message:
        `Noon report for ${report.reportDate.slice(0, 10)} received for ${vessel.name} ` +
        `(IMO ${vessel.imo}).`,
      severity: "INFO",
      payload: {
        imo: vessel.imo,
        report_date: report.reportDate,
        report_id: report.id,
      },
      source_event: "noon_report_received",
      source_id: report.id,
    });
  }

  for (const finding of findings) {
    const type = noonNotificationTypeForFinding(finding);
    if (!type || finding.severity === "INFO") continue;
    const severity = findingToNotificationSeverity(finding.severity);

    notifications.push({
      type,
      recipient_id: "ops-001",
      vessel_id: vessel.vesselId,
      organization_id: "org-001",
      title: notificationTitle(type, vessel.name),
      message: finding.reason,
      severity,
      payload: {
        imo: vessel.imo,
        report_date: report.reportDate,
        report_id: report.id,
        finding_id: finding.id,
        field: finding.field,
      },
      source_event: "noon_evaluation",
      source_id: report.id,
    });
  }

  return notifications;
}

function notificationTitle(type: NotificationEventType, vesselName: string): string {
  switch (type) {
    case "noon_impossible_fuel":
      return `Impossible fuel consumption — ${vesselName}`;
    case "noon_unexpected_consumption":
      return `Unexpected consumption — ${vesselName}`;
    case "noon_heavy_weather":
      return `Heavy weather — ${vesselName}`;
    case "noon_unexpected_delay":
      return `Unexpected delay — ${vesselName}`;
    case "noon_fuel_discrepancy":
      return `Fuel discrepancy — ${vesselName}`;
    case "noon_voyage_anomaly":
      return `Voyage anomaly — ${vesselName}`;
    case "noon_rob_inconsistency":
      return `ROB inconsistency — ${vesselName}`;
    case "noon_low_confidence":
      return `Low-confidence noon report — ${vesselName}`;
    default:
      return `Noon report — ${vesselName}`;
  }
}
