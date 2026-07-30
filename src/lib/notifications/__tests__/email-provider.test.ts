import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockNotificationEmailProvider } from "../email-provider";
import type { EmailNotification } from "../types";

describe("MockNotificationEmailProvider", () => {
  it("starts with empty sent list", () => {
    const provider = createMockNotificationEmailProvider();
    expect(provider.sent.length).toBe(0);
  });

  it("records sent emails", async () => {
    const provider = createMockNotificationEmailProvider();

    const email: EmailNotification = {
      to: "user@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      notificationType: "test",
    };

    await provider.send(email);
    expect(provider.sent.length).toBe(1);
    expect(provider.sent[0]?.to).toBe("user@example.com");
    expect(provider.sent[0]?.subject).toBe("Test Subject");
  });

  it("records multiple sent emails", async () => {
    const provider = createMockNotificationEmailProvider();

    await provider.send({ to: "a@x.com", subject: "S1", html: "", text: null, notificationType: "t1" });
    await provider.send({ to: "b@x.com", subject: "S2", html: "", text: null, notificationType: "t2" });
    await provider.send({ to: "c@x.com", subject: "S3", html: "", text: null, notificationType: "t3" });

    expect(provider.sent.length).toBe(3);
  });

  it("supports reset", async () => {
    const provider = createMockNotificationEmailProvider();

    await provider.send({ to: "a@x.com", subject: "S1", html: "", text: null, notificationType: "t1" });
    expect(provider.sent.length).toBe(1);

    provider.reset();
    expect(provider.sent.length).toBe(0);
  });

  it("preserves email content", async () => {
    const provider = createMockNotificationEmailProvider();

    const email: EmailNotification = {
      to: "captain@vessel.com",
      subject: "Compliance Alert — Test Vessel",
      html: "<h1>Alert</h1><p>Critical issue</p>",
      text: "Alert: Critical issue",
      notificationType: "compliance_violation_error",
    };

    await provider.send(email);
    expect(provider.sent[0]?.to).toBe("captain@vessel.com");
    expect(provider.sent[0]?.subject).toBe("Compliance Alert — Test Vessel");
    expect(provider.sent[0]?.html).toBe("<h1>Alert</h1><p>Critical issue</p>");
    expect(provider.sent[0]?.notificationType).toBe("compliance_violation_error");
  });

  it("works across multiple dispatches", async () => {
    const provider = createMockNotificationEmailProvider();

    await provider.send({ to: "ops@fleet.com", subject: "BDN Processed", html: "", text: null, notificationType: "bdn_auto_accepted" });
    await provider.send({ to: "ops@fleet.com", subject: "Report Generated", html: "", text: null, notificationType: "report_generated" });

    expect(provider.sent.length).toBe(2);
    expect(provider.sent[0]?.subject).toBe("BDN Processed");
    expect(provider.sent[1]?.subject).toBe("Report Generated");
  });
});

run();
