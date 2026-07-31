import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockSoxScenario, SOX_MOCK_SCENARIO_KEYS } from "../mock-data";
import { evaluateSox } from "../engine";

describe("sox-eca mock scenarios — all nine", () => {
  for (const key of SOX_MOCK_SCENARIO_KEYS) {
    it(`scenario "${key}" produces its expected deterministic outcome`, () => {
      const scenario = createMockSoxScenario(key);
      const res = evaluateSox(scenario.input);

      expect(res.watchStatus).toBe(scenario.expected.watchStatus);
      expect(res.severity).toBe(scenario.expected.severity);
      expect(res.evidenceStatus).toBe(scenario.expected.evidenceStatus);
      expect(res.insideEca).toBe(scenario.expected.insideEca);

      const ruleIds = res.ruleResults.map((r) => r.rule_id);
      for (const expectedRule of scenario.expected.ruleIds) {
        expect(ruleIds.includes(expectedRule)).toBe(true);
      }
    });
  }
});

describe("sox-eca mock scenarios — spot checks", () => {
  it("outside-conforming stays CLEAR under the global cap", () => {
    const res = evaluateSox(createMockSoxScenario("outside-conforming").input);
    expect(res.applicableLimitPct).toBe(0.5);
    expect(res.watchStatus).toBe("CLEAR");
  });

  it("inside-non-conforming is HIGH under the ECA limit", () => {
    const res = evaluateSox(createMockSoxScenario("inside-non-conforming").input);
    expect(res.applicableLimitPct).toBe(0.1);
    expect(res.watchStatus).toBe("NON_CONFORMING");
    expect(res.severity).toBe("HIGH");
  });

  it("entry-non-conforming flags the entry notice as WARNING", () => {
    const res = evaluateSox(createMockSoxScenario("entry-non-conforming").input);
    const entry = res.ruleResults.find((r) => r.rule_id === "SOX-ECA-01");
    expect(entry?.severity).toBe("WARNING");
    expect(res.zoneState).toBe("ENTRY");
  });

  it("geometry-unavailable never claims a position-based result", () => {
    const res = evaluateSox(createMockSoxScenario("geometry-unavailable").input);
    expect(res.geometryAvailable).toBe(false);
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-06")).toBe(true);
  });
});

run();
