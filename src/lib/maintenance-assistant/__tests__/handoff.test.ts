import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMaintenanceHandoffDetector } from "../handoff";

describe("Maintenance Assistant — handoff detection", () => {
  const detector = createMaintenanceHandoffDetector();

  it("routes port-operation and BDN questions to the captain", () => {
    const decision = detector.detect("Am I ready for the port of Genoa?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("captain");
    expect(decision.confidence).toBeGreaterThan(0.6);
  });

  it("routes compliance interpretation to the compliance assistant", () => {
    const decision = detector.detect("Is this certificate non-compliant?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("compliance");
  });

  it("routes document retrieval to the search assistant", () => {
    const decision = detector.detect("find certificates expiring this year");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("search");
  });

  it("keeps survey and certificate questions in scope", () => {
    const decision = detector.detect("When is the annual survey due?");
    expect(decision.handoff).toBe(false);
    expect(decision.target).toBe("none");
  });

  it("explains the reason for every handoff", () => {
    const decision = detector.detect("How much CO2 did we emit?");
    expect(decision.handoff).toBe(true);
    expect(decision.reason.length).toBeGreaterThan(0);
  });
});

run();
