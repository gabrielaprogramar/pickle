/**
 * sox-eca/evidence.ts — deterministic BDN sulphur evidence classification
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A BDN documents *delivered* fuel. It never asserts what the engine is
 * burning — that requires fuel-in-use / fuel-changeover evidence. All rule
 * phrasing downstream therefore says "Available bunker evidence indicates…".
 *
 * Selection rules (deterministic, no LLM):
 *   1. Exclude rejected/disputed deliveries (unreliable).
 *   2. Any delivery whose document is under review or rejected → REVIEW_REQUIRED.
 *   3. If two or more usable deliveries carry conflicting sulphur values
 *      (disagree on conforming vs the ECA/global limit), the selection is
 *      AMBIGUOUS → REVIEW_REQUIRED. We do NOT blindly pick one.
 *   4. Otherwise pick the most recent usable delivery (by delivery date).
 */

import type { BunkerEvidenceSelection, SoxEvidenceSource } from "./types";
import { isSulphurConforming } from "./parameters";

const REJECTED_STATUSES: ReadonlyArray<string> = ["rejected", "disputed"];
const REVIEW_SENSITIVE_STATES: ReadonlyArray<string> = ["under_review", "rejected"];

export function evidenceFromFuelDelivery(
  delivery: {
    readonly id: string;
    readonly document_id: string | null;
    readonly ocr_result_id: string | null;
    readonly ai_extraction_id: string | null;
    readonly delivery_date: string;
    readonly delivery_port: string;
    readonly fuel_type: string;
    readonly quantity_mt: number;
    readonly sulphur_content_pct: number | null;
    readonly status: string;
  },
  enrichment?: {
    readonly review_state?: string | null;
    readonly ai_confidence?: number | null;
  } | null,
): SoxEvidenceSource {
  return {
    fuel_delivery_id: delivery.id,
    document_id: delivery.document_id,
    ocr_result_id: delivery.ocr_result_id,
    ai_extraction_id: delivery.ai_extraction_id,
    delivery_date: delivery.delivery_date,
    delivery_port: delivery.delivery_port,
    fuel_type: delivery.fuel_type,
    quantity_mt: delivery.quantity_mt,
    sulphur_content_pct: delivery.sulphur_content_pct,
    delivery_status: delivery.status,
    review_state: enrichment?.review_state ?? null,
    ai_confidence: enrichment?.ai_confidence ?? null,
    source: enrichment?.ai_confidence != null ? "BDN AI extraction" : "BDN OCR",
  };
}

export function selectBunkerEvidence(
  candidates: ReadonlyArray<SoxEvidenceSource>,
): BunkerEvidenceSelection {
  const reasons: string[] = [];

  if (candidates.length === 0) {
    return {
      selected: null,
      state: "NO_EVIDENCE",
      ambiguous: false,
      reviewRequired: false,
      candidateCount: 0,
      usableCount: 0,
      reasons: ["No bunker delivery notes on file for this vessel."],
    };
  }

  const usable = candidates.filter((c) => !REJECTED_STATUSES.includes(c.delivery_status));

  if (usable.length === 0) {
    reasons.push(
      "All bunker deliveries are rejected or disputed, so no sulphur value is reliable.",
    );
    return {
      selected: null,
      state: "REVIEW_REQUIRED",
      ambiguous: false,
      reviewRequired: true,
      candidateCount: candidates.length,
      usableCount: 0,
      reasons,
    };
  }

  const sensitive = usable.some((c) =>
    REVIEW_SENSITIVE_STATES.includes(c.review_state ?? ""),
  );

  const withSulphur = usable.filter((c) => c.sulphur_content_pct != null);

  if (withSulphur.length === 0) {
    reasons.push(
      "No usable delivery carries a sulphur content value to compare against the limit.",
    );
    return {
      selected: null,
      state: "NO_SULPHUR",
      ambiguous: false,
      reviewRequired: sensitive,
      candidateCount: candidates.length,
      usableCount: usable.length,
      reasons,
    };
  }

  // Conflicting values between two or more usable deliveries are ambiguous.
  if (withSulphur.length >= 2) {
    const first = withSulphur[0]!;
    const same = withSulphur.every((c) => {
      const a = first.sulphur_content_pct!;
      const b = c.sulphur_content_pct!;
      return (
        isSulphurConforming(a, 0.5) === isSulphurConforming(b, 0.5) &&
        isSulphurConforming(a, 0.1) === isSulphurConforming(b, 0.1)
      );
    });
    if (!same) {
      reasons.push(
        `Multiple bunker deliveries carry conflicting sulphur values (${withSulphur
          .map((c) => `${c.sulphur_content_pct}% on ${c.delivery_date.slice(0, 10)}`)
          .join(", ")}); selecting one would be arbitrary.`,
      );
      return {
        selected: null,
        state: "REVIEW_REQUIRED",
        ambiguous: true,
        reviewRequired: true,
        candidateCount: candidates.length,
        usableCount: usable.length,
        reasons,
      };
    }
  }

  const sorted = [...withSulphur].sort((a, b) => {
    return new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime();
  });
  const selected = sorted[0]!;

  if (sensitive) {
    reasons.push(
      `Most recent bunker evidence (${selected.delivery_date.slice(0, 10)}) is not yet approved — document is ${selected.review_state}.`,
    );
    return {
      selected,
      state: "REVIEW_REQUIRED",
      ambiguous: false,
      reviewRequired: true,
      candidateCount: candidates.length,
      usableCount: usable.length,
      reasons,
    };
  }

  reasons.push(
    `Selected most recent bunker delivery ${selected.delivery_date.slice(0, 10)} at ${selected.delivery_port}.`,
  );
  return {
    selected,
    state: "READY",
    ambiguous: false,
    reviewRequired: false,
    candidateCount: candidates.length,
    usableCount: usable.length,
    reasons,
  };
}
