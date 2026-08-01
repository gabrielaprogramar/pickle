/**
 * priority.ts — deterministic review-priority engine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Derives how urgently a document needs human review from OCR quality,
 * validation failures and document family. Priority is CRITICAL / HIGH /
 * MEDIUM / LOW and every decision carries explicit reasons. The assistant and
 * the review page both quote these reasons — no LLM computes urgency.
 *
 * HOW IT FITS
 * ocr-tools.ts (explain_review_reason) and the API layer use
 * evaluateReviewPriority. It never mutates state; it only reasons.
 */

import type {
  OcrDocumentFamily,
  OcrQualityLevel,
  OcrQualityScore,
  ReviewPriority,
  ReviewPriorityDecision,
} from "./types";

export interface PriorityEvaluationInput {
  readonly quality: OcrQualityScore;
  readonly family: OcrDocumentFamily;
  readonly validationBlockingIssues?: ReadonlyArray<string>;
  readonly validationStatus?: string;
  readonly expired?: boolean;
  readonly expiresSoon?: boolean;
}

const RANK: Readonly<Record<ReviewPriority, number>> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const LEVEL_BASE: Readonly<Record<OcrQualityLevel, ReviewPriority>> = {
  HIGH: "LOW",
  MEDIUM: "MEDIUM",
  LOW: "HIGH",
  VERY_LOW: "CRITICAL",
};

export function priorityRank(priority: ReviewPriority): number {
  return RANK[priority];
}

export function priorityLabel(priority: ReviewPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

/**
 * Evaluate review priority. Bumps (certificates, expiry, missing mandatory
 * fields, validation failures) can only raise urgency, never lower it.
 */
export function evaluateReviewPriority(input: PriorityEvaluationInput): ReviewPriorityDecision {
  const base = LEVEL_BASE[input.quality.level];
  let rank = RANK[base];
  const reasons: string[] = [`OCR quality is ${input.quality.level.toLowerCase()}.`];

  const apply = (target: ReviewPriority, reason: string): void => {
    if (RANK[target] < rank) {
      rank = RANK[target];
      reasons.push(reason);
    }
  };

  const blocking = input.validationBlockingIssues ?? [];
  if (blocking.length > 0) {
    apply("HIGH", `${blocking.length} blocking validation issue(s) present.`);
    if (blocking.length >= 2) apply("CRITICAL", "Multiple blocking validation issues.");
  }

  if (input.validationStatus === "failed") {
    apply("HIGH", "Validation failed.");
  }

  if (input.family === "CERTIFICATE") {
    const deficiency = input.quality.level !== "HIGH" || input.quality.missingMandatoryFields.length > 0;
    if (deficiency) {
      apply("HIGH", "Certificate with any OCR deficiency receives HIGH review attention.");
    }
  }

  if (input.expired) {
    apply("HIGH", "Document is expired.");
  }

  if (input.expiresSoon) {
    apply("MEDIUM", "Document expires soon.");
  }

  if (input.quality.missingMandatoryFields.length > 0) {
    apply("MEDIUM", `Missing mandatory field(s): ${input.quality.missingMandatoryFields.join(", ")}.`);
  }

  const priority = (Object.keys(RANK) as ReviewPriority[]).find(
    (p) => RANK[p] === rank,
  ) ?? "LOW";

  return { priority, reasons };
}
