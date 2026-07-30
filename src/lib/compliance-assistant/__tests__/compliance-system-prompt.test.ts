import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { buildComplianceSystemPrompt } from "../system-prompt";
import { STANDARD_DISCLAIMER } from "@/lib/assistant/safety";

describe("buildComplianceSystemPrompt", () => {
  it("includes the standard disclaimer", () => {
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString(STANDARD_DISCLAIMER);
  });

  it("includes vessel context when provided", () => {
    const prompt = buildComplianceSystemPrompt({
      vesselContext: { id: "v-1", name: "Test Vessel", imo: "9876543" },
    });
    expect(prompt).toContainString("Test Vessel");
    expect(prompt).toContainString("IMO 9876543");
    expect(prompt).toContainString("v-1");
  });

  it("includes current date when not provided", () => {
    const today = new Date().toISOString().split("T")[0]!;
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString(today);
  });

  it("includes current date when provided explicitly", () => {
    const prompt = buildComplianceSystemPrompt({ currentDate: "2026-01-15" });
    expect(prompt).toContainString("2026-01-15");
  });

  it("includes mandated rules about no legal advice", () => {
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString("refuse any request framed as legal advice");
    expect(prompt).toContainString("do NOT provide legal advice");
  });

  it("includes mandated rules about citing sources", () => {
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString("MUST include a citation");
    expect(prompt).toContainString("Sources");
  });

  it("includes the compliance assistant role description", () => {
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString("Compliance Assistant");
    expect(prompt).toContainString("advisory maritime compliance analyst");
  });

  it("includes response structure section", () => {
    const prompt = buildComplianceSystemPrompt();
    expect(prompt).toContainString("**Answer**");
    expect(prompt).toContainString("**Evidence**");
    expect(prompt).toContainString("**Recommended action**");
  });
});

run();
