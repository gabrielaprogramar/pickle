import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createComplianceAlertService } from "../compliance-alerts";

describe("ComplianceAlertService", () => {
  it("sends a violation alert with HIGH severity", async () => {
    const dispatched: Array<any> = [];

    const svc = createComplianceAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getVesselName: async () => "Test Vessel",
    });

    const notifId = await svc.alertViolation("v1", "user-1", "HIGH", "ghg_intensity_exceeded", "GHG intensity exceeds FuelEU target");

    expect(notifId).toBe("n1");
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("compliance_violation_error");
    expect(dispatched[0]?.severity).toBe("HIGH");
  });

  it("sends a violation alert with CRITICAL severity", async () => {
    const dispatched: Array<any> = [];

    const svc = createComplianceAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getVesselName: async () => "Test Vessel",
    });

    await svc.alertViolation("v1", "user-1", "CRITICAL", "missing_iscc", "ISCC certificate missing for biofuel delivery");

    expect(dispatched[0]?.severity).toBe("CRITICAL");
    expect(dispatched[0]?.message).toContainString("ISCC certificate missing");
  });

  it("sends a warning alert with MEDIUM severity", async () => {
    const dispatched: Array<any> = [];

    const svc = createComplianceAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getVesselName: async () => "Test Vessel",
    });

    const notifId = await svc.alertWarning("v1", "user-1", "low_sulphur_warning", "Sulphur content approaching limit");

    expect(notifId).toBe("n1");
    expect(dispatched[0]?.type).toBe("compliance_violation_warning");
    expect(dispatched[0]?.severity).toBe("MEDIUM");
  });

  it("includes vessel name in notification title", async () => {
    const dispatched: Array<any> = [];

    const svc = createComplianceAlertService({
      notifDispatcher: {
        dispatch: async (event: any) => {
          dispatched.push(event);
          return { notificationId: "n1", emailSent: true };
        },
      },
      getVesselName: async () => "Atlantic Voyager",
    });

    await svc.alertWarning("v1", "user-1", "test_rule", "Test warning");
    expect(dispatched[0]?.title).toContainString("Atlantic Voyager");
  });
});

run();
