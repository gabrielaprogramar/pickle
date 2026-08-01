/**
 * types.ts — OCR Intelligence Assistant core types
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Defines the OCR assistant domain model: document classification, scan
 * quality scoring, OCR repair suggestions, review priority and the handoff
 * surface. Everything is deterministic — no LLM computes quality, priority or
 * corrections.
 *
 * HOW IT FITS
 * Pure domain engines (classification.ts, quality.ts, suggestions.ts,
 * priority.ts, dictionary.ts) consume these types. The service + tools layer
 * composes deterministic answers. The API layer reuses the same engines over
 * real ocr_results rows.
 */

// ── Versions ─────────────────────────────────────────────────────────────────

export const OCR_ASSISTANT_VERSION = "4.3.0";
export const OCR_SYSTEM_PROMPT_VERSION = "4.3.0";

/** Reason code recorded when low OCR quality routes a document to human review. */
export const OCR_REVIEW_REQUIRED = "OCR_REVIEW_REQUIRED";

// ── Document families ────────────────────────────────────────────────────────

export type OcrDocumentFamily =
  | "BDN"
  | "NOON_REPORT"
  | "LOGBOOK"
  | "MRV"
  | "FUEL_EU"
  | "EU_ETS"
  | "CERTIFICATE"
  | "INVOICE"
  | "BUNKER_ANALYSIS"
  | "STATEMENT"
  | "OTHER"
  | "UNKNOWN";

export const OCR_DOCUMENT_FAMILIES: ReadonlyArray<OcrDocumentFamily> = [
  "BDN",
  "NOON_REPORT",
  "LOGBOOK",
  "MRV",
  "FUEL_EU",
  "EU_ETS",
  "CERTIFICATE",
  "INVOICE",
  "BUNKER_ANALYSIS",
  "STATEMENT",
  "OTHER",
  "UNKNOWN",
];

// ── Quality ──────────────────────────────────────────────────────────────────

export type OcrQualityLevel = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export type OcrConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export type OcrQualityIssueType =
  | "poor_scan"
  | "rotated_page"
  | "blur"
  | "cropped"
  | "duplicate_pages"
  | "missing_text"
  | "mixed_language"
  | "damaged_document"
  | "partial_extraction";

export interface OcrQualityIssue {
  readonly type: OcrQualityIssueType;
  readonly detected: boolean;
  readonly evidence?: string;
  readonly severity: "blocking" | "error" | "warning" | "info";
}

/** Per-page optical signals surfaced by the OCR provider (when available). */
export interface OcrPageSignal {
  readonly page: number;
  readonly rotated?: boolean;
  readonly blurred?: boolean;
  readonly cropped?: boolean;
  readonly damaged?: boolean;
  readonly characterCount?: number;
  readonly wordConfidence?: ReadonlyArray<number>;
}

// ── Classification ───────────────────────────────────────────────────────────

export interface OcrClassification {
  readonly family: OcrDocumentFamily;
  /** 0..1 confidence that content belongs to this family. */
  readonly confidence: number;
  readonly matchedSignals: ReadonlyArray<string>;
  readonly reason: string;
}

// ── Quality score ────────────────────────────────────────────────────────────

export interface OcrQualityScore {
  /** 0..1 composite quality score. */
  readonly overallQualityScore: number;
  /** 0..1 page-level quality (rotation / blur / crop / damage). */
  readonly pageQuality: number;
  /** 0..1 fraction of expected text sections detected. */
  readonly textCoverage: number;
  /** 0..1 fraction of mandatory fields detected. */
  readonly fieldCoverage: number;
  /** 0..1 derived from the word-confidence distribution. */
  readonly confidenceScore: number;
  readonly level: OcrQualityLevel;
  readonly issues: ReadonlyArray<OcrQualityIssue>;
  /** Word-count per confidence band (0 when no word-level data). */
  readonly confidenceDistribution: Readonly<Record<OcrConfidenceBand, number>>;
  readonly expectedFields: ReadonlyArray<string>;
  readonly detectedFields: ReadonlyArray<string>;
  readonly missingMandatoryFields: ReadonlyArray<string>;
}

// ── Repair suggestions ───────────────────────────────────────────────────────

export type OcrRepairKind =
  | "IMO_CHECKSUM"
  | "DATE_FORMAT"
  | "FUEL_SPELLING"
  | "PORT_SPELLING"
  | "CERTIFICATE_NUMBER_SPACING"
  | "MERGED_CHARACTERS";

export interface OcrRepairSuggestion {
  readonly id: string;
  readonly kind: OcrRepairKind;
  readonly fieldKey: string;
  readonly original: string;
  readonly suggested: string;
  /** 0..1 how confident the correction is. */
  readonly confidence: number;
  readonly reason: string;
  readonly severity: "error" | "warning" | "info";
}

// ── Review priority ──────────────────────────────────────────────────────────

export type ReviewPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ReviewPriorityDecision {
  readonly priority: ReviewPriority;
  readonly reasons: ReadonlyArray<string>;
}

// ── Similar documents ────────────────────────────────────────────────────────

export interface SimilarDocumentMatch {
  readonly documentId: string;
  readonly title: string;
  readonly family: OcrDocumentFamily;
  /** 0..1 similarity derived from shared classification signals. */
  readonly similarity: number;
  readonly sharedSignals: ReadonlyArray<string>;
  readonly reason: string;
}

// ── Document input to the domain engines ─────────────────────────────────────

export interface OcrDocumentInput {
  readonly documentId: string;
  readonly title?: string;
  /** The type declared at upload (used to detect mismatched documents). */
  readonly documentType: string;
  readonly rawText: string;
  readonly extractedData: Readonly<Record<string, unknown>>;
  /** Scalar OCR confidence 0..1. */
  readonly ocrConfidence: number;
  /** Optional per-word confidences for a precise distribution. */
  readonly wordConfidence?: ReadonlyArray<number>;
  readonly pageSignals?: ReadonlyArray<OcrPageSignal>;
}

// ── Persistence records (migration 0015) ─────────────────────────────────────

export interface OcrMemoryEntry {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export type OcrReviewSuggestionStatus = "open" | "accepted" | "rejected" | "resolved";

export interface OcrReviewSuggestionRecord {
  readonly id: string;
  readonly ocrResultId: string;
  readonly documentId: string;
  readonly fieldKey: string;
  readonly kind: OcrRepairKind;
  readonly originalValue: string;
  readonly suggestedValue: string;
  readonly confidence: number;
  readonly reason: string;
  readonly priority: ReviewPriority;
  readonly status: OcrReviewSuggestionStatus;
  readonly createdAt: string;
}

export interface OcrQualityRecord {
  readonly id: string;
  readonly ocrResultId: string;
  readonly documentId: string;
  readonly detectedFamily: OcrDocumentFamily;
  readonly overallQualityScore: number;
  readonly level: OcrQualityLevel;
  readonly pageQuality: number;
  readonly textCoverage: number;
  readonly fieldCoverage: number;
  readonly confidenceScore: number;
  readonly confidenceDistribution: Readonly<Record<OcrConfidenceBand, number>>;
  readonly issues: ReadonlyArray<OcrQualityIssue>;
  readonly missingMandatoryFields: ReadonlyArray<string>;
  readonly createdAt: string;
}

// ── Mock state ───────────────────────────────────────────────────────────────

export interface OcrMockDocument {
  readonly id: string;
  readonly title: string;
  readonly declaredType: string;
  readonly family: OcrDocumentFamily;
  readonly rawText: string;
  readonly extractedData: Readonly<Record<string, unknown>>;
  readonly ocrConfidence: number;
  readonly wordConfidence: ReadonlyArray<number>;
  readonly pageSignals: ReadonlyArray<OcrPageSignal>;
  /** Human-readable description of the injected scan defect. */
  readonly injectedIssue: string;
  /** Deterministic expected quality level used by tests. */
  readonly expectedLevel: OcrQualityLevel;
}

// ── Request / answer ─────────────────────────────────────────────────────────

export interface OcrContext {
  readonly documentId?: string;
  readonly vesselImo?: string;
  readonly now?: string;
}

export interface OcrRequest {
  readonly query: string;
  readonly context?: OcrContext;
  readonly user?: string;
}

export interface OcrHandoff {
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface OcrAnswer {
  readonly text: string;
  readonly classification?: OcrClassification;
  readonly quality?: OcrQualityScore;
  readonly suggestions?: ReadonlyArray<OcrRepairSuggestion>;
  readonly priority?: ReviewPriorityDecision;
  readonly similar?: ReadonlyArray<SimilarDocumentMatch>;
  readonly records?: ReadonlyArray<
    | OcrQualityRecord
    | OcrReviewSuggestionRecord
  >;
  readonly handoff?: OcrHandoff;
}
