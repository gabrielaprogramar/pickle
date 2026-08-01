/**
 * quality.ts — deterministic OCR quality scoring engine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Turns raw OCR signals (word confidence, page-level defects, extracted fields,
 * expected text sections) into a single quality score plus a per-issue report.
 * The composite score is a weighted sum of page quality, text coverage, field
 * coverage and confidence — all deterministic, no LLM involved.
 *
 * HOW IT FITS
 * The service + ocr-tools.ts (detect_quality), the API layer and the review
 * page all reuse this engine. qualityLevelForScore drives review priority.
 */

import type {
  OcrClassification,
  OcrConfidenceBand,
  OcrDocumentFamily,
  OcrDocumentInput,
  OcrQualityIssue,
  OcrQualityIssueType,
  OcrQualityLevel,
  OcrQualityScore,
} from "./types";

// ── Family field expectations ────────────────────────────────────────────────

interface FamilyFieldExpectation {
  readonly mandatory: ReadonlyArray<string>;
  readonly optional: ReadonlyArray<string>;
}

export const FAMILY_FIELDS: Readonly<Record<OcrDocumentFamily, FamilyFieldExpectation>> = {
  BDN: {
    mandatory: ["supplier", "port", "vessel", "imoNumber", "fuelType", "quantity", "deliveryDate"],
    optional: ["bdnReference", "bdrReference", "sulphurContent", "density", "grade"],
  },
  NOON_REPORT: {
    mandatory: ["vessel", "position", "distance", "speed", "rpm", "consumption"],
    optional: ["draught", "date"],
  },
  LOGBOOK: {
    mandatory: ["vessel", "date", "entry", "position"],
    optional: [],
  },
  MRV: {
    mandatory: ["vessel", "imoNumber", "reportingPeriod", "co2Emissions"],
    optional: ["verifier", "fuelBreakdown"],
  },
  FUEL_EU: {
    mandatory: ["vessel", "imoNumber", "reportingPeriod", "ghgIntensity", "energyUsed", "compliance"],
    optional: ["penalty", "fuelBreakdown", "verifier"],
  },
  EU_ETS: {
    mandatory: ["vessel", "imoNumber", "reportingPeriod", "emissions", "allowances"],
    optional: ["methodology", "verifier", "account"],
  },
  CERTIFICATE: {
    mandatory: ["certificateType", "certificateNumber", "issuer", "issueDate", "validUntil"],
    optional: ["vessel", "imoNumber", "classSociety", "flagState"],
  },
  INVOICE: {
    mandatory: ["invoiceNumber", "supplier", "issueDate", "amount", "currency"],
    optional: ["vat", "dueDate"],
  },
  BUNKER_ANALYSIS: {
    mandatory: ["supplier", "port", "fuelType", "sampleDate", "sulphurContent", "viscosity"],
    optional: ["density", "flashPoint", "certificateNumber", "grade"],
  },
  STATEMENT: {
    mandatory: ["accountHolder", "period", "closingBalance"],
    optional: ["openingBalance", "amount", "date"],
  },
  OTHER: { mandatory: [], optional: [] },
  UNKNOWN: { mandatory: [], optional: [] },
};

/** Alternative keys found in OCR extraction payloads for a canonical field. */
const FIELD_KEY_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  vessel: ["vesselName"],
  quantity: ["quantityTonnes"],
  sulphurContent: ["sulphurContentPct"],
  density: ["densityKgM3"],
  certificateNumber: ["certNumber"],
  port: ["deliveryPort", "delivery_port", "loadPort"],
  supplier: ["bunkerSupplier"],
};

/** Text sections that count as evidence for a field (canonical key → regex). */
const FIELD_TEXT_SIGNALS: Readonly<Record<string, RegExp>> = {
  supplier: /\b(supplier|seller|bunker\s+company|vendor)\b/i,
  port: /\b(port\s+of|delivery\s+port|load\s+port|discharge\s+port)\b/i,
  vessel: /\bvessel(?:\s+name)?\b/i,
  imoNumber: /\bimo\s*(no\.?|number)?\s*[.:]?\s*\d{6,8}\b/i,
  fuelType: /\b(vlsfo|ulsfo|lsfo|hfo|mgo|mdo|lng|lpg|methanol|biofuel|hvo|fame)\b/i,
  quantity: /\b(quantity|metric\s+tonnes|tonnes\s+delivered|tonnes\b.*\bdelivered)\b/i,
  deliveryDate: /\b(delivery\s+date|date\s+of\s+delivery)\b/i,
  bdnReference: /\b(bdn|bunker\s+delivery\s+note)\s*(no\.?|number|#)?\b/i,
  bdrReference: /\b(bdr|bunker\s+delivery\s+receipt)\b/i,
  sulphurContent: /\b(sulphur|sulfur)\b/i,
  density: /\bdensity\b/i,
  grade: /\b(grade|rmg\s?380|rmk\s?380)\b/i,
  position: /\bposition\b/i,
  distance: /\bdistance\b/i,
  speed: /\bspeed\b/i,
  rpm: /\brpm\b|\bengine\s+speed\b/i,
  consumption: /\b(consumption|fuel\s+consumption)\b/i,
  draught: /\b(draught|draft)\b/i,
  date: /\bdate\b/i,
  entry: /\bentry\b/i,
  reportingPeriod: /\b(reporting\s+period|period)\b/i,
  co2Emissions: /\bco2\b|\bemissions\b/i,
  ghgIntensity: /\b(ghg\s?intensity|well-to-wake)\b/i,
  energyUsed: /\benergy\b|\b(mwh|mj)\b/i,
  compliance: /\bcomplian(t|ce)\b/i,
  emissions: /\b(emissions|verified\s+emissions)\b/i,
  allowances: /\ballowances?\b|\beua\b/i,
  methodology: /\bmethodology\b/i,
  verifier: /\bverifier\b/i,
  account: /\b(allowance\s+account|account)\b/i,
  penalty: /\bpenalty\b/i,
  fuelBreakdown: /\b(fuel\s+breakdown|fuel\s+used|fuels\s+used)\b/i,
  certificateType: /\b(iapp|iopp|ioppc|smc|issc|itc|clc|iee|ieep|doc)\b/i,
  certificateNumber: /\b(certificate|cert)\s*(no\.?|number)\b/i,
  issuer: /\b(issuer|issued\s+by|class\s+society|bureau)\b/i,
  issueDate: /\b(issue\s+date|date\s+of\s+issue)\b/i,
  validUntil: /\b(valid\s+until|valid\s+through|expiry|expiration)\b/i,
  classSociety: /\b(class\s+society|dnv|lloyd|bureau\s+veritas|classnk|rina)\b/i,
  flagState: /\bflag\s+state\b|\bflag\b/i,
  invoiceNumber: /\b(invoice\s*no\.?|invoice\s+number)\b/i,
  amount: /\bamount\b/i,
  currency: /\b(usd|eur|gbp|\$|€)\b/i,
  vat: /\bvat\b|\btax\b/i,
  dueDate: /\b(due\s+date|payment\s+terms)\b/i,
  sampleDate: /\b(sample\s+date|date\s+sampled)\b/i,
  viscosity: /\bviscosity\b/i,
  flashPoint: /\bflash\s+point\b/i,
  accountHolder: /\b(account\s+holder|holder|statement)\b/i,
  closingBalance: /\bclosing\s+balance\b/i,
  period: /\bperiod\b/i,
  openingBalance: /\bopening\s+balance\b/i,
};

// ── Confidence distribution ──────────────────────────────────────────────────

export function confidenceBand(confidence: number): OcrConfidenceBand {
  if (confidence >= 0.85) return "HIGH";
  if (confidence >= 0.65) return "MEDIUM";
  if (confidence >= 0.45) return "LOW";
  return "VERY_LOW";
}

export function buildConfidenceDistribution(
  wordConfidence: ReadonlyArray<number>,
): Readonly<Record<OcrConfidenceBand, number>> {
  const dist: Record<OcrConfidenceBand, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 };
  for (const w of wordConfidence) {
    dist[confidenceBand(w)] += 1;
  }
  return dist;
}

/** 0..1 score derived from a word-confidence distribution (weights per band). */
export function confidenceScoreFromDistribution(
  dist: Readonly<Record<OcrConfidenceBand, number>>,
): number {
  const total = dist.HIGH + dist.MEDIUM + dist.LOW + dist.VERY_LOW;
  if (total === 0) return 0;
  return (
    (dist.HIGH * 1.0 + dist.MEDIUM * 0.75 + dist.LOW * 0.4 + dist.VERY_LOW * 0.15) / total
  );
}

// ── Field detection ──────────────────────────────────────────────────────────

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function extractedValue(input: OcrDocumentInput, canonical: string): boolean {
  if (isPresent(input.extractedData[canonical])) return true;
  const aliases = FIELD_KEY_ALIASES[canonical] ?? [];
  return aliases.some((a) => isPresent(input.extractedData[a]));
}

function textEvidence(input: OcrDocumentInput, canonical: string): boolean {
  const re = FIELD_TEXT_SIGNALS[canonical];
  return re ? re.test(input.rawText) : false;
}

export function detectField(input: OcrDocumentInput, canonical: string): boolean {
  return extractedValue(input, canonical) || textEvidence(input, canonical);
}

// ── Quality level ────────────────────────────────────────────────────────────

export function qualityLevelForScore(score: number): OcrQualityLevel {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  if (score >= 0.4) return "LOW";
  return "VERY_LOW";
}

// ── Issue detection ──────────────────────────────────────────────────────────

const GARBLED_TOKEN = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{2,}|#{2,}/;
const NON_LATIN = /[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/;

/** Detect pages that appear to be duplicate scans of the same sheet. */
function detectDuplicatePages(input: OcrDocumentInput): boolean {
  const pages = input.pageSignals ?? [];
  const charCounts = pages.map((p) => p.characterCount).filter((c) => c !== undefined);
  if (charCounts.length >= 2 && new Set(charCounts).size < charCounts.length) return true;

  const lines = (input.rawText ?? "").split(/\n/).map((l) => l.trim()).filter((l) => l.length >= 40);
  const counts = new Map<string, number>();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return [...counts.values()].some((c) => c >= 2);
}

export function detectIssues(
  input: OcrDocumentInput,
  classification: OcrClassification,
  detected: ReadonlyArray<string>,
): ReadonlyArray<OcrQualityIssue> {
  const pages = input.pageSignals ?? [];
  const dist = buildConfidenceDistribution(input.wordConfidence ?? []);
  const total = dist.HIGH + dist.MEDIUM + dist.LOW + dist.VERY_LOW;
  const lowFraction =
    total > 0 ? (dist.LOW + dist.VERY_LOW) / total : 1 - Math.min(input.ocrConfidence, 1);

  const pageRotated = pages.some((p) => p.rotated === true);
  const pageBlurred = pages.some((p) => p.blurred === true);
  const pageCropped = pages.some((p) => p.cropped === true);
  const pageDamaged = pages.some((p) => p.damaged === true);
  const pageDuplicates = detectDuplicatePages(input);

  const tokens = (input.rawText ?? "").split(/\s+/).filter((t) => t.length > 0);
  const garbledFraction =
    tokens.length > 0 ? tokens.filter((t) => GARBLED_TOKEN.test(t)).length / tokens.length : 0;

  const mixedLanguage = NON_LATIN.test(input.rawText ?? "");

  const family = classification.family;
  const expected = FAMILY_FIELDS[family];
  const mandatoryCount = expected.mandatory.length;
  const detectedMandatory = expected.mandatory.filter((f) => detected.includes(f)).length;
  const fieldCoverage = mandatoryCount > 0 ? detectedMandatory / mandatoryCount : 1;

  const expectedFields = [...expected.mandatory, ...expected.optional];
  const textCoverage = expectedFields.length > 0 ? detected.length / expectedFields.length : 1;

  const issues: OcrQualityIssue[] = [
    {
      type: "rotated_page",
      detected: pageRotated,
      evidence: pageRotated ? "Page orientation flag set by the OCR provider." : undefined,
      severity: "error",
    },
    {
      type: "blur",
      detected: pageBlurred || lowFraction > 0.45,
      evidence: pageBlurred
        ? "Blur flag set by the OCR provider."
        : `More than 45% of words are below the confidence threshold (${(lowFraction * 100).toFixed(0)}%).`,
      severity: "error",
    },
    {
      type: "cropped",
      detected: pageCropped,
      evidence: pageCropped ? "Crop flag set by the OCR provider." : undefined,
      severity: "warning",
    },
    {
      type: "damaged_document",
      detected: pageDamaged || garbledFraction > 0.15,
      evidence: pageDamaged
        ? "Damage flag set by the OCR provider."
        : `${(garbledFraction * 100).toFixed(0)}% of tokens are garbled or non-printable.`,
      severity: "blocking",
    },
    {
      type: "duplicate_pages",
      detected: pageDuplicates,
      evidence: pageDuplicates ? "Identical page signatures detected in the scan." : undefined,
      severity: "warning",
    },
    {
      type: "mixed_language",
      detected: mixedLanguage,
      evidence: mixedLanguage ? "Non-Latin script detected in the scan text." : undefined,
      severity: "warning",
    },
    {
      type: "missing_text",
      detected: textCoverage < 0.5,
      evidence:
        textCoverage < 0.5
          ? `${expectedFields.length - detected.length} of ${expectedFields.length} expected sections are absent.`
          : undefined,
      severity: "error",
    },
    {
      type: "partial_extraction",
      detected: mandatoryCount > 0 && fieldCoverage < 0.5,
      evidence: mandatoryCount > 0 ? `${mandatoryCount - detectedMandatory} of ${mandatoryCount} mandatory fields are missing.` : undefined,
      severity: "blocking",
    },
    {
      type: "poor_scan",
      detected: lowFraction > 0.7 || input.ocrConfidence < 0.25,
      evidence: input.ocrConfidence < 0.25
        ? `Overall OCR confidence is ${(input.ocrConfidence * 100).toFixed(0)}%.`
        : undefined,
      severity: "blocking",
    },
  ];

  return issues;
}

// ── Composite score ──────────────────────────────────────────────────────────

const PAGE_ISSUE_PENALTY: Readonly<Record<string, number>> = {
  rotated_page: 0.35,
  blur: 0.25,
  cropped: 0.2,
  duplicate_pages: 0.2,
  damaged_document: 0.6,
};

export function computeQualityScore(
  input: OcrDocumentInput,
  classification: OcrClassification,
): OcrQualityScore {
  const family = classification.family;
  const expected = FAMILY_FIELDS[family];
  const expectedFields = [...expected.mandatory, ...expected.optional];
  const detectedFields = expectedFields.filter((f) => detectField(input, f));
  const missingMandatory = expected.mandatory.filter((f) => !detectedFields.includes(f));

  const dist = buildConfidenceDistribution(input.wordConfidence ?? []);
  const confidenceScore =
    input.wordConfidence && input.wordConfidence.length > 0
      ? confidenceScoreFromDistribution(dist)
      : Math.min(Math.max(input.ocrConfidence, 0), 1);

  const issues = detectIssues(input, classification, detectedFields);

  let pagePenalty = 0;
  for (const issue of issues) {
    if (!issue.detected) continue;
    pagePenalty += PAGE_ISSUE_PENALTY[issue.type] ?? 0;
  }
  const pageQuality = Math.min(Math.max(1 - pagePenalty, 0), 1);

  let textCoverage = expectedFields.length > 0 ? detectedFields.length / expectedFields.length : 1;
  const mixed = issues.find((i) => i.type === "mixed_language")?.detected ?? false;
  const damaged = issues.find((i) => i.type === "damaged_document")?.detected ?? false;
  if (mixed) textCoverage = Math.max(textCoverage - 0.3, 0);
  if (damaged) textCoverage = Math.max(textCoverage - 0.1, 0);

  const mandatoryCount = expected.mandatory.length;
  const fieldCoverage =
    mandatoryCount > 0 ? detectedFields.filter((f) => expected.mandatory.includes(f)).length / mandatoryCount : 1;

  let confidence = confidenceScore;
  if (damaged) confidence = Math.max(confidence - 0.1, 0);

  const overallQualityScore = Number(
    (0.25 * pageQuality + 0.35 * textCoverage + 0.25 * fieldCoverage + 0.15 * confidence).toFixed(3),
  );

  return {
    overallQualityScore,
    pageQuality: Number(pageQuality.toFixed(3)),
    textCoverage: Number(textCoverage.toFixed(3)),
    fieldCoverage: Number(fieldCoverage.toFixed(3)),
    confidenceScore: Number(confidence.toFixed(3)),
    level: qualityLevelForScore(overallQualityScore),
    issues,
    confidenceDistribution: dist,
    expectedFields,
    detectedFields,
    missingMandatoryFields: missingMandatory,
  };
}

export type { OcrQualityIssueType };
