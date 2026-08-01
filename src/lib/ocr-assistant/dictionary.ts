/**
 * dictionary.ts — OCR knowledge base and fuel synonym dictionary
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * OCR repairs and lookups need a deterministic vocabulary: fuel names (with
 * common OCR typos), ports, certificate types, class societies, vessel
 * terminology and regulatory abbreviations. This is a curated dictionary, not
 * a RAG index — every lookup is exact and testable.
 *
 * HOW IT FITS
 * suggestions.ts (fuel/port/cert spelling repairs) and ocr-tools.ts
 * (lookup_dictionary tool) both consume this file.
 */

export type DictionaryDomain =
  | "fuel"
  | "port"
  | "certificate"
  | "class_society"
  | "terminology"
  | "regulation";

export interface DictionaryEntry {
  readonly canonical: string;
  readonly aliases: ReadonlyArray<string>;
  readonly kind: DictionaryDomain;
  readonly description?: string;
}

// ── Fuel synonyms (canonical + OCR-typo aliases) ─────────────────────────────

const FUEL_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  {
    canonical: "VLSFO",
    aliases: [
      "vlsfo",
      "vlspo",
      "vlsf0",
      "vl5fo",
      "vlsfo 380",
      "very low sulphur fuel oil",
      "very low sulfur fuel oil",
    ],
    kind: "fuel",
    description: "Very Low Sulphur Fuel Oil (≤0.50% S)",
  },
  {
    canonical: "ULSFO",
    aliases: [
      "ulsfo",
      "ulsf0",
      "ul5fo",
      "ultra low sulphur fuel oil",
      "ultra low sulfur fuel oil",
    ],
    kind: "fuel",
    description: "Ultra Low Sulphur Fuel Oil",
  },
  {
    canonical: "LSFO",
    aliases: ["lsfo", "lsf0", "l5fo", "low sulphur fuel oil", "low sulfur fuel oil"],
    kind: "fuel",
    description: "Low Sulphur Fuel Oil",
  },
  {
    canonical: "HSFO",
    aliases: ["hsfo", "hsf0", "high sulphur fuel oil", "high sulfur fuel oil"],
    kind: "fuel",
    description: "High Sulphur Fuel Oil",
  },
  {
    canonical: "HFO",
    aliases: ["hfo", "hf0", "heavy fuel oil"],
    kind: "fuel",
    description: "Heavy Fuel Oil",
  },
  {
    canonical: "IFO380",
    aliases: ["ifo380", "ifo 380", "if0380", "ifo-380"],
    kind: "fuel",
    description: "Intermediate Fuel Oil 380 cSt",
  },
  {
    canonical: "IFO180",
    aliases: ["ifo180", "ifo 180", "if0180", "ifo-180"],
    kind: "fuel",
    description: "Intermediate Fuel Oil 180 cSt",
  },
  {
    canonical: "MGO",
    aliases: ["mgo", "mgoo", "mg0", "marine gas oil"],
    kind: "fuel",
    description: "Marine Gas Oil",
  },
  {
    canonical: "MDO",
    aliases: ["mdo", "md0", "marine diesel oil"],
    kind: "fuel",
    description: "Marine Diesel Oil",
  },
  {
    canonical: "LNG",
    aliases: ["lng", "l1ng", "liquefied natural gas"],
    kind: "fuel",
    description: "Liquefied Natural Gas",
  },
  {
    canonical: "LPG",
    aliases: ["lpg", "l1pg", "liquefied petroleum gas"],
    kind: "fuel",
    description: "Liquefied Petroleum Gas",
  },
  {
    canonical: "METHANOL",
    aliases: ["methanol", "methano1", "methan0l", "meoh"],
    kind: "fuel",
    description: "Methanol fuel",
  },
  {
    canonical: "ETHANOL",
    aliases: ["ethanol", "ethano1"],
    kind: "fuel",
    description: "Ethanol fuel",
  },
  {
    canonical: "BIOFUEL",
    aliases: ["biofuel", "bio-fuel", "bio fue1"],
    kind: "fuel",
    description: "Biofuel blend",
  },
  {
    canonical: "FAME",
    aliases: ["fame", "faмe", "fatty acid methyl ester"],
    kind: "fuel",
    description: "Fatty Acid Methyl Ester",
  },
  {
    canonical: "HVO",
    aliases: ["hvo", "hv0", "hydrotreated vegetable oil"],
    kind: "fuel",
    description: "Hydrotreated Vegetable Oil",
  },
  {
    canonical: "HYDROGEN",
    aliases: ["hydrogen", "hydrogend", "h2", "h2 fuel"],
    kind: "fuel",
    description: "Hydrogen fuel",
  },
  {
    canonical: "AMMONIA",
    aliases: ["ammonia", "ammon1a", "nh3", "nh3 fuel"],
    kind: "fuel",
    description: "Ammonia fuel",
  },
];

// ── Ports ────────────────────────────────────────────────────────────────────

const PORT_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  { canonical: "Singapore", aliases: ["singapore", "singapor", "singap0re"], kind: "port" },
  { canonical: "Rotterdam", aliases: ["rotterdam", "rotterdan", "rotterdarn"], kind: "port" },
  { canonical: "Antwerp", aliases: ["antwerp", "antverp", "antwerpen"], kind: "port" },
  { canonical: "Hamburg", aliases: ["hamburg", "harnburg"], kind: "port" },
  { canonical: "Algeciras", aliases: ["algeciras", "algec1ras"], kind: "port" },
  { canonical: "Gibraltar", aliases: ["gibraltar", "g1braltar"], kind: "port" },
  { canonical: "Fujairah", aliases: ["fujairah", "fuja1rah", "fujaira"], kind: "port" },
  { canonical: "Houston", aliases: ["houston", "hou5ton"], kind: "port" },
  { canonical: "Los Angeles", aliases: ["los angeles", "los ange1es"], kind: "port" },
  { canonical: "Shanghai", aliases: ["shanghai", "shangha1"], kind: "port" },
  { canonical: "Hong Kong", aliases: ["hong kong", "hongkong", "hon9 kong"], kind: "port" },
  { canonical: "Busan", aliases: ["busan", "bu5an", "pusan"], kind: "port" },
  { canonical: "Santos", aliases: ["santos", "san5os"], kind: "port" },
  { canonical: "Cape Town", aliases: ["cape town", "cape 5own"], kind: "port" },
  { canonical: "Suez", aliases: ["suez", "5uez"], kind: "port" },
  { canonical: "Colombo", aliases: ["colombo", "co1ombo"], kind: "port" },
  { canonical: "Las Palmas", aliases: ["las palmas", "las pa1mas"], kind: "port" },
  { canonical: "Marseille", aliases: ["marseille", "mar5eille"], kind: "port" },
  { canonical: "Barcelona", aliases: ["barcelona", "barce1ona"], kind: "port" },
  { canonical: "Genoa", aliases: ["genoa", "gen0a"], kind: "port" },
  { canonical: "Lisbon", aliases: ["lisbon", "li5bon"], kind: "port" },
  { canonical: "Le Havre", aliases: ["le havre", "le hav5e"], kind: "port" },
  { canonical: "Felixstowe", aliases: ["felixstowe", "fe1ixstowe"], kind: "port" },
  { canonical: "Dubai", aliases: ["dubai", "duba1", "dubay"], kind: "port" },
  { canonical: "Jebel Ali", aliases: ["jebel ali", "jebel a1i"], kind: "port" },
  { canonical: "Mumbai", aliases: ["mumbai", "mumba1"], kind: "port" },
  { canonical: "Durban", aliases: ["durban", "dur5an"], kind: "port" },
];

// ── Certificates ─────────────────────────────────────────────────────────────

const CERTIFICATE_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  {
    canonical: "IAPP",
    aliases: ["iapp", "iappc", "international air pollution prevention certificate"],
    kind: "certificate",
    description: "International Air Pollution Prevention Certificate",
  },
  {
    canonical: "IOPP",
    aliases: ["iopp", "ioppc", "international oil pollution prevention certificate"],
    kind: "certificate",
    description: "International Oil Pollution Prevention Certificate",
  },
  {
    canonical: "IEE",
    aliases: ["iee", "ieep", "international energy efficiency certificate"],
    kind: "certificate",
    description: "International Energy Efficiency Certificate",
  },
  {
    canonical: "SMC",
    aliases: ["smc", "safety management certificate"],
    kind: "certificate",
    description: "Safety Management Certificate",
  },
  {
    canonical: "ISSC",
    aliases: ["issc", "international ship security certificate"],
    kind: "certificate",
    description: "International Ship Security Certificate",
  },
  {
    canonical: "ITC",
    aliases: ["itc", "international tonnage certificate"],
    kind: "certificate",
    description: "International Tonnage Certificate",
  },
  {
    canonical: "CLC",
    aliases: ["clc", "certificate of financial responsibility", "civil liability certificate"],
    kind: "certificate",
    description: "Certificate of Insurance or Financial Security (CLC)",
  },
  {
    canonical: "DOC",
    aliases: ["doc", "document of compliance"],
    kind: "certificate",
    description: "Document of Compliance",
  },
];

// ── Class societies ──────────────────────────────────────────────────────────

const CLASS_SOCIETY_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  { canonical: "DNV", aliases: ["dnv", "det norske veritas", "dnv gl"], kind: "class_society", description: "Det Norske Veritas" },
  { canonical: "Lloyd's Register", aliases: ["lloyd's register", "lloyds register", "lr", "lloyds"], kind: "class_society" },
  { canonical: "ABS", aliases: ["abs", "american bureau of shipping"], kind: "class_society" },
  { canonical: "Bureau Veritas", aliases: ["bureau veritas", "bv"], kind: "class_society" },
  { canonical: "ClassNK", aliases: ["classnk", "nippon kaiji kyokai", "nk"], kind: "class_society" },
  { canonical: "RINA", aliases: ["rina", "registro italiano navale"], kind: "class_society" },
  { canonical: "KR", aliases: ["kr", "korean register"], kind: "class_society" },
  { canonical: "CCS", aliases: ["ccs", "china classification society"], kind: "class_society" },
];

// ── Vessel terminology ───────────────────────────────────────────────────────

const TERMINOLOGY_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  { canonical: "BDN", aliases: ["bdn", "bunker delivery note"], kind: "terminology", description: "Bunker Delivery Note — proof of fuel delivery for compliance records" },
  { canonical: "BDR", aliases: ["bdr", "bunker delivery receipt"], kind: "terminology", description: "Bunker Delivery Receipt" },
  { canonical: "ROB", aliases: ["rob", "remaining on board"], kind: "terminology", description: "Remaining On Board — fuel quantity still in tanks" },
  { canonical: "SFOC", aliases: ["sfoc", "specific fuel oil consumption"], kind: "terminology", description: "Specific Fuel Oil Consumption" },
  { canonical: "COW", aliases: ["cow", "crude oil washing"], kind: "terminology", description: "Crude Oil Washing" },
  { canonical: "VDR", aliases: ["vdr", "voyage data recorder"], kind: "terminology", description: "Voyage Data Recorder" },
  { canonical: "AIS", aliases: ["ais", "automatic identification system"], kind: "terminology", description: "Automatic Identification System" },
  { canonical: "DWT", aliases: ["dwt", "deadweight"], kind: "terminology", description: "Deadweight Tonnage" },
  { canonical: "GT", aliases: ["gt", "gross tonnage"], kind: "terminology", description: "Gross Tonnage" },
  { canonical: "LOA", aliases: ["loa", "length overall"], kind: "terminology", description: "Length Overall" },
  { canonical: "ETA", aliases: ["eta", "estimated time of arrival"], kind: "terminology", description: "Estimated Time of Arrival" },
  { canonical: "ETS", aliases: ["ets", "emissions trading system"], kind: "terminology", description: "Emissions Trading System" },
  { canonical: "CII", aliases: ["cii", "carbon intensity indicator"], kind: "terminology", description: "Carbon Intensity Indicator" },
  { canonical: "EEDI", aliases: ["eedi", "energy efficiency design index"], kind: "terminology", description: "Energy Efficiency Design Index" },
  { canonical: "EEXI", aliases: ["eexi", "energy efficiency existing ship index"], kind: "terminology", description: "Energy Efficiency Existing Ship Index" },
  { canonical: "DCS", aliases: ["dcs", "data collection system"], kind: "terminology", description: "IMO Data Collection System" },
  { canonical: "EUA", aliases: ["eua", "eu allowance"], kind: "terminology", description: "EU Allowance unit" },
];

// ── Regulations ──────────────────────────────────────────────────────────────

const REGULATION_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  { canonical: "MARPOL", aliases: ["marpol"], kind: "regulation", description: "International Convention for the Prevention of Pollution from Ships" },
  { canonical: "MARPOL Annex VI", aliases: ["marpol annex vi", "annex vi"], kind: "regulation", description: "MARPOL Annex VI — Prevention of Air Pollution from Ships" },
  { canonical: "EU MRV", aliases: ["eu mrv", "mrv", "regulation (eu) 2015/757"], kind: "regulation", description: "Regulation (EU) 2015/757 — Monitoring, Reporting and Verification of CO2 emissions" },
  { canonical: "FuelEU Maritime", aliases: ["fueleu", "fuel eu maritime", "regulation (eu) 2023/1805", "fueleu maritime"], kind: "regulation", description: "Regulation (EU) 2023/1805 — FuelEU Maritime GHG intensity limits" },
  { canonical: "EU ETS Directive", aliases: ["eu ets directive", "directive 2003/87/ec"], kind: "regulation", description: "Directive 2003/87/EC — EU Emissions Trading System for maritime transport" },
  { canonical: "IMO DCS", aliases: ["imo dcs", "dcs"], kind: "regulation", description: "IMO Data Collection System — Resolution MEPC.278(70)" },
  { canonical: "SOLAS", aliases: ["solas"], kind: "regulation", description: "International Convention for the Safety of Life at Sea" },
  { canonical: "STCW", aliases: ["stcw"], kind: "regulation", description: "Standards of Training, Certification and Watchkeeping" },
];

const ALL_ENTRIES: ReadonlyArray<DictionaryEntry> = [
  ...FUEL_ENTRIES,
  ...PORT_ENTRIES,
  ...CERTIFICATE_ENTRIES,
  ...CLASS_SOCIETY_ENTRIES,
  ...TERMINOLOGY_ENTRIES,
  ...REGULATION_ENTRIES,
];

// ── Normalization ────────────────────────────────────────────────────────────

/** Lowercase, keep letters+digits, strip punctuation/spaces. Digits are kept. */
export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Levenshtein edit distance — used only as a bounded fuzzy fallback. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = new Array(n + 1);
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? Number.MAX_SAFE_INTEGER) + 1,
        (curr[j - 1] ?? Number.MAX_SAFE_INTEGER) + 1,
        (prev[j - 1] ?? Number.MAX_SAFE_INTEGER) + cost,
      );
    }
    prev = curr;
  }
  return prev[n] ?? m + n;
}

// ── Lookup ───────────────────────────────────────────────────────────────────

/** Exact alias / canonical lookup for a single normalized token. */
export function lookupFuel(normalized: string): DictionaryEntry | null {
  return FUEL_ENTRIES.find(
    (e) => normalizeToken(e.canonical) === normalized || e.aliases.some((a) => normalizeToken(a) === normalized),
  ) ?? null;
}

/**
 * Fuzzy fuel lookup: exact alias match first, then a bounded (≤1) edit-distance
 * match against canonical names, only when the candidate is unambiguous.
 */
export function lookupFuelFuzzy(raw: string): DictionaryEntry | null {
  const normalized = normalizeToken(raw);
  if (normalized.length < 3) return null;
  const exact = lookupFuel(normalized);
  if (exact) return exact;

  const candidates = FUEL_ENTRIES.filter((e) => {
    const canon = normalizeToken(e.canonical);
    if (Math.abs(canon.length - normalized.length) > 1) return false;
    return levenshteinDistance(canon, normalized) <= 1;
  });
  if (candidates.length !== 1) return null;
  return candidates[0] ?? null;
}

/** Exact alias / canonical lookup for a single normalized port token. */
export function lookupPort(normalized: string): DictionaryEntry | null {
  return (
    PORT_ENTRIES.find(
      (e) => normalizeToken(e.canonical) === normalized || e.aliases.some((a) => normalizeToken(a) === normalized),
    ) ?? null
  );
}

export function lookupPortFuzzy(raw: string): DictionaryEntry | null {
  const normalized = normalizeToken(raw);
  if (normalized.length < 4) return null;
  const exact = lookupPort(normalized);
  if (exact) return exact;
  const candidates = PORT_ENTRIES.filter((e) => {
    const canon = normalizeToken(e.canonical);
    if (Math.abs(canon.length - normalized.length) > 1) return false;
    return levenshteinDistance(canon, normalized) <= 1;
  });
  if (candidates.length !== 1) return null;
  return candidates[0] ?? null;
}

/** Free-text knowledge base lookup across all domains. */
export function lookupDictionary(query: string, domain?: DictionaryDomain): ReadonlyArray<DictionaryEntry> {
  const normalized = normalizeToken(query);
  if (normalized.length === 0) return [];
  const haystack = domain ? ALL_ENTRIES.filter((e) => e.kind === domain) : ALL_ENTRIES;
  return haystack.filter((e) => {
    if (normalizeToken(e.canonical) === normalized) return true;
    if (e.aliases.some((a) => normalizeToken(a) === normalized)) return true;
    return false;
  });
}

export function getDictionaryEntries(domain?: DictionaryDomain): ReadonlyArray<DictionaryEntry> {
  return domain ? ALL_ENTRIES.filter((e) => e.kind === domain) : ALL_ENTRIES;
}
