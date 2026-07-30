/**
 * Simplified EU port classifier for voyage coverage determination.
 *
 * Uses an explicit list of known EU ports and EU member states.
 * Ports not in the registry are classified as non-EU by default.
 * This is a deterministic, heuristic classifier — not a legal determination.
 */

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
  // UK (post-Brexit: non-EU)
  "southampton": "united kingdom", "felixstowe": "united kingdom",
  "london": "united kingdom", "liverpool": "united kingdom",
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

/**
 * Classify a voyage pair into EU ETS coverage type.
 */
export function classifyVoyageCoverage(
  departurePort: string,
  arrivalPort: string,
): "INTRA_EU" | "EU_TO_THIRD" | "THIRD_TO_EU" | "NON_EU" {
  const dep = isEuPort(departurePort);
  const arr = isEuPort(arrivalPort);

  if (dep === "eu" && arr === "eu") return "INTRA_EU";
  if (dep === "eu" && arr !== "eu") return "EU_TO_THIRD";
  if (dep !== "eu" && arr === "eu") return "THIRD_TO_EU";
  return "NON_EU";
}
