import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockCaptainState } from "../mock-data";
import { createReadinessEngine } from "../readiness";
import { createCaptainToolRegistry } from "../captain-tools";
import { makeContext } from "./_factory";

describe("Captain Assistant — port readiness", () => {
  const engine = createReadinessEngine();
  const registry = createCaptainToolRegistry();
  const context = makeContext();

  function evaluate(scenario: string) {
    const state = createMockCaptainState(scenario as "amber");
    const calls = registry.getUpcomingPortCalls({ context, state });
    return engine.evaluate({
      vessel: state.vessel,
      portCalls: calls.data,
      requirements: state.requirements,
      documents: state.documents,
      iscc: state.iscc,
      ingest: state.ingest,
    });
  }

  it("classifies a fully ready port call as GREEN", () => {
    const result = evaluate("green");
    expect(result.level).toBe("GREEN");
    expect(result.checklist.every((c) => c.status === "GREEN")).toBe(true);
    expect(result.missingBlocking.length).toBe(0);
  });

  it("classifies a missing non-blocking document as AMBER", () => {
    const result = evaluate("amber");
    expect(result.level).toBe("AMBER");
    const iscc = result.checklist.find((c) => c.requirement.toLowerCase().includes("iscc"));
    expect(iscc?.status).toBe("AMBER");
    expect(iscc && iscc.missing !== null).toBe(true);
    expect(result.missingBlocking.length).toBe(0);
  });

  it("classifies a missing blocking document as RED", () => {
    const result = evaluate("red");
    expect(result.level).toBe("RED");
    const iapp = result.checklist.find((c) => c.requirement.toLowerCase().includes("iapp"));
    expect(iapp?.status).toBe("RED");
    expect(result.missingBlocking.length).toBeGreaterThan(0);
  });

  it("never invents requirements: every checklist item has a source", () => {
    const result = evaluate("amber");
    for (const item of result.checklist) {
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it("lists the upcoming port in the result", () => {
    const result = evaluate("amber");
    expect(result.port).toBe("Antibes");
    expect(result.arrivalDate !== null).toBe(true);
  });

  it("reports no port call when none is scheduled", () => {
    const result = evaluate("no-port");
    expect(result.portCallId).toBeNull();
    expect(result.checklist.length).toBe(0);
  });

  it("refuses to confirm readiness without requirement data", () => {
    const result = evaluate("unknown");
    expect(result.level).toBe("RED");
    expect(result.summary).toContainString("no requirement data");
  });

  it("treats a BDN that is only received as AMBER, not complete", () => {
    const state = createMockCaptainState("bdn-received" as "amber");
    const calls = registry.getUpcomingPortCalls({ context, state });
    const result = engine.evaluate({
      vessel: state.vessel,
      portCalls: calls.data,
      requirements: state.requirements,
      documents: state.documents,
      iscc: state.iscc,
      ingest: state.ingest,
    });
    const bdn = result.checklist.find((c) => c.requirement.toLowerCase().includes("bdn"));
    expect(bdn?.status).toBe("AMBER");
  });

  it("treats a completed BDN as GREEN evidence", () => {
    const state = createMockCaptainState("bdn-complete" as "amber");
    const calls = registry.getUpcomingPortCalls({ context, state });
    const result = engine.evaluate({
      vessel: state.vessel,
      portCalls: calls.data,
      requirements: state.requirements,
      documents: state.documents,
      iscc: state.iscc,
      ingest: state.ingest,
    });
    const bdn = result.checklist.find((c) => c.requirement.toLowerCase().includes("bdn"));
    expect(bdn?.status).toBe("GREEN");
  });
});

run();
