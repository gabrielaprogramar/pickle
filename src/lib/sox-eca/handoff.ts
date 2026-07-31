/**
 * sox-eca/handoff.ts — handoff surface for the Captain / Compliance / Search assistants
 * ────────────────────────────────────────────────────────────────────────────
 *
 * These assistants REUSE sox-eca state through this fixed vocabulary; no
 * sulphur math lives in the assistants. Each string is a stable contract the
 * assistant prompt/tools can quote.
 */

import type { SoxEvaluationResult } from "./types";
import { formatSulphurLimit } from "./parameters";

export type SoxHandoffTarget = "captain" | "compliance" | "search";

export interface SoxHandoffStatement {
  readonly target: SoxHandoffTarget;
  readonly question: string;
  readonly answer: string;
}

/** Captain — "Am I okay for the Med?" readiness summary. */
export function captainSoxReadiness(evaluation: SoxEvaluationResult): SoxHandoffStatement {
  return {
    target: "captain",
    question: "Am I okay for the Med?",
    answer: captainReadinessText(evaluation),
  };
}

export function captainReadinessText(evaluation: SoxEvaluationResult): string {
  if (!evaluation.geometryAvailable) {
    return "The Mediterranean SOx ECA geometry is not available, so I cannot assess sulphur readiness for the Med right now (SOX-ECA-06).";
  }
  if (!evaluation.ecaEffective) {
    return "The Mediterranean SOx ECA is not yet in force (effective 2025-05-01); the global 0.50% m/m sulphur cap applies for now.";
  }
  if (evaluation.insideEca) {
    const limit = formatSulphurLimit(evaluation.applicableLimitPct ?? 0.1);
    switch (evaluation.watchStatus) {
      case "CLEAR":
        return `You are inside the Med SOx ECA and available bunker evidence indicates ${evaluation.sulphurContentPct}% m/m sulphur, within the ${limit}. No fuel changeover is assumed — this is based on bunker evidence only.`;
      case "NON_CONFORMING":
        return `You are inside the Med SOx ECA and available bunker evidence indicates ${evaluation.sulphurContentPct}% m/m sulphur, which exceeds the ${limit}. You are not okay for the Med on current evidence — review the bunker record before entering or transiting.`;
      case "NO_EVIDENCE":
        return `You are inside the Med SOx ECA but there is no usable bunker sulphur evidence on file to show compliance with the ${limit}. Please upload the BDN(s) for your current bunkers.`;
      case "UNKNOWN":
        return `You are inside the Med SOx ECA, but the bunker sulphur evidence is conflicting or under review, so I cannot confirm readiness. Please resolve the review task first.`;
      default:
        return `You are inside the Med SOx ECA. Watch status: ${evaluation.watchStatus}.`;
    }
  }
  return `You are outside the Mediterranean SOx ECA. The ${formatSulphurLimit(evaluation.applicableLimitPct ?? 0.5)} global cap applies; make sure bunker evidence is on file before you enter the Med.`;
}

/** Compliance — explain the regulatory meaning of an alert. */
export function complianceSoxExplanation(evaluation: SoxEvaluationResult): SoxHandoffStatement {
  const limit = formatSulphurLimit(evaluation.applicableLimitPct ?? 0.1);
  let meaning: string;
  switch (evaluation.watchStatus) {
    case "NON_CONFORMING":
      meaning =
        `Available bunker evidence indicates ${evaluation.sulphurContentPct}% m/m sulphur, exceeding the ${limit} ` +
        `(MARPOL Annex VI Regulation 14, Med SOx ECA in force 1 May 2025). This is a potential regulatory non-conformance ` +
        `for fuel sulphur content — not a statement that the vessel is burning non-compliant fuel; that would require ` +
        `fuel-in-use / changeover evidence.`;
      break;
    case "NO_EVIDENCE":
      meaning =
        `No usable bunker evidence substantiates compliance with the ${limit} while inside the Med SOx ECA. ` +
        `Absence of evidence is treated as a compliance gap, never as proof of compliance.`;
      break;
    case "UNKNOWN":
      meaning =
        `Bunker sulphur evidence is conflicting, ambiguous, or under review. The watch is UNKNOWN and a review task is ` +
        `required before the vessel can be declared conforming.`;
      break;
    case "CLEAR":
      meaning =
        `Available bunker evidence indicates ${evaluation.sulphurContentPct}% m/m sulphur, within the ${limit}. ` +
        `This is a bunker-evidence-based determination, not an assertion about fuel-in-use.`;
      break;
    default:
      meaning = `Watch status ${evaluation.watchStatus} for the Mediterranean SOx ECA.`;
  }
  return {
    target: "compliance",
    question: "Explain the SOx alert for this vessel",
    answer: `Regulatory explanation — ${meaning} The watch was last evaluated at ${evaluation.evaluatedAt}.`,
  };
}

/** Search — the vocabulary used to retrieve SOx compliance events across the fleet. */
export function soxSearchPhrases(): ReadonlyArray<string> {
  return [
    "vessels with SOx ECA warnings",
    "vessels non-conforming on sulphur inside the Med ECA",
    "vessels without bunker evidence inside the Med SOx ECA",
    "vessels with SOx review required",
  ];
}
