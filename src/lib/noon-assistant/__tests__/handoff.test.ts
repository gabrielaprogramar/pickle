/**
 * handoff.test.ts — noon-assistant handoff detector tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Run via: npx tsx src/lib/noon-assistant/__tests__/handoff.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createNoonHandoffDetector } from "../handoff";

const detector = createNoonHandoffDetector();

describe("Noon handoff detector — captain", () => {
  it("hands off port-readiness questions", () => {
    const d = detector.detect("am i ready for the port");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("captain");
    expect(d.confidence >= 0.6).toBe(true);
    expect(d.confidence <= 1.0).toBe(true);
    expect(d.reason).toContainString("Captain Assistant");
  });

  it("hands off BDN requests", () => {
    const d = detector.detect("where is the bdn");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("captain");
  });
});

describe("Noon handoff detector — compliance", () => {
  it("hands off FuelEU/EU ETS interpretation questions", () => {
    const d = detector.detect("what does this mean for ets");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("compliance");
    expect(d.reason).toContainString("Compliance Assistant");
  });

  it("hands off obligation and penalty questions", () => {
    expect(detector.detect("what obligation do we have for ets").target).toBe("compliance");
    expect(detector.detect("what is the co2 penalty").target).toBe("compliance");
  });
});

describe("Noon handoff detector — search & voyage", () => {
  it("hands off document retrieval", () => {
    const d = detector.detect("find all bdns");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("captain");
  });

  it("hands off AIS / voyage-ledger questions", () => {
    const d = detector.detect("ais gap analysis");
    expect(d.handoff).toBe(true);
    expect(d.target).toBe("voyage");
    expect(d.reason).toContainString("Voyage Assistant");
  });
});

describe("Noon handoff detector — handled locally", () => {
  it("keeps noon-report questions local", () => {
    const d = detector.detect("what is the latest report");
    expect(d.handoff).toBe(false);
    expect(d.target).toBe("none");
    expect(d.confidence).toBe(0);
  });
});

run();
