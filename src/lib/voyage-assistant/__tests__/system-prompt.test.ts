import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { buildVoyageSystemPrompt } from "../system-prompt";
import { VOYAGE_SYSTEM_PROMPT_VERSION } from "../types";

describe("Voyage Assistant — system prompt", () => {
  const prompt = buildVoyageSystemPrompt(
    { vesselName: "Aurelia", vesselImo: "9074729" },
    VOYAGE_SYSTEM_PROMPT_VERSION,
  );

  it("is versioned", () => {
    expect(prompt).toContainString(`Voyage Assistant (v${VOYAGE_SYSTEM_PROMPT_VERSION})`);
  });

  it("states it is not a voyage planner", () => {
    expect(prompt.toLowerCase()).toContainString("not a voyage planner");
  });

  it("requires deterministic values only", () => {
    expect(prompt).toContainString("never calculate or invent");
    expect(prompt).toContainString("deterministic");
  });

  it("states ETS coverage is stored, never computed from ports", () => {
    expect(prompt).toContainString("ETS coverage rates are STORED values");
    expect(prompt).toContainString("do not derive them from the ports");
  });

  it("states distances are stored, never recomputed from coordinates", () => {
    expect(prompt).toContainString("Distance values are STORED values");
  });

  it("forbids fabricating AIS positions", () => {
    expect(prompt).toContainString("never fabricate, synthesize, or invent positions");
  });

  it("encodes the full AIS gap ladder", () => {
    expect(prompt).toContainString("INTERPOLATION_OK");
    expect(prompt).toContainString("FLAGGED");
    expect(prompt).toContainString("MANUAL_REQUIRED");
    expect(prompt).toContainString("CRITICAL_ESCALATION");
    expect(prompt).toContainString("6 hours to 48 hours");
    expect(prompt).toContainString("over 48 hours");
  });

  it("encodes the handoff rules", () => {
    expect(prompt).toContainString("Captain Assistant");
    expect(prompt).toContainString("Compliance Assistant");
    expect(prompt).toContainString("Search Assistant");
  });

  it("declares memory is context, never authority", () => {
    expect(prompt).toContainString("context, never authority");
  });

  it("requires saying so when data is missing", () => {
    expect(prompt).toContainString("do not fabricate it");
  });
});

run();
