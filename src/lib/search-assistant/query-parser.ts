import type {
  SearchAst,
  SearchEntity,
  SearchFilter,
  SearchSort,
  SearchPagination,
} from "./types";
import {
  SEARCH_DEFAULT_PAGE_SIZE,
  SEARCH_HARD_LIMIT,
  SEARCH_MIN_CONFIDENCE_THRESHOLD,
} from "./types";
import { searchCertificatePhrases } from "@/lib/certificates/handoff";

export interface QueryParser {
  parse(query: string): SearchAst;
  normalizedQuery(query: string): string;
}

interface ParsedIntent {
  readonly entity: SearchEntity | null;
  readonly confidence: number;
}

const ENTITY_KEYWORDS: Record<SearchEntity, ReadonlyArray<string>> = {
  vessels: ["vessel", "vessels", "ships", "fleet"],
  voyages: ["voyage", "voyages", "sailing"],
  ais_positions: ["ais", "position", "positions", "track", "location"],
  fuel_deliveries: ["bdn", "bdns", "fuel delivery", "fuel deliveries", "bunker", "bunkering", "delivery note"],
  documents: ["document", "documents", "file", "files", "upload", "uploads", "pdf"],
  ocr_results: ["ocr", "extraction", "extracted", "ocr result", "ocr confidence"],
  validation_reports: ["validation", "validation report", "validated"],
  review_tasks: ["review", "review task", "pending review", "approval"],
  reports: ["report", "reports", "th etis", "thetis", "mrv report", "ets report", "fueleu report", "annual report"],
  verifier_packages: ["verifier", "verification package", "verification"],
  audit_log: ["audit", "audit event", "audit log", "event log"],
  regulatory: ["regulation", "rule", "directive", "marpol", "annex", "guideline"],
  certificates: [
    "certificate",
    "certificates",
    "certificate record",
    "iapp",
    "iscc",
    "issc",
    "isps",
    "smc",
    "doc",
    "bwm",
    "ballast water",
    "load line",
    "class certificate",
    "tonnage",
    "seemp",
    "iopp",
    ...searchCertificatePhrases(),
  ],
};

const VESSEL_NAMES: ReadonlyArray<string> = [
  "aurelia",
  "atlas",
  "horizon",
  "neptune",
  "odyssey",
];

const IMO_PATTERN = /\b9\d{6}\b/;
const YEAR_PATTERN = /\b(20\d{2})\b/;
const CONFIDENCE_LT_PATTERN = /(?:confidence|ocr)(?:\s*(?:below|under|<|less than|lower than))?\s*(?:below|under|<|less than|lower than)?\s*([01](?:\.\d+)?)/i;

const DOCUMENT_TYPE_KEYWORDS: Record<string, string> = {
  bdn: "BDN",
  "bunker": "BDN",
  thetis: "THETIS",
  fueleu: "FuelEU",
  ets: "EU_ETS",
  mrv: "MRV",
  certificate: "Certificate",
  "monitoring plan": "MonitoringPlan",
  logbook: "Logbook",
  invoice: "Invoice",
};

const STATUS_KEYWORDS: Record<string, string> = {
  pending: "PENDING",
  awaiting: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  reviewed: "REVIEWED",
  "review required": "REVIEW_REQUIRED",
  closed: "CLOSED",
  submitted: "SUBMITTED",
  ready: "READY",
  expiring: "EXPIRING_SOON",
  "expiring soon": "EXPIRING_SOON",
  expired: "EXPIRED",
  missing: "MISSING",
  "pending review": "PENDING_REVIEW",
  invalid: "INVALID",
};

function detectEntity(query: string): ParsedIntent {
  const lower = query.toLowerCase();
  let best: ParsedIntent = { entity: null, confidence: 0 };
  for (const [entity, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    const matches = keywords.filter((kw) => lower.includes(kw)).length;
    if (matches === 0) continue;
    const score = matches / Math.max(keywords.length, 4);
    if (score > best.confidence) {
      best = { entity: entity as SearchEntity, confidence: score };
    }
  }
  return best;
}

function detectVessel(query: string): string | undefined {
  const lower = query.toLowerCase();
  const found = VESSEL_NAMES.find((v) => lower.includes(v));
  return found;
}

function detectDocumentType(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const [kw, type] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) return type;
  }
  return undefined;
}

function detectStatus(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const [kw, status] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(kw)) return status;
  }
  return undefined;
}

function detectConfidence(query: string): { min?: number; max?: number } {
  const lower = query.toLowerCase();
  if (lower.includes("low confidence")) {
    return { max: SEARCH_MIN_CONFIDENCE_THRESHOLD };
  }
  const m = query.match(CONFIDENCE_LT_PATTERN);
  if (m) {
    const value = parseFloat(m[1]!);
    const op = m[0].toLowerCase().includes("below") || m[0].toLowerCase().includes("<") || m[0].toLowerCase().includes("under") || m[0].toLowerCase().includes("less than")
      ? "lt"
      : lower.includes("above") || lower.includes(">") || lower.includes("over") || lower.includes("at least")
        ? "gte"
        : "lt";
    if (op === "lt") return { max: value };
    return { min: value };
  }
  if (lower.includes("confidence")) return { max: SEARCH_MIN_CONFIDENCE_THRESHOLD };
  return {};
}

function detectDates(query: string): { year?: number; dateFrom?: string; dateTo?: string } {
  const lower = query.toLowerCase();
  const now = new Date();
  const yearMatch = query.match(YEAR_PATTERN);
  const year = yearMatch ? parseInt(yearMatch[1]!, 10) : undefined;

  if (lower.includes("last year")) {
    return { year: now.getFullYear() - 1 };
  }
  if (lower.includes("this year")) {
    return { year: now.getFullYear() };
  }

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  for (let i = 0; i < months.length; i++) {
    if (lower.includes(months[i]!)) {
      const month = i + 1;
      const useYear = year ?? now.getFullYear();
      const from = new Date(useYear, month - 1, 1).toISOString().split("T")[0]!;
      const to = new Date(useYear, month, 0).toISOString().split("T")[0]!;
      return { dateFrom: from, dateTo: to, year: useYear };
    }
  }

  if (year) {
    return { year };
  }

  return {};
}

function detectSource(query: string): string | undefined {
  const lower = query.toLowerCase();
  if (lower.includes("email") || lower.includes("uploaded by email") || lower.includes("resend")) return "EMAIL";
  if (lower.includes("manual upload")) return "MANUAL";
  if (lower.includes("api") || lower.includes("marinetraffic")) return "API";
  if (lower.includes("ocr")) return "OCR";
  return undefined;
}

function detectPort(query: string): string | undefined {
  const lower = query.toLowerCase();
  const ports = [
    "rotterdam", "algeciras", "barcelona", "valencia", "hamburg",
    "genoa", "piraeus", "marseille", "singapore", "fujairah",
    "le havre", "cadiz",
  ];
  return ports.find((p) => lower.includes(p));
}

function detectAmbiguity(query: string): ReadonlyArray<string> {
  const issues: string[] = [];
  const lower = query.toLowerCase();
  if (lower.includes("recent") && !/[0-9]{4}/.test(query)) {
    issues.push("time-range");
  }
  return issues;
}

function detectSort(query: string): SearchSort {
  const lower = query.toLowerCase();
  if (lower.includes("oldest")) return { field: "date", direction: "asc" };
  if (lower.includes("newest")) return { field: "date", direction: "desc" };
  if (lower.includes("highest confidence")) return { field: "confidence", direction: "desc" };
  if (lower.includes("lowest confidence")) return { field: "confidence", direction: "asc" };
  return { field: "date", direction: "desc" };
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function createQueryParser(): QueryParser {
  function parse(rawQuery: string): SearchAst {
    const query = normalizeQuery(rawQuery);
    const lower = query.toLowerCase();
    const intent = detectEntity(query);
    const vesselName = detectVessel(query);
    const imoMatch = query.match(IMO_PATTERN);
    const imo = imoMatch ? imoMatch[0] : undefined;
    const dates = detectDates(query);
    const confidence = detectConfidence(query);
    const source = detectSource(query);
    const port = detectPort(query);
    const documentType = detectDocumentType(query);
    const status = detectStatus(query);

    const filters: SearchFilter = {
      entity: intent.entity ?? undefined,
      vesselName,
      imo,
      port,
      year: dates.year,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      confidenceMin: confidence.min,
      confidenceMax: confidence.max,
      source,
      documentType,
      status,
    };

    const ambiguous = [...detectAmbiguity(query)];
    if (!intent.entity) {
      ambiguous.push("entity");
    }
    if (lower.includes("where") || lower.includes("when")) {
      ambiguous.push("time-range");
    }

    return {
      entity: intent.entity,
      filters,
      sort: detectSort(query),
      pagination: { page: 1, pageSize: SEARCH_DEFAULT_PAGE_SIZE },
      ambiguous,
    };
  }

  function normalizedQuery(query: string): string {
    return normalizeQuery(query);
  }

  return { parse, normalizedQuery };
}

export function enforceHardLimits(pagination: SearchPagination): SearchPagination {
  return {
    page: Math.max(1, pagination.page),
    pageSize: Math.min(SEARCH_HARD_LIMIT, Math.max(1, pagination.pageSize)),
  };
}
