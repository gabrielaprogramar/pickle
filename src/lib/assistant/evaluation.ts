import type { EvaluationResult, RegulatoryCitation } from "./types";
import type { AssistantEvaluationLogRepository } from "@/lib/supabase";

export interface EvaluationHarnessOptions {
  readonly evalLogRepo?: AssistantEvaluationLogRepository;
}

export interface EvaluationHarness {
  runEvaluation(testName: string, assistantType: string, query: string, response: string | null, citations: ReadonlyArray<RegulatoryCitation>, toolCalls: ReadonlyArray<unknown>, latencyMs: number): Promise<EvaluationResult>;
  checkCitationAccuracy(citations: ReadonlyArray<RegulatoryCitation>, responseContent: string): number;
  checkNoMathLeak(responseContent: string, toolResults: ReadonlyArray<unknown>): boolean;
  checkToolSelectionAccuracy(expectedTools: ReadonlyArray<string>, actualTools: ReadonlyArray<string>): number;
  logResult(result: EvaluationResult): Promise<void>;
  getResults(testName?: string): Promise<ReadonlyArray<EvaluationResult>>;
}

export function createEvaluationHarness(opts: EvaluationHarnessOptions = {}): EvaluationHarness {
  const resultsStore = new Map<string, Array<EvaluationResult>>();

  function checkCitationAccuracy(citations: ReadonlyArray<RegulatoryCitation>, responseContent: string): number {
    if (citations.length === 0 || !responseContent) return 0;

    let found = 0;
    for (const cit of citations) {
      const excerpt_lower = cit.excerpt.slice(0, 80).toLowerCase();
      if (responseContent.toLowerCase().includes(excerpt_lower)) {
        found++;
      }
      const source_lower = cit.source.toLowerCase();
      if (responseContent.toLowerCase().includes(source_lower)) {
        found++;
      }
    }

    const maxPossible = citations.length * 2;
    return maxPossible > 0 ? Math.min(found / maxPossible, 1.0) : 0;
  }

  function checkNoMathLeak(responseContent: string, toolResults: ReadonlyArray<unknown>): boolean {
    if (!responseContent) return false;

    const numberPattern = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.?\d*)\s*(tonnes|tCO2|CO2|%|percent|EUR|€|gCO2e|g\/kWh|MJ)\b/gi;
    const matches: Array<{ value: string; unit: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = numberPattern.exec(responseContent)) !== null) {
      const val = match[1]!;
      const unt = match[2]!;
      matches.push({ value: val.replace(/,/g, ""), unit: unt.toLowerCase() });
    }

    if (matches.length === 0) return false;

    const toolJson = JSON.stringify(toolResults).toLowerCase();

    for (const m of matches) {
      const valueInTool = toolJson.includes(m.value);
      const unitInTool = toolJson.includes(m.unit);
      if (!valueInTool && !unitInTool) {
        return true;
      }
    }

    return false;
  }

  function checkToolSelectionAccuracy(expectedTools: ReadonlyArray<string>, actualTools: ReadonlyArray<string>): number {
    if (expectedTools.length === 0 && actualTools.length === 0) return 1.0;
    if (expectedTools.length === 0) return 0.0;

    const expectedSet = new Set(expectedTools.map((t) => t.toLowerCase()));
    const actualSet = new Set(actualTools.map((t) => t.toLowerCase()));

    let correct = 0;
    for (const t of actualSet) {
      if (expectedSet.has(t)) correct++;
    }

    const precision = actualSet.size > 0 ? correct / actualSet.size : 0;
    const recall = expectedSet.size > 0 ? correct / expectedSet.size : 0;

    if (precision + recall === 0) return 0;
    return 2 * (precision * recall) / (precision + recall);
  }

  return {
    async runEvaluation(
      testName: string,
      assistantType: string,
      query: string,
      response: string | null,
      citations: ReadonlyArray<RegulatoryCitation>,
      toolCalls: ReadonlyArray<unknown>,
      latencyMs: number,
    ): Promise<EvaluationResult> {
      const citationAccuracy = checkCitationAccuracy(citations, response ?? "");
      const noMathLeakViolation = response ? checkNoMathLeak(response, toolCalls) : false;

      const result: EvaluationResult = {
        testName,
        assistantType,
        query,
        response,
        citationAccuracy,
        retrievalPrecision: null,
        hallucinationFlag: noMathLeakViolation,
        toolSelectionAccuracy: null,
        responseLatencyMs: latencyMs,
        noMathLeakViolation,
      };

      const existing = resultsStore.get(testName) ?? [];
      existing.push(result);
      resultsStore.set(testName, existing);

      return result;
    },

    checkCitationAccuracy,
    checkNoMathLeak,

    checkToolSelectionAccuracy(expectedTools: ReadonlyArray<string>, actualTools: ReadonlyArray<string>): number {
      return checkToolSelectionAccuracy(expectedTools, actualTools);
    },

    async logResult(result: EvaluationResult): Promise<void> {
      if (!opts.evalLogRepo) return;
      await opts.evalLogRepo.insert({
        test_name: result.testName,
        assistant_type: result.assistantType,
        query: result.query,
        response: result.response,
        citation_accuracy: result.citationAccuracy,
        retrieval_precision: result.retrievalPrecision,
        hallucination_flag: result.hallucinationFlag,
        tool_selection_accuracy: result.toolSelectionAccuracy,
        response_latency_ms: result.responseLatencyMs,
        no_math_leak_violation: result.noMathLeakViolation,
      });
    },

    async getResults(testName?: string): Promise<ReadonlyArray<EvaluationResult>> {
      if (testName) {
        return resultsStore.get(testName) ?? [];
      }
      const all: Array<EvaluationResult> = [];
      for (const results of resultsStore.values()) {
        all.push(...results);
      }
      return all;
    },
  };
}
