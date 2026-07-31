export interface ComplianceHandoffDetector {
  detect(query: string): {
    handoff: boolean;
    target: string;
    confidence: number;
    reason: string;
  };
}

const HIGH_CONFIDENCE_PATTERNS: ReadonlyArray<string> = [
  "how much",
  "calculate",
  "eua obligation",
  "obligation",
  "penalty",
  "compliance score",
  "compliance balance",
  "surplus",
  "deficit",
  "non-compliant",
  "ghg intensity",
  "emission factor",
];

const SEARCH_FIRST_PATTERNS: ReadonlyArray<string> = [
  "show me",
  "find the",
  "find ",
  "list ",
  "search for",
  "search ",
];

const COMPLIANCE_DOMAIN_TERMS: ReadonlyArray<string> = [
  "obligation",
  "eua obligation",
  "penalty",
  "compliance",
  "surplus",
  "deficit",
  "ghg intensity",
  "emission factor",
  "non-compliant",
];

export function hasComplianceIntent(query: string): boolean {
  const lower = query.toLowerCase();
  return COMPLIANCE_DOMAIN_TERMS.some((term) => lower.includes(term));
}

export function createComplianceHandoffDetector(): ComplianceHandoffDetector {
  function detect(query: string): {
    handoff: boolean;
    target: string;
    confidence: number;
    reason: string;
  } {
    const lower = query.toLowerCase().trim();

    const retrieval = SEARCH_FIRST_PATTERNS.filter((pattern) => lower.includes(pattern));
    if (retrieval.length > 0) {
      return {
        handoff: false,
        target: "none",
        confidence: 1.0,
        reason: `Retrieval intent detected (${retrieval.join(", ")}); keeping search in the Search Assistant.`,
      };
    }

    const matched = HIGH_CONFIDENCE_PATTERNS.filter((pattern) => lower.includes(pattern));
    if (matched.length > 0) {
      return {
        handoff: true,
        target: "compliance",
        confidence: Math.min(0.6 + matched.length * 0.2, 1.0),
        reason: `Query requests a compliance calculation or explanation (${matched.join(", ")}); routing to the Compliance Assistant.`,
      };
    }

    return {
      handoff: false,
      target: "none",
      confidence: 0,
      reason: "No compliance calculation intent detected.",
    };
  }

  return { detect };
}
