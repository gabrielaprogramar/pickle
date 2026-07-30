import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createEvaluationHarness } from "../evaluation";

describe("EvaluationHarness", () => {
  it("runEvaluation returns evaluation result", async () => {
    const harness = createEvaluationHarness();
    const result = await harness.runEvaluation(
      "test-citation-accuracy",
      "mock",
      "What is EU ETS?",
      "The EU ETS requires monitoring of CO2 emissions.",
      [],
      [],
      100,
    );
    expect(result.testName).toBe("test-citation-accuracy");
    expect(result.query).toBe("What is EU ETS?");
  });

  it("checkCitationAccuracy returns 0 when no citations match response", async () => {
    const harness = createEvaluationHarness();
    const accuracy = harness.checkCitationAccuracy(
      [],
      "Some response with no citations",
    );
    expect(accuracy).toBe(0);
  });

  it("checkNoMathLeak returns false when tool results contain all numbers in response", async () => {
    const harness = createEvaluationHarness();
    const leaked = harness.checkNoMathLeak(
      "Emissions are 15000 tonnes of CO2.",
      [{ data: { total_emissions: 15000 } }],
    );
    expect(leaked).toBe(false);
  });

  it("checkNoMathLeak returns true when number in response not in any tool result", async () => {
    const harness = createEvaluationHarness();
    const leaked = harness.checkNoMathLeak(
      "Your compliance balance is 12.5 tonnes. Penalty is 50000 EUR.",
      [{ data: { name: "Test" } }],
    );
    expect(leaked).toBe(true);
  });

  it("logResult persists evaluation result", async () => {
    const stored: Array<Record<string, unknown>> = [];
    const mockRepo = {
      insert: async (input: any) => {
        stored.push(input);
        return { id: "eval-1", ...input };
      },
      findById: async () => null,
      listByTestName: async () => [],
      list: async () => [],
    };
    const harness = createEvaluationHarness({ evalLogRepo: mockRepo as any });
    await harness.logResult({
      testName: "test-log",
      assistantType: "mock",
      query: "test",
      response: "response",
      citationAccuracy: 0.5,
      retrievalPrecision: null,
      hallucinationFlag: false,
      toolSelectionAccuracy: null,
      responseLatencyMs: 100,
      noMathLeakViolation: false,
    });
    expect(stored.length).toBeGreaterThan(0);
  });

  it("checkToolSelectionAccuracy returns 1 when all expected tools match", async () => {
    const harness = createEvaluationHarness();
    const accuracy = harness.checkToolSelectionAccuracy(
      ["tool_a", "tool_b"],
      ["tool_a", "tool_b"],
    );
    expect(accuracy).toBe(1);
  });

  it("checkToolSelectionAccuracy returns 0 when no tools match", async () => {
    const harness = createEvaluationHarness();
    const accuracy = harness.checkToolSelectionAccuracy(
      ["tool_a", "tool_b"],
      ["tool_c", "tool_d"],
    );
    expect(accuracy).toBe(0);
  });
});

run();
