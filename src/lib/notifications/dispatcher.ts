import type { NotificationEvent, EmailNotification } from "./types";
import type { NotificationInsert } from "@/lib/supabase";

export interface NotificationDispatcherOptions {
  readonly notifRepo: {
    insert(notification: NotificationInsert): Promise<{ id: string }>;
  };
  readonly emailProvider: {
    send(notification: EmailNotification): Promise<void>;
  };
  readonly prefService: {
    isNotificationEnabled(recipientId: string, type: string): Promise<boolean>;
    isEmailEnabled(recipientId: string, type: string): Promise<boolean>;
  };
  readonly templateFormatter?: {
    formatDeadline?: (info: unknown) => { subject: string; html: string; text: string };
    formatCompliance?: (severity: string, vesselName: string, message: string) => { subject: string; html: string; text: string };
    formatReport?: (reportType: string, vesselName: string, year: number) => { subject: string; html: string; text: string };
    formatBdn?: (event: string, vesselName: string, filename: string) => { subject: string; html: string; text: string };
    formatVerifierPackage?: (vesselName: string, year: number, status: string) => { subject: string; html: string; text: string };
    formatSox?: (severity: string, vesselName: string, message: string) => { subject: string; html: string; text: string };
  };
}

export interface NotificationDispatcher {
  dispatch(event: NotificationEvent): Promise<{ notificationId: string; emailSent: boolean }>;
}

export function createNotificationDispatcher(opts: NotificationDispatcherOptions): NotificationDispatcher {
  return {
    async dispatch(event: NotificationEvent): Promise<{ notificationId: string; emailSent: boolean }> {
      const enabled = await opts.prefService.isNotificationEnabled(event.recipient_id, event.type);
      if (!enabled) {
        const insert: NotificationInsert = {
          recipient_id: event.recipient_id,
          notification_type: event.type,
          severity: event.severity,
          vessel_id: event.vessel_id ?? null,
          organization_id: event.organization_id ?? null,
          title: event.title,
          message: event.message,
          payload: event.payload ?? null,
          source_event: event.source_event ?? null,
          source_id: event.source_id ?? null,
        };
        const created = await opts.notifRepo.insert(insert);
        return { notificationId: created.id, emailSent: false };
      }

      const insert: NotificationInsert = {
        recipient_id: event.recipient_id,
        notification_type: event.type,
        severity: event.severity,
        vessel_id: event.vessel_id ?? null,
        organization_id: event.organization_id ?? null,
        title: event.title,
        message: event.message,
        payload: event.payload ?? null,
        source_event: event.source_event ?? null,
        source_id: event.source_id ?? null,
      };

      const created = await opts.notifRepo.insert(insert);
      let emailSent = false;

      const emailEnabled = await opts.prefService.isEmailEnabled(event.recipient_id, event.type);
      if (emailEnabled) {
        try {
          const isSox = event.type.startsWith("sox_eca_");
          const formatted = isSox && opts.templateFormatter?.formatSox
            ? opts.templateFormatter.formatSox(event.severity, event.vessel_id ?? "Vessel", event.message)
            : null;
          const emailNotification: EmailNotification = {
            to: event.recipient_id,
            subject: formatted?.subject ?? event.title,
            html: formatted?.html ?? `<p>${event.message}</p>`,
            text: formatted?.text ?? event.message,
            notificationType: event.type,
          };
          await opts.emailProvider.send(emailNotification);
          emailSent = true;
        } catch {
          // Email failure should not cause notification dispatch to fail
        }
      }

      return { notificationId: created.id, emailSent };
    },
  };
}
