export interface NoonHandoffDecision {
  readonly handoff: boolean;
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface NoonHandoffDetector {
  detect(query: string): NoonHandoffDecision;
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
  "weather routing",
  "routing advice",
  "change course",
  "slow down",
  "speed up",
  "should we sail",
  "is it safe to sail",
  "navigate",
];

const COMPLIANCE_PATTERNS: ReadonlyArray<string> = [
  "what does this mean for",
  "how much co2",
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
  "penalty",
  "reward",
];

const COMPLIANCE_REGEXES: ReadonlyArray<RegExp> = [
  /what.*(mean|imply|impact|consequence).*(fueleu|ets)/i,
  /obligation.*(ets|co2|eua|fueleu)/i,
  /penalty.*(ets|co2|eua|fueleu)/i,
  /how much (will|would).*(pay|owe|cost)/i,
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

const VOYAGE_PATTERNS: ReadonlyArray<string> = [
  "ais gap",
  "data gap",
  "voyage ledger",
  "ets coverage",
  "port call",
  "voyage classification",
  "green zone",
];

export function createNoonHandoffDetector(): NoonHandoffDetector {
  function detect(query: string): NoonHandoffDecision {
    const lower = query.toLowerCase().trim();

    const voyage = VOYAGE_PATTERNS.filter((p) => lower.includes(p));
    if (voyage.length > 0) {
      return {
        handoff: true,
        target: "voyage",
        confidence: Math.min(0.6 + voyage.length * 0.15, 1.0),
        reason: `This is a voyage-ledger or AIS-integrity question (${voyage.join(", ")}). Routing to the Voyage Assistant.`,
      };
    }

    const captain = CAPTAIN_PATTERNS.filter((p) => lower.includes(p));
    if (captain.length > 0) {
      return {
        handoff: true,
        target: "captain",
        confidence: Math.min(0.6 + captain.length * 0.15, 1.0),
        reason: `This is a port-operation or navigation question (${captain.join(", ")}). Routing to the Captain Assistant.`,
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
        reason: `This requires a compliance interpretation (${matched.join(", ")}). The Noon Assistant reports stored operational inputs; routing to the Compliance Assistant for what the FuelEU/EU ETS picture means.`,
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

    return { handoff: false, target: "none", confidence: 0, reason: "Handled by the Noon Report Assistant." };
  }

  return { detect };
}
