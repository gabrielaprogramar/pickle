/**
 * handoff.ts — OCR assistant handoff detection + cross-assistant surface
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Two responsibilities. (1) The OCR assistant routes questions that belong to
 * other assistants (captain / compliance / search) away instead of guessing.
 * (2) Other assistants consume OCR state through this fixed vocabulary —
 * the Captain Assistant only ever sees a simple readiness count, the
 * Compliance Assistant gets an explanation of what blocks compliance, and the
 * Search Assistant gets the retrieval phrases it can serve.
 */

import type {
  OcrQualityLevel,
  ReviewPriority,
} from "./types";

// ── OCR assistant handoff detector ───────────────────────────────────────────

export interface OcrHandoffDecision {
  readonly handoff: boolean;
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface OcrHandoffDetector {
  detect(query: string): OcrHandoffDecision;
}

const CAPTAIN_PATTERNS: ReadonlyArray<string> = [
  "port readiness",
  "ready for the port",
  "am i ready",
  "port call",
  "next port",
  "arrival requirements",
  "did you receive",
  "bdn received",
  "ingest",
];

const COMPLIANCE_PATTERNS: ReadonlyArray<string> = [
  "non-compliant",
  "is this compliant",
  "compliance status",
  "penalty",
  "obligation",
  "surrender",
  "allowance",
  "ghg intensity",
  "eu ets",
  "fueleu",
];

const SEARCH_PATTERNS: ReadonlyArray<string> = [
  "find ",
  "search for",
  "locate",
  "look up",
  "show me the document",
  "where is the document",
  "which document",
  "list documents",
];

export function createOcrHandoffDetector(): OcrHandoffDetector {
  function detect(query: string): OcrHandoffDecision {
    const lower = query.toLowerCase().trim();

    const captain = CAPTAIN_PATTERNS.filter((p) => lower.includes(p));
    if (captain.length > 0) {
      return {
        handoff: true,
        target: "captain",
        confidence: Math.min(0.6 + captain.length * 0.15, 1.0),
        reason: `This is a port-operation or document-flow question (${captain.join(", ")}). Routing to the Captain Assistant.`,
      };
    }

    const compliance = COMPLIANCE_PATTERNS.filter((p) => lower.includes(p));
    if (compliance.length > 0) {
      return {
        handoff: true,
        target: "compliance",
        confidence: Math.min(0.6 + compliance.length * 0.15, 1.0),
        reason: `This requires a regulatory interpretation (${compliance.join(", ")}). The OCR Assistant only reports extraction quality and corrections; routing to the Compliance Assistant.`,
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

    return { handoff: false, target: "none", confidence: 0, reason: "Handled by the OCR Assistant." };
  }

  return { detect };
}

// ── Captain — simple readiness summary (never OCR internals) ─────────────────

export interface OcrReadinessItem {
  readonly documentId: string;
  readonly title: string;
  readonly level: OcrQualityLevel;
  readonly needsReview: boolean;
}

/**
 * Captain Assistant surface. The captain only receives a count and a plain
 * recommendation — quality scores, confidence bands and repair suggestions are
 * OCR internals and are never exposed here.
 */
export function captainOcrReadinessSummary(
  documents: ReadonlyArray<OcrReadinessItem>,
): string {
  const review = documents.filter((d) => d.needsReview);
  if (documents.length === 0) {
    return "No scanned documents are on file for this vessel, so no OCR review is pending.";
  }
  if (review.length === 0) {
    return `All ${documents.length} scanned documents on file are readable. No OCR review is pending.`;
  }
  const byLevel = new Map<OcrQualityLevel, number>();
  for (const d of review) {
    byLevel.set(d.level, (byLevel.get(d.level) ?? 0) + 1);
  }
  const parts = [...byLevel.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([level, count]) => `${count} ${level.toLowerCase()}`);
  return `${review.length} of ${documents.length} scanned documents need OCR review before the next port call (${parts.join(", ")}). The review queue handles them.`;
}

// ── Compliance — why OCR quality blocks compliance ───────────────────────────

export interface ComplianceOcrExplanationInput {
  readonly documentId: string;
  readonly title: string;
  readonly level: OcrQualityLevel;
  readonly priority: ReviewPriority;
  readonly family: string;
  readonly overallQualityScore: number;
  readonly missingMandatoryFields: ReadonlyArray<string>;
}

/**
 * Compliance Assistant surface. Explains in compliance terms what must be
 * corrected before the extraction can support a compliance decision.
 */
export function complianceOcrExplanation(
  input: ComplianceOcrExplanationInput,
): string {
  const missing =
    input.missingMandatoryFields.length > 0
      ? ` The following mandatory field(s) could not be read: ${input.missingMandatoryFields.join(", ")}.`
      : "";
  return `Document ${input.title} (${input.documentId}) has OCR quality ${input.level.toLowerCase()} (score ${input.overallQualityScore.toFixed(2)}). Its content reads as a ${input.family.toLowerCase()} document. This extraction cannot support a compliance decision until the quality issue is resolved (review priority ${input.priority.toLowerCase()}).${missing} Correct the highlighted fields during review; compliance is not asserted from unreadable evidence.`;
}

// ── Search — vocabulary the Search assistant serves ──────────────────────────

export function searchOcrPhrases(): ReadonlyArray<string> {
  return [
    "documents needing OCR review",
    "low quality scans",
    "documents with unreadable text",
    "scans with wrong document type",
  ];
}
