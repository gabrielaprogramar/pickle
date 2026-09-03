/**
 * mrv/applicability.ts — scope-aware EU MRV applicability
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 requires SHARED / scope-aware MRV applicability: no `GT >= threshold`
 * alone, no `?? false` coercion. The MRV determination reuses the SAME
 * regulatory applicability layer as EU ETS / FuelEU
 * (`determineApplicability` + `ruleEffectiveOn` from
 * `src/lib/regulatory/applicability`), which reads the `EU_MRV/mrv_scope` rule
 * from `regulatory_rules`. On top of that rule-driven GT gate, a vessel must
 * actually engage in EU trade (voyages to/from a Member State port) in the
 * year, so we refine the GT decision with per-voyage scope — the same pattern
 * as `refineFuelEuApplicability` in the FuelEU pipeline.
 *
 * Deterministic: GT applies only when the rule says so; UNKNOWN/REQUIRES_REVIEW
 * are first-class and never coerced.
 */

import type { ApplicabilityDecision } from "@/lib/regulatory/applicability";

/**
 * Refine the GT-only MRV decision with EU-engagement awareness derived from
 * per-voyage scope (port-call data). Mirrors the FuelEU refinement:
 *   - GT gate not APPLICABLE → unchanged (never overridden).
 *   - At least one EU-scope voyage (INTRA_EU / EU_TO_THIRD / THIRD_TO_EU) →
 *     the GT threshold genuinely applies; keep APPLICABLE.
 *   - No voyages recorded → REQUIRES_REVIEW (cannot prove EU engagement).
 *   - All voyages NON_EU with no unresolved ports → NOT_APPLICABLE for the year.
 *   - Indeterminate scope or unresolved ports → REQUIRES_REVIEW.
 */
export function refineMrvApplicability(
  decision: ApplicabilityDecision,
  voyagesScope: ReadonlyArray<{
    id: string;
    scope_type: string;
    unknown_ports?: string[];
  }>,
): ApplicabilityDecision {
  if (decision.applicability !== "APPLICABLE") return decision;

  const euScoped = ["INTRA_EU", "EU_TO_THIRD", "THIRD_TO_EU"];
  if (voyagesScope.some((v) => euScoped.includes(v.scope_type))) return decision;

  const anyUnknownPort = voyagesScope.some((v) => (v.unknown_ports ?? []).length > 0);
  const base = decision.notes ?? "";

  if (voyagesScope.length === 0) {
    return {
      ...decision,
      applicability: "REQUIRES_REVIEW",
      is_decision_final: false,
      notes:
        base +
        " GT threshold met but no voyage/port-call activity is recorded for the year — EU engagement cannot be confirmed without evidence; review.",
    };
  }

  const allNonEu = voyagesScope.every((v) => v.scope_type === "NON_EU");
  if (allNonEu && !anyUnknownPort) {
    return {
      ...decision,
      applicability: "NOT_APPLICABLE",
      is_decision_final: true,
      notes:
        base +
        " GT threshold met but all recorded voyages are NON_EU (no EU engagement) — EU MRV not applicable for the year.",
    };
  }

  return {
    ...decision,
    applicability: "REQUIRES_REVIEW",
    is_decision_final: false,
    notes:
      base +
      " GT threshold met but voyage scope is indeterminate (unknown/unresolved ports) — EU-engagement review required.",
  };
}
