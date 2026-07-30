import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createDeadlineAlertService } from "../deadlines";
import type { DeadlineInfo } from "../types";

describe("DeadlineAlertService", () => {
  it("sends alerts for non-OK deadlines", async () => {
    const dispatched: Array<any> = [];
    const deadlines: DeadlineInfo[] = [
      { deadline_type: "ets_submission", label: "EU ETS Submission", due_date: "2025-03-31", days_remaining: -5, status: "OVERDUE" },
      { deadline_type: "fueleu_submission", label: "FuelEU Submission", due_date: "2025-02-15", days_remaining: 7, status: "URGENT" },
      { deadline_type: "mrv_verification", label: "MRV Verification", due_date: "2025-06-30", days_remaining: 60, status: "OK" },
    ];

    const svc = createDeadlineAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: `n-${dispatched.length}`, emailSent: true };
        },
      },
      getDeadlines: async () => deadlines,
      getVesselName: async () => "Test Vessel",
    });

    const results = await svc.checkAndAlert("v1", 2025, "user-1");

    expect(results.length).toBe(2);
    expect(dispatched.length).toBe(2);
    expect(dispatched[0]?.severity).toBe("CRITICAL");
    expect(dispatched[1]?.severity).toBe("HIGH");
  });

  it("does not send alerts when all deadlines are OK", async () => {
    const dispatched: Array<any> = [];
    const deadlines: DeadlineInfo[] = [
      { deadline_type: "ets_submission", label: "EU ETS", due_date: "2025-06-30", days_remaining: 120, status: "OK" },
    ];

    const svc = createDeadlineAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getDeadlines: async () => deadlines,
      getVesselName: async () => "Test Vessel",
    });

    const results = await svc.checkAndAlert("v1", 2025, "user-1");
    expect(results.length).toBe(0);
    expect(dispatched.length).toBe(0);
  });

  it("includes deadline metadata in the notification payload", async () => {
    const dispatched: Array<any> = [];
    const deadlines: DeadlineInfo[] = [
      { deadline_type: "ets_submission", label: "EU ETS", due_date: "2025-03-31", days_remaining: 5, status: "URGENT" },
    ];

    const svc = createDeadlineAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getDeadlines: async () => deadlines,
      getVesselName: async () => "Test Vessel",
    });

    await svc.checkAndAlert("v1", 2025, "user-1");

    const payload = dispatched[0]?.payload as Record<string, unknown>;
    expect(payload.deadline_type).toBe("ets_submission");
    expect(payload.due_date).toBe("2025-03-31");
    expect(payload.days_remaining).toBe(5);
    expect(payload.status).toBe("URGENT");
  });

  it("maps deadlines to correct event types", async () => {
    const dispatched: Array<any> = [];
    const deadlines: DeadlineInfo[] = [
      { deadline_type: "fueleu_submission", label: "FuelEU", due_date: "2025-02-15", days_remaining: 3, status: "URGENT" },
    ];

    const svc = createDeadlineAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getDeadlines: async () => deadlines,
      getVesselName: async () => "Test Vessel",
    });

    await svc.checkAndAlert("v1", 2025, "user-1");
    expect(dispatched[0]?.type).toBe("fueleu_deadline_urgent");
  });
});

run();
