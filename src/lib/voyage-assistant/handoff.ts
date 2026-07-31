export interface VoyageHandoffDecision {
  readonly handoff: boolean;
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface VoyageHandoffDetector {
  detect(query: string): VoyageHandoffDecision;
}

const CAPTAIN_PATTERNS: ReadonlyArray<string> = [
  "am i ready",
  "ready for the port",
  "port readiness",
  "bdn",
  "next port",
  "arrival requirements",
  "pre-arrival",
  "arrival formalities",
  "berth allocation",
];

const COMPLIANCE_PATTERNS: ReadonlyArray<string> = [
  "what does this mean for",
  "what does this mean",
  "how much co2",
  "how much will",
  "ets penalty",
  "eua obligation",
  "surrendering",
  "surplus",
  "deficit",
  "compliance balance",
  "compliance score",
  "is this compliant",
  "non-compliant",
  "ghg intensity",
  "fueleu",
  "ets allowance",
  "co2 liability",
];

const COMPLIANCE_REGEXES: ReadonlyArray<RegExp> = [
  /why.*ets.*(covered|coverage)/i,
  /what.*ets.*(mean|imply|impact|consequence)/i,
  /what.*(mean|imply|impact|consequence).*ets/i,
  /obligation.*(ets|co2|eua)/i,
  /penalty.*(ets|co2|eua)/i,
];

const SEARCH_PATTERNS: ReadonlyArray<string> = [
  "find all",
  "find every",
  "locate all",
  "search the document",
  "search for the",
  "look up",
  "find me",
];

export function createVoyageHandoffDetector(): VoyageHandoffDetector {
  function detect(query: string): VoyageHandoffDecision {
    const lower = query.toLowerCase().trim();

    const captain = CAPTAIN_PATTERNS.filter((p) => lower.includes(p));
    if (captain.length > 0) {
      return {
        handoff: true,
        target: "captain",
        confidence: Math.min(0.6 + captain.length * 0.15, 1.0),
        reason: `This is a port-operation or BDN question (${captain.join(", ")}). Routing to the Captain Assistant for port readiness.`,
      };
    }

    const compliance = COMPLIANCE_PATTERNS.filter((p) => lower.includes(p));
    const complianceRegex = COMPLIANCE_REGEXES.filter((r) => r.test(lower));
    if (compliance.length > 0 || complianceRegex.length > 0) {
      const matched = [...compliance, ...complianceRegex.map((r) => r.source)];
      return {
        handoff: true,
        target: "compliance",
        confidence: Math.min(0.6 + matched.length * 0.15, 1.0),
        reason: `This requires a compliance interpretation (${matched.join(", ")}). The Voyage Assistant reports stored voyage facts; routing to the Compliance Assistant for what the ETS picture means.`,
      };
    }

    const search = SEARCH_PATTERNS.filter((p) => lower.includes(p));
    if (search.length > 0) {
      return {
        handoff: true,
        target: "search",
        confidence: Math.min(0.6 + search.length * 0.15, 1.0),
        reason: `This is a retrieval request (${search.join(", ")}). Routing to the Search Assistant to locate documents or records.`,
      };
    }

    return { handoff: false, target: "none", confidence: 0, reason: "Handled by the Voyage Assistant." };
  }

  return { detect };
}
