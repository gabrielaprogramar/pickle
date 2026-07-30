import type { SafetyCheckResult, AssistantResponse, RegulatoryCitation } from "./types";

export interface SafetyLayerOptions {
  readonly requireCitations: boolean;
  readonly disallowedPatterns?: ReadonlyArray<RegExp>;
}

export interface SafetyLayer {
  checkResponse(response: AssistantResponse): SafetyCheckResult;
  validateContent(content: string): SafetyCheckResult;
  addDisclaimer(content: string): string;
  checkForMathLeak(content: string, toolResults: ReadonlyArray<unknown>): boolean;
  buildFinalResponse(content: string, citations: ReadonlyArray<RegulatoryCitation>, toolCalls: ReadonlyArray<unknown>): AssistantResponse;
  readonly STANDARD_DISCLAIMER: string;
}

const DEFAULT_DISALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore\s+previous\s+instructions/i,
  /you\s+are\s+now\s+(a|an)\s+(different|new)\s+(AI|assistant|bot)/i,
  /system\s+override/i,
  /[\w.-]+@[\w.-]+\.\w+/,
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
];

export const STANDARD_DISCLAIMER =
  "This information is provided for informational purposes only and does not constitute legal advice. Compliance figures are sourced from the Poseidon Ledger deterministic compliance engine. Users should verify all regulatory information with qualified professionals.";

export function createSafetyLayer(opts?: Partial<SafetyLayerOptions>): SafetyLayer {
  const requireCitations = opts?.requireCitations ?? true;
  const disallowedPatterns = opts?.disallowedPatterns ?? DEFAULT_DISALLOWED_PATTERNS;

  function validateContent(content: string): SafetyCheckResult {
    const warnings: string[] = [];
    const violations: string[] = [];

    for (const pattern of disallowedPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        if (match && match[0].includes("@")) {
          violations.push("Response contains email address (PII)");
        } else if (match && /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(match[0])) {
          violations.push("Response contains phone number (PII)");
        } else if (/ignore\s+previous\s+instructions/i.test(content)) {
          warnings.push("Response may contain prompt injection pattern: ignore previous instructions");
        } else if (/system\s+override/i.test(content)) {
          warnings.push("Response may contain prompt injection pattern: system override");
        } else {
          warnings.push(`Potential concern: matched pattern /${pattern.source}/`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      warnings,
      violations,
    };
  }

  function checkResponse(response: AssistantResponse): SafetyCheckResult {
    const contentCheck = validateContent(response.content);

    const allWarnings = [...contentCheck.warnings];
    const allViolations = [...contentCheck.violations];

    if (requireCitations && response.citations.length === 0 && response.content.length > 0) {
      allWarnings.push("Response contains content but no citations provided");
    }

    if (!response.disclaimer) {
      allWarnings.push("Response is missing standard disclaimer");
    }

    return {
      passed: allViolations.length === 0,
      warnings: allWarnings,
      violations: allViolations,
    };
  }

  function addDisclaimer(content: string): string {
    if (content.includes(STANDARD_DISCLAIMER)) return content;
    return content + "\n\n---\n" + STANDARD_DISCLAIMER;
  }

  function checkForMathLeak(content: string, toolResults: ReadonlyArray<unknown>): boolean {
    const numberPattern = /\b(\d+[\d,.]*(?:\.\d+)?)\s*(tonnes|tCO2|CO2|%|percent|EUR|€|gCO2e)\b/gi;
    let match: RegExpExecArray | null;
    const re = new RegExp(numberPattern.source, numberPattern.flags);
    const contentNumbers: Array<{ value: string; unit: string }> = [];

    while ((match = re.exec(content)) !== null) {
      const val = match[1]!;
      const value = val.replace(/,/g, "");
      const num = parseFloat(value);
      if (num > 0 && num < 1_000_000_000) {
        contentNumbers.push({ value, unit: match[2]! });
      }
    }

    if (contentNumbers.length === 0) return false;

    const toolJson = JSON.stringify(toolResults).toLowerCase();

    const leakCount = contentNumbers.filter((n) => {
      if (toolJson.includes(n.value)) return false;
      if (toolJson.includes(n.unit.toLowerCase())) return false;
      const combined = n.value + n.unit.toLowerCase();
      const contentLower = content.toLowerCase();
      if (toolJson.includes(combined)) return false;
      return !contentLower.includes("example") && !contentLower.includes("approximately");
    }).length;

    return leakCount > 0;
  }

  function buildFinalResponse(
    content: string,
    citations: ReadonlyArray<RegulatoryCitation>,
    toolCalls: ReadonlyArray<unknown>,
  ): AssistantResponse {
    const withDisclaimer = addDisclaimer(content);
    const safetyResult = {
      passed: true,
      warnings: [] as string[],
      violations: [] as string[],
    };

    if (requireCitations && citations.length === 0 && content.length > 0) {
      safetyResult.warnings.push("Response contains content but no citations");
    }

    return {
      content: withDisclaimer,
      citations,
      toolCalls: toolCalls as any,
      disclaimer: STANDARD_DISCLAIMER,
      safetyCheck: safetyResult,
    };
  }

  return {
    checkResponse,
    validateContent,
    addDisclaimer,
    checkForMathLeak,
    buildFinalResponse,
    STANDARD_DISCLAIMER,
  };
}
