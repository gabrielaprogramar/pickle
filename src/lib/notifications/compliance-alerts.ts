import type { NotificationEvent } from "./types";
import { formatComplianceTemplate } from "./templates";

export interface ComplianceAlertServiceOptions {
  readonly notifDispatcher: {
    dispatch(event: NotificationEvent): Promise<unknown>;
  };
  readonly getVesselName: (vesselId: string) => Promise<string | null>;
}

export interface ComplianceAlertService {
  alertViolation(
    vesselId: string,
    recipientId: string,
    severity: "HIGH" | "CRITICAL",
    ruleName: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<string>;
  alertWarning(
    vesselId: string,
    recipientId: string,
    ruleName: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<string>;
}

export function createComplianceAlertService(opts: ComplianceAlertServiceOptions): ComplianceAlertService {
  async function sendAlert(
    vesselId: string,
    recipientId: string,
    severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL",
    eventType: NotificationEvent["type"],
    ruleName: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    const vesselName = (await opts.getVesselName(vesselId)) ?? "Unknown Vessel";
    const template = formatComplianceTemplate(severity, vesselName, message);

    const event: NotificationEvent = {
      type: eventType,
      recipient_id: recipientId,
      vessel_id: vesselId,
      title: template.subject,
      message,
      severity,
      payload: { rule_name: ruleName, ...details },
      source_event: "compliance_check",
      source_id: `${vesselId}_${ruleName}`,
    };

    const result = await opts.notifDispatcher.dispatch(event) as { notificationId: string };
    return result.notificationId;
  }

  return {
    async alertViolation(
      vesselId: string,
      recipientId: string,
      severity: "HIGH" | "CRITICAL",
      ruleName: string,
      message: string,
      details?: Record<string, unknown>,
    ): Promise<string> {
      return sendAlert(vesselId, recipientId, severity, "compliance_violation_error", ruleName, message, details);
    },

    async alertWarning(
      vesselId: string,
      recipientId: string,
      ruleName: string,
      message: string,
      details?: Record<string, unknown>,
    ): Promise<string> {
      return sendAlert(vesselId, recipientId, "MEDIUM", "compliance_violation_warning", ruleName, message, details);
    },
  };
}
