import type { NotificationEvent, DeadlineInfo } from "./types";
import { formatDeadlineTemplate } from "./templates";

const SEVERITY_MAP: Record<string, "INFO" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  OK: "INFO",
  WARNING: "MEDIUM",
  URGENT: "HIGH",
  OVERDUE: "CRITICAL",
};

const EVENT_TYPE_MAP: Record<string, string> = {
  ets_deadline: "ets_deadline_warning",
  ets_submission: "ets_deadline_urgent",
  ets_verification: "ets_deadline_warning",
  fueleu_deadline: "fueleu_deadline_warning",
  fueleu_submission: "fueleu_deadline_urgent",
  fueleu_verification: "fueleu_deadline_warning",
  mrv_submission: "ets_deadline_warning",
  mrv_verification: "ets_deadline_warning",
  iscc_certificate: "iscc_certificate_expiring",
};

export interface DeadlineAlertServiceOptions {
  readonly notifDispatcher: {
    dispatch(event: NotificationEvent): Promise<unknown>;
  };
  readonly getDeadlines: (vesselId: string, year: number) => Promise<ReadonlyArray<DeadlineInfo>>;
  readonly getVesselName: (vesselId: string) => Promise<string | null>;
}

export interface DeadlineAlertService {
  checkAndAlert(vesselId: string, year: number, recipientId: string): Promise<ReadonlyArray<{ deadline: DeadlineInfo; alertSent: boolean }>>;
}

export function createDeadlineAlertService(opts: DeadlineAlertServiceOptions): DeadlineAlertService {
  return {
    async checkAndAlert(vesselId: string, year: number, recipientId: string): Promise<ReadonlyArray<{ deadline: DeadlineInfo; alertSent: boolean }>> {
      const deadlines = await opts.getDeadlines(vesselId, year);
      const vesselName = (await opts.getVesselName(vesselId)) ?? "Unknown Vessel";
      const results: Array<{ deadline: DeadlineInfo; alertSent: boolean }> = [];

      for (const deadline of deadlines) {
        if (deadline.status === "OK") continue;

        const severity = SEVERITY_MAP[deadline.status] ?? "INFO";
        const eventType = EVENT_TYPE_MAP[deadline.deadline_type] ?? "ets_deadline_warning";

        const template = formatDeadlineTemplate(deadline);

        const event: NotificationEvent = {
          type: eventType as NotificationEvent["type"],
          recipient_id: recipientId,
          vessel_id: vesselId,
          title: template.subject,
          message: template.text,
          severity,
          payload: {
            deadline_type: deadline.deadline_type,
            due_date: deadline.due_date,
            days_remaining: deadline.days_remaining,
            status: deadline.status,
          },
          source_event: "deadline_check",
          source_id: `${vesselId}_${deadline.deadline_type}_${year}`,
        };

        await opts.notifDispatcher.dispatch(event);
        results.push({ deadline, alertSent: true });
      }

      return results;
    },
  };
}
