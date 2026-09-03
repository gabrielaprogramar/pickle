/**
 * mrv/monitoring-plan.ts — deterministic active Monitoring Plan resolution
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 requires a first-class versioned Monitoring Plan domain model and a
 * DETERMINISTIC active-plan resolution: given a vessel and an "as-of" date the
 * system must select exactly ONE plan that governs monitoring, or surface
 * NOT_FOUND / REQUIRES_REVIEW rather than guess. The MRV regulation requires
 * ships to monitor per a VERIFIED, APPROVED plan (Art. 6 / Art. 7 Reg.
 * (EU) 2015/757). A plan that is not approved cannot legally govern an annual
 * report.
 *
 * Resolution rules (deterministic, no silent picking):
 *   1. Only APPROVED plans are candidates for "active". A DRAFT /
 *      UNDER_REVISION / SUBMITTED_* plan does not govern annual reporting.
 *   2. A candidate must be effective on the as-of date (effective_from <= date
 *      <= effective_until, when set).
 *   3. Exactly one APPROVED effective plan → RESOLVED.
 *   4. No APPROVED effective plan → NOT_FOUND (cannot legally report).
 *   5. More than one APPROVED effective plan AND no SUPERSEDED marker to break
 *      the tie → REQUIRES_REVIEW (ambiguous overlap).
 *   6. The ONLY approved plan exists but is not yet effective on the date, or
 *      its period does not cover the date → NOT_FOUND (gapped coverage, not a
 *      guess). We never fabricate an effective date.
 *
 * This module is PURE / deterministic given its inputs (plan versions are
 * passed in; the caller fetches them). No DB access here.
 */

import type { MrvMonitoringPlan, MonitoringPlanResolution } from "./types";

/**
 * Resolve the single active (approved + effective) plan for a vessel on a date.
 * Deterministic; never picks among ambiguous candidates.
 */
export function resolveActiveMonitoringPlan(
  plans: ReadonlyArray<MrvMonitoringPlan>,
  asOfDate: string,
): MonitoringPlanResolution {
  const approved = plans.filter((p) => p.status === "APPROVED");
  if (approved.length === 0) {
    return {
      status: "NOT_FOUND",
      reason:
        "No APPROVED monitoring plan exists for this vessel. A plan must be verified and approved (Art. 7 Reg. (EU) 2015/757) before it can govern an annual report.",
    };
  }

  const asOf = new Date(asOfDate + "T00:00:00Z").getTime();
  const effective = approved.filter((p) => {
    if (p.effective_from !== null) {
      const from = new Date(p.effective_from + "T00:00:00Z").getTime();
      if (asOf < from) return false;
    }
    if (p.effective_until !== null) {
      const until = new Date(p.effective_until + "T00:00:00Z").getTime();
      if (asOf > until) return false;
    }
    return true;
  });

  // Any remaining APPROVED plan that is EFFECTIVE on the date.
  if (effective.length === 1) {
    return { status: "RESOLVED", plan: effective[0]! };
  }

  if (effective.length === 0) {
    return {
      status: "NOT_FOUND",
      reason:
        "Approved monitoring plan(s) exist but none is effective on " + asOfDate + " — the vessel would be un-monitored for this period. Review required; no plan assumed.",
    };
  }

  // More than one approved AND effective plan with no SUPERSEDED marker → the
  // overlap is ambiguous. The caller must record which version is superseded.
  const approvedButNotSuperseded = effective.filter((p) => p.status !== "SUPERSEDED");
  if (approvedButNotSuperseded.length > 1) {
    return {
      status: "REQUIRES_REVIEW",
      reason:
        "More than one APPROVED monitoring plan is effective on " + asOfDate + " and none is marked SUPERSEDED — ambiguous overlap; requires review.",
      candidates: [...approvedButNotSuperseded],
    };
  }

  return { status: "RESOLVED", plan: approvedButNotSuperseded[0]! };
}

/**
 * Build the next version number for a new plan for a vessel.
 * Deterministic: highest existing version + 1 (0 when none exist).
 */
export function nextMonitoringPlanVersion(
  plans: ReadonlyArray<{ readonly version: number }>,
): number {
  if (plans.length === 0) return 1;
  const max = Math.max(...plans.map((p) => p.version));
  return max + 1;
}
