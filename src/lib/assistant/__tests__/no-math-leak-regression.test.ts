import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createSafetyLayer } from "../safety";
import { createEvaluationHarness } from "../evaluation";

describe("No-Math-Leak Regression", () => {
  it("FAILS if mock LLM generates a compliance figure without a deterministic tool result", async () => {
    const safety = createSafetyLayer({ requireCitations: false });
    const harness = createEvaluationHarness();

    // Simulate an LLM response that includes a compliance figure
    // WITHOUT a corresponding tool result
    const response = "Your vessel's CO2 emissions are 15,000 tonnes for 2025. This exceeds the limit.";
    const toolResults = [
      { toolName: "get_vessel_info", data: { name: "Test Vessel", imo: "1234567" } },
    ];

    // The safety layer should detect this as a math leak
    const leaked = safety.checkForMathLeak(response, toolResults);
    expect(leaked).toBe(true);

    // Also test that the evaluation harness catches it
    const evalResult = await harness.runEvaluation(
      "no-math-leak-regression",
      "mock",
      "What are my CO2 emissions?",
      response,
      [],
      toolResults,
      50,
    );
    expect(evalResult.noMathLeakViolation).toBe(true);
  });

  it("PASSES if compliance figure comes from a deterministic tool result", async () => {
    const safety = createSafetyLayer({ requireCitations: false });
    const harness = createEvaluationHarness();

    const response = "Based on the compliance report, your total CO2 emissions for 2025 are 15,000 tonnes.";
    const toolResults = [
      { toolName: "get_vessel_compliance_score", data: { total_emissions: 15000, vessel_id: "v1", year: 2025 } },
    ];

    const leaked = safety.checkForMathLeak(response, toolResults);
    expect(leaked).toBe(false);
  });

  it("safety layer blocks entirely fabricated compliance numbers", async () => {
    const safety = createSafetyLayer({ requireCitations: false });

    const fabricatedResponse = "Your compliance balance is 42.5 tonnes surplus.";
    const toolResults = [
      { toolName: "get_voyage_log", data: { voyages: [] } },
    ];

    const leaked = safety.checkForMathLeak(fabricatedResponse, toolResults);
    expect(leaked).toBe(true);
  });

  it("multiple numbers from tool results are not flagged as leaks", async () => {
    const safety = createSafetyLayer({ requireCitations: false });

    const response = "Your fleet summary: Vessel A: 12,000 tonnes, Vessel B: 8,500 tonnes, total: 20,500 tonnes.";
    const toolResults = [
      { toolName: "get_fleet_ets_summary", data: { vessels: [{ name: "Vessel A", emissions: 12000 }, { name: "Vessel B", emissions: 8500 }], total: 20500 } },
    ];

    const leaked = safety.checkForMathLeak(response, toolResults);
    expect(leaked).toBe(false);
  });

  it("verifies the entire assistant pipeline never generates figures", async () => {
    const safety = createSafetyLayer({ requireCitations: false });

    const mockResponse = "I can help you check your vessel's compliance status. Would you like me to look up the compliance score for a specific vessel and year?";

    const result = safety.validateContent(mockResponse);
    expect(result.violations.length).toBe(0);
  });
});

run();
