import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createNotificationDispatcher } from "../dispatcher";
import type { NotificationEvent } from "../types";

function createMockOptions() {
  const notifStore: Array<Record<string, unknown>> = [];

  return {
    notifRepo: {
      insert: async (input: Record<string, unknown>) => {
        const id = `notif-${notifStore.length + 1}`;
        notifStore.push({ id, ...input });
        return { id };
      },
    },
    emailProvider: {
      send: async () => {},
    },
    prefService: {
      isNotificationEnabled: async () => true,
      isEmailEnabled: async () => true,
    },
  };
}

const baseEvent: NotificationEvent = {
  type: "ets_deadline_warning",
  recipient_id: "user-1",
  vessel_id: "v1",
  title: "ETS Deadline Approaching",
  message: "ETS submission deadline is in 30 days",
  severity: "HIGH",
  payload: { days_remaining: 30 },
  source_event: "deadline_check",
  source_id: "v1_ets_2025",
};

describe("NotificationDispatcher", () => {
  it("dispatches a notification and inserts it into the repo", async () => {
    const opts = createMockOptions();
    let insertCalled = false;
    let sendCalled = false;
    opts.notifRepo.insert = async () => { insertCalled = true; return { id: "n1" }; };
    opts.emailProvider.send = async () => { sendCalled = true; };

    const dispatcher = createNotificationDispatcher(opts);
    const result = await dispatcher.dispatch(baseEvent);

    expect(result.notificationId).toBeTruthy();
    expect(insertCalled).toBe(true);
    expect(sendCalled).toBe(true);
    expect(result.emailSent).toBe(true);
  });

  it("does not send email when notification type is disabled", async () => {
    const opts = createMockOptions();
    opts.prefService.isNotificationEnabled = async () => false;
    let sendCalled = false;
    opts.emailProvider.send = async () => { sendCalled = true; };

    const dispatcher = createNotificationDispatcher(opts);
    const result = await dispatcher.dispatch(baseEvent);

    expect(result.notificationId).toBeTruthy();
    expect(sendCalled).toBe(false);
    expect(result.emailSent).toBe(false);
  });

  it("still dispatches in-app when email fails", async () => {
    const opts = createMockOptions();
    opts.emailProvider.send = async () => { throw new Error("SMTP error"); };

    const dispatcher = createNotificationDispatcher(opts);
    const result = await dispatcher.dispatch(baseEvent);

    expect(result.notificationId).toBeTruthy();
    expect(result.emailSent).toBe(false);
  });

  it("stores payload and source metadata correctly", async () => {
    const opts = createMockOptions();
    let capturedInput: any = null;
    opts.notifRepo.insert = async (input: Record<string, unknown>) => {
      capturedInput = input;
      return { id: "n1" };
    };

    const dispatcher = createNotificationDispatcher(opts);
    await dispatcher.dispatch(baseEvent);

    expect(capturedInput?.notification_type).toBe("ets_deadline_warning");
    expect(capturedInput?.severity).toBe("HIGH");
    expect(capturedInput?.recipient_id).toBe("user-1");
    expect(capturedInput?.vessel_id).toBe("v1");
    expect(capturedInput?.source_event).toBe("deadline_check");
    expect(capturedInput?.source_id).toBe("v1_ets_2025");
  });

  it("handles minimal event without optional fields", async () => {
    const opts = createMockOptions();
    let capturedInput: any = null;
    opts.notifRepo.insert = async (input: Record<string, unknown>) => {
      capturedInput = input;
      return { id: "n1" };
    };

    const dispatcher = createNotificationDispatcher(opts);

    const minimalEvent: NotificationEvent = {
      type: "report_generated",
      recipient_id: "user-1",
      title: "Report Ready",
      message: "Your report is ready",
      severity: "INFO",
    };

    await dispatcher.dispatch(minimalEvent);

    expect(capturedInput?.notification_type).toBe("report_generated");
    expect(capturedInput?.severity).toBe("INFO");
    expect(capturedInput?.vessel_id).toBeNull();
    expect(capturedInput?.organization_id).toBeNull();
    expect(capturedInput?.source_event).toBeNull();
    expect(capturedInput?.source_id).toBeNull();
  });
});

run();
