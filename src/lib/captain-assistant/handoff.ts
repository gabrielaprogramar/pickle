export interface CaptainHandoffDecision {
  readonly handoff: boolean;
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface CaptainHandoffDetector {
  detect(query: string): CaptainHandoffDecision;
}

const COMPLIANCE_PATTERNS: ReadonlyArray<string> = [
  "non-compliant",
  "compliance score",
  "compliance balance",
  "eua obligation",
  "obligation",
  "penalty",
  "surplus",
  "deficit",
  "ghg intensity",
  "emission factor",
  "calculate",
  "how much co2",
  "compliance status",
];

const SEARCH_PATTERNS: ReadonlyArray<string> = [
  "find ",
  "search",
  "locate",
  "look up",
  "find me",
  "show me the document",
  "find my last bdn",
  "where is the document",
];

export function createCaptainHandoffDetector(): CaptainHandoffDetector {
  function detect(query: string): CaptainHandoffDecision {
    const lower = query.toLowerCase().trim();

    const compliance = COMPLIANCE_PATTERNS.filter((p) => lower.includes(p));
    if (compliance.length > 0) {
      return {
        handoff: true,
        target: "compliance",
        confidence: Math.min(0.6 + compliance.length * 0.15, 1.0),
        reason: `This is a compliance question (${compliance.join(", ")}). The Captain Assistant stays advisory and never calculates compliance figures; routing to the Compliance Assistant.`,
      };
    }

    const search = SEARCH_PATTERNS.filter((p) => lower.includes(p));
    if (search.length > 0) {
      return {
        handoff: true,
        target: "search",
        confidence: Math.min(0.6 + search.length * 0.15, 1.0),
        reason: `This is a retrieval request (${search.join(", ")}). Routing to the Search Assistant for a full search.`,
      };
    }

    return { handoff: false, target: "none", confidence: 0, reason: "Handled by the Captain Assistant." };
  }

  return { detect };
}
