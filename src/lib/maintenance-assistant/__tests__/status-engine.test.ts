import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createStatusEngine, DUE_SOON_DAYS, UPCOMING_DAYS } from "../status-engine";
import { createMockMaintenanceState, MAINTENANCE_MOCK_NOW } from "../mock-data";

describe("Maintenance Assistant — deterministic status engine", () => {
  const engine = createStatusEngine();
  const now = MAINTENANCE_MOCK_NOW;

  function isoDaysAgo(days: number): string {
    return new Date(new Date(now).getTime() - days * 86_400_000).toISOString();
  }

  it("marks a distant due date as CURRENT", () => {
    const status = engine.surveyStatus(isoDaysAgo(-200), true, now);
    expect(status).toBe("CURRENT");
  });

  it("marks a due date inside 90 days as UPCOMING", () => {
    const status = engine.surveyStatus(isoDaysAgo(-60), true, now);
    expect(status).toBe("UPCOMING");
  });

  it("marks a due date inside 30 days as DUE_SOON", () => {
    const status = engine.surveyStatus(isoDaysAgo(-DUE_SOON_DAYS), true, now);
    expect(status).toBe("DUE_SOON");
  });

  it("marks a past due date as OVERDUE", () => {
    const status = engine.surveyStatus(isoDaysAgo(5), true, now);
    expect(status).toBe("OVERDUE");
  });

  it("marks an overdue blocking survey type as BLOCKING", () => {
    const state = createMockMaintenanceState("multiple-deadlines");
    const renewal = state.schedule.find((s) => s.surveyType === "RENEWAL");
    expect(renewal?.status).toBe("BLOCKING");
    expect(renewal && renewal.status === "BLOCKING").toBe(true);
  });

  it("returns UNKNOWN when there is no data", () => {
    expect(engine.surveyStatus(null, false, now)).toBe("UNKNOWN");
    const state = createMockMaintenanceState("no-schedule");
    expect(state.schedule.length).toBe(0);
  });

  it("derives certificate status from expiry date only", () => {
    expect(engine.certificateStatus(isoDaysAgo(10), now)).toBe("EXPIRED");
    expect(engine.certificateStatus(isoDaysAgo(-20), now)).toBe("EXPIRING");
    expect(engine.certificateStatus(isoDaysAgo(-200), now)).toBe("VALID");
    expect(engine.certificateStatus(null, now)).toBe("VALID");
  });

  it("keeps overdue ANNUAL surveys as OVERDUE, not BLOCKING", () => {
    const state = createMockMaintenanceState("overdue-annual");
    const annual = state.schedule.find((s) => s.surveyType === "ANNUAL");
    expect(annual?.status).toBe("OVERDUE");
    expect(annual && annual.status === "BLOCKING").toBe(false);
  });

  it("computes the UPCOMING boundary at 90 days", () => {
    expect(engine.surveyStatus(isoDaysAgo(-UPCOMING_DAYS), true, now)).toBe("UPCOMING");
    expect(engine.surveyStatus(isoDaysAgo(-UPCOMING_DAYS - 1), true, now)).toBe("CURRENT");
  });

  it("builds a deterministic, sorted deadline list", () => {
    const state = createMockMaintenanceState("multiple-deadlines");
    const deadlines = engine.buildDeadlines(state.schedule, state.certificates, state.plan, now);
    expect(deadlines.length).toBeGreaterThan(0);
    const sorted = [...deadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    expect(deadlines.map((d) => d.dueDate)).toEqual(sorted.map((d) => d.dueDate));
    expect(deadlines.some((d) => d.blocking)).toBe(true);
  });

  it("reports a deterministic impact for an expired ISCC certificate", () => {
    const state = createMockMaintenanceState("expired-iscc");
    const impacts = engine.impactsForCertificates(state.certificates);
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0]?.impact).toBe("DETERMINISTIC_IMPACT");
  });

  it("never claims a legal consequence in the impact basis", () => {
    const state = createMockMaintenanceState("expired-iscc");
    const impacts = engine.impactsForCertificates(state.certificates);
    const joined = impacts.map((i) => `${i.claim} ${i.basis}`).join(" ").toLowerCase();
    expect(joined.includes("detention")).toBe(false);
    expect(joined.includes("fine")).toBe(false);
    expect(joined.includes("off-hire")).toBe(false);
  });

  it("explains a fact without deriving a consequence", () => {
    const state = createMockMaintenanceState("overdue-annual");
    const annual = state.schedule.find((s) => s.surveyType === "ANNUAL");
    const stmt = engine.explain(annual!, now);
    expect(stmt.impact).toBe("FACT");
    expect(stmt.claim).toContainString("passed its due date");
  });
});

run();
