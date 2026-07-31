export interface MaintenanceHandoffDecision {
  readonly handoff: boolean;
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface MaintenanceHandoffDetector {
  detect(query: string): MaintenanceHandoffDecision;
}

const CAPTAIN_PATTERNS: ReadonlyArray<string> = [
  "port readiness",
  "ready for the port",
  "am i ready",
  "bdn",
  "port call",
  "next port",
  "bunker",
  "arrival requirements",
  "ingest",
  "iscc certificate for the port",
];

const COMPLIANCE_PATTERNS: ReadonlyArray<string> = [
  "non-compliant",
  "compliance score",
  "compliance balance",
  "penalty",
  "eua obligation",
  "surplus",
  "deficit",
  "ghg intensity",
  "how much co2",
  "compliance status",
  "is this compliant",
  "surrendering",
  "fueleu compliance",
];

const SEARCH_PATTERNS: ReadonlyArray<string> = [
  "find ",
  "search",
  "locate",
  "look up",
  "find me",
  "find certificates",
  "find the survey",
  "where is the certificate",
  "show me the document",
];

export function createMaintenanceHandoffDetector(): MaintenanceHandoffDetector {
  function detect(query: string): MaintenanceHandoffDecision {
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
    if (compliance.length > 0) {
      return {
        handoff: true,
        target: "compliance",
        confidence: Math.min(0.6 + compliance.length * 0.15, 1.0),
        reason: `This requires a compliance interpretation (${compliance.join(", ")}). The Maintenance Assistant only reports deterministic survey/certificate status; routing to the Compliance Assistant.`,
      };
    }

    const search = SEARCH_PATTERNS.filter((p) => lower.includes(p));
    if (search.length > 0) {
      return {
        handoff: true,
        target: "search",
        confidence: Math.min(0.6 + search.length * 0.15, 1.0),
        reason: `This is a retrieval request (${search.join(", ")}). Routing to the Search Assistant to locate documents.`,
      };
    }

    return { handoff: false, target: "none", confidence: 0, reason: "Handled by the Maintenance Assistant." };
  }

  return { detect };
}
