import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { captainReadinessText, complianceSoxExplanation, soxSearchPhrases } from "../handoff";
import { evaluateSox } from "../engine";
import { createMockSoxScenario } from "../mock-data";

describe("sox-eca handoff — captain readiness", () => {
  it("tells the captain they are not okay on non-conforming evidence inside the ECA", () => {
    const res = evaluateSox(createMockSoxScenario("inside-non-conforming").input);
    const text = captainReadinessText(res);
    expect(text).toContainString("exceeds the 0.10% m/m");
    expect(text).toContainString("not okay for the Med");
  });

  it("confirms readiness on conforming evidence but never claims fuel-in-use", () => {
    const res = evaluateSox(createMockSoxScenario("inside-conforming").input);
    const text = captainReadinessText(res);
    expect(text).toContainString("within the 0.10% m/m");
    expect(text).toContainString("bunker evidence only");
  });

  it("asks for the BDN when no evidence exists inside the ECA", () => {
    const res = evaluateSox(createMockSoxScenario("inside-no-evidence").input);
    const text = captainReadinessText(res);
    expect(text).toContainString("upload the BDN");
  });

  it("says geometry is unavailable when it is", () => {
    const res = evaluateSox(createMockSoxScenario("geometry-unavailable").input);
    const text = captainReadinessText(res);
    expect(text).toContainString("geometry is not available");
  });
});

describe("sox-eca handoff — compliance explanation", () => {
  it("explains the regulatory basis without over-claiming", () => {
    const res = evaluateSox(createMockSoxScenario("inside-non-conforming").input);
    const statement = complianceSoxExplanation(res);
    expect(statement.target).toBe("compliance");
    expect(statement.answer).toContainString("MARPOL Annex VI Regulation 14");
    expect(statement.answer).toContainString("not a statement that the vessel is burning non-compliant fuel");
  });
});

describe("sox-eca handoff — search vocabulary", () => {
  it("exposes fleet search phrases", () => {
    const phrases = soxSearchPhrases();
    expect(phrases.some((p) => p.includes("SOx ECA warnings"))).toBe(true);
    expect(phrases.some((p) => p.includes("non-conforming on sulphur"))).toBe(true);
  });
});

run();
