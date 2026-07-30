import type { EmailNotification } from "./types";

export interface NotificationEmailProvider {
  send(notification: EmailNotification): Promise<void>;
}

export interface MockNotificationEmailProvider extends NotificationEmailProvider {
  readonly sent: ReadonlyArray<EmailNotification>;
  reset(): void;
}

export function createNotificationEmailProvider(): NotificationEmailProvider {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_MODE === "true") {
    return createMockNotificationEmailProvider();
  }
  return createProductionNotificationEmailProvider();
}

export function createMockNotificationEmailProvider(): MockNotificationEmailProvider {
  const sent: EmailNotification[] = [];

  return {
    get sent(): ReadonlyArray<EmailNotification> {
      return sent;
    },

    reset(): void {
      sent.length = 0;
    },

    async send(notification: EmailNotification): Promise<void> {
      sent.push(notification);
    },
  };
}

function createProductionNotificationEmailProvider(): NotificationEmailProvider {
  return {
    async send(_notification: EmailNotification): Promise<void> {
      throw new Error("Production email provider not configured");
    },
  };
}
