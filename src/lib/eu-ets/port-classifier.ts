/**
 * Simplified EU port classifier for voyage coverage determination.
 *
 * Uses an explicit list of known EU ports and EU member states.
 * Ports not in the registry are classified as unknown (never silently coerced
 * to EU or non-EU by `classifyVoyagePortStatus` — unknown is surfaced so the
 * caller can warn).
 * This is a deterministic, heuristic classifier — not a legal determination.
 *
 * VERSION
 * Bumped whenever the classifier's behavior changes so downstream records can
 * distinguish reclassifications over time. The version string is exported here
 * and threaded into the ETS parameter_version (see eu-ets/parameters.ts).
 */

export const PORT_CLASSIFIER_VERSION = "2026.1";

export type RegionResult = "eu" | "non_eu" | "unknown";

const EU_MEMBER_COUNTRIES: ReadonlySet<string> = new Set([
  "austria", "belgium", "bulgaria", "croatia", "cyprus",
  "czech republic", "czechia", "denmark", "estonia", "finland",
  "france", "germany", "greece", "hungary", "ireland",
  "italy", "latvia", "lithuania", "luxembourg", "malta",
  "netherlands", "poland", "portugal", "romania", "slovakia",
  "slovenia", "spain", "sweden",
  // EEA (included for MRV scope)
  "iceland", "norway", "liechtenstein",
]);

/** Known EU port names (lowercase). Key = port name, value = country hint. */
const EU_PORTS: Record<string, string> = {
  // Netherlands
  rotterdam: "netherlands", amsterdam: "netherlands",
  // Belgium
  antwerp: "belgium", zeebrugge: "belgium", ghent: "belgium",
  // Germany
  hamburg: "germany", bremerhaven: "germany", wilhelmshaven: "germany",
  // France
  le_havre: "france", marseille: "france", dunkirk: "france",
  // Spain
  algeciras: "spain", barcelona: "spain", valencia: "spain",
  // Italy
  genoa: "italy", naples: "italy", "la spezia": "italy",
  // Greece
  piraeus: "greece", thessaloniki: "greece",
  // Sweden
  gothenburg: "sweden",
  // Denmark
  copenhagen: "denmark", aarhus: "denmark",
  // Poland
  gdansk: "poland", gdynia: "poland", szczecin: "poland",
  // Finland
  helsinki: "finland",
  // Norway (EEA)
  oslo: "norway", bergen: "norway",
  // Ireland
  dublin: "ireland", cork: "ireland",
  // Portugal
  lisbon: "portugal", sines: "portugal",
  // Malta
  "valletta": "malta",
  // Cyprus
  limassol: "cyprus",
};

/** Known non-EU ports (to avoid false EU classification). */
const NON_EU_PORTS: ReadonlySet<string> = new Set([
  "singapore", "shanghai", "ningbo", "shenzhen", "hong kong",
  "busan", "ulsan", "tokyo", "yokohama", "nagoya",
  "jebel ali", "dubai", "abu dhabi", "dammam",
  "hambantota", "colombo", "mundra", "nhava sheva",
  "port klang", "tanjung pelepas", "jakarta", "surabaya",
  "ho chi minh", "haiphong", "manila",
  "louis", "new orleans", "houston", "long beach",
  "los angeles", "oakland", "seattle", "vancouver",
  "panama", "colón", "cartagena", "santos",
  "cape town", "durban", "lagos", "mombasa",
  "melbourne", "sydney", "auckland",
  // UK — non-EU since 1 Jan 2021 (left EU ETS in 2023)
  "southampton", "felixstowe", "london", "liverpool",
]);

/**
 * Determine whether a port is in the EU/EEA.
 */
export function isEuPort(portName: string): RegionResult {
  const key = portName.toLowerCase().trim();
  if (EU_PORTS[key]) return "eu";
  if (NON_EU_PORTS.has(key)) return "non_eu";

  // Check if port name contains a country name
  for (const country of EU_MEMBER_COUNTRIES) {
    if (key.includes(country)) return "eu";
  }

  return "unknown";
}

/** A voyage coverage classification plus any ports that could not be resolved. */
export interface VoyagePortStatus {
  readonly type: "INTRA_EU" | "EU_TO_THIRD" | "THIRD_TO_EU" | "NON_EU" | "UNKNOWN";
  /** Port names (as provided) that could not be classified. Empty when confident. */
  readonly unknownPorts: readonly string[];
}

/**
 * Classify a voyage pair into EU ETS coverage type, surfacing truly unknown
 * ports rather than silently collapsing them to NON_EU.
 *
 * Unknown ports are reported in `unknownPorts` and reflected as an `"UNKNOWN"`
 * type so callers can warn/flag for manual resolution.
 */
export function classifyVoyagePortStatus(
  departurePort: string,
  arrivalPort: string,
): VoyagePortStatus {
  const dep = isEuPort(departurePort);
  const arr = isEuPort(arrivalPort);
  const unknownPorts: string[] = [];
  if (dep === "unknown") unknownPorts.push(departurePort);
  if (arr === "unknown") unknownPorts.push(arrivalPort);

  // Both ports confidently EU → intra-EU.
  if (dep === "eu" && arr === "eu") return { type: "INTRA_EU", unknownPorts };

  // If ANY port is unresolved we cannot confidently assign EU/third status —
  // it could be EU or non-EU. Surface it as UNKNOWN rather than silently
  // coercing it, so it is not under-reported.
  if (unknownPorts.length > 0) return { type: "UNKNOWN", unknownPorts };

  if (dep === "eu" && arr === "non_eu") return { type: "EU_TO_THIRD", unknownPorts };
  if (dep === "non_eu" && arr === "eu") return { type: "THIRD_TO_EU", unknownPorts };
  return { type: "NON_EU", unknownPorts };
}

/**
 * Classify a voyage pair into EU ETS coverage type (legacy projection).
 *
 * Kept for callers that only need the coverage factor. When either port is
 * unresolved this collapses to NON_EU — prefer `classifyVoyagePortStatus` in
 * new code so unknown ports are surfaced instead of silently coerced.
 */
export function classifyVoyageCoverage(
  departurePort: string,
  arrivalPort: string,
): "INTRA_EU" | "EU_TO_THIRD" | "THIRD_TO_EU" | "NON_EU" {
  const status = classifyVoyagePortStatus(departurePort, arrivalPort);
  switch (status.type) {
    case "INTRA_EU":   return "INTRA_EU";
    case "EU_TO_THIRD": return "EU_TO_THIRD";
    case "THIRD_TO_EU": return "THIRD_TO_EU";
    case "UNKNOWN":
    case "NON_EU":     return "NON_EU";
  }
}
