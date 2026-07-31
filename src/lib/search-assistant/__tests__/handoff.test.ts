import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createComplianceHandoffDetector, hasComplianceIntent } from "../handoff";

describe("SearchAssistant handoff detector", () => {
  const detector = createComplianceHandoffDetector();

  it("hands off EUA obligation questions to compliance", () => {
    const d = detector.detect("What is Aurelia's EUA obligation?");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("compliance");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("hands off penalty cost questions", () => {
    const d = detector.detect("How much will we pay in penalties?");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("compliance");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("hands off non-compliance questions", () => {
    const d = detector.detect("Why is Aurelia non-compliant?");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("compliance");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("short-circuits retrieval for 'show me' queries", () => {
    const d = detector.detect("Show me vessels with a FuelEU deficit.");
    expect(d.handoff).toBe(false);
  });

  it("short-circuits retrieval for 'find the' queries", () => {
    const d = detector.detect("Find the report containing Aurelia's EUA obligation.");
    expect(d.handoff).toBe(false);
  });

  it("does not hand off BDN retrieval", () => {
    const d = detector.detect("Find all BDNs from Palma");
    expect(d.handoff).toBe(false);
  });

  it("hasComplianceIntent detects EUA obligation", () => {
    expect(hasComplianceIntent("what is my EUA obligation")).toBe(true);
  });

  it("hasComplianceIntent ignores pure retrieval phrasing", () => {
    expect(hasComplianceIntent("find the report")).toBe(false);
  });
});

run();
