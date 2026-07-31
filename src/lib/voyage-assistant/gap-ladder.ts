import type { AisGap, AisGapTier, VoyageDataGapSummary } from "./types";

export const GAP_FLAGGED_FROM_MINUTES = 30;
export const GAP_MANUAL_FROM_MINUTES = 6 * 60;
export const GAP_CRITICAL_FROM_MINUTES = 48 * 60;

export interface GapClassification {
  readonly tier: AisGapTier;
  readonly actionRequired: string;
  readonly escalation: boolean;
  readonly label: string;
}

export const TIER_ORDER: Record<AisGapTier, number> = {
  NONE: 0,
  INTERPOLATION_OK: 1,
  FLAGGED: 2,
  MANUAL_REQUIRED: 3,
  CRITICAL_ESCALATION: 4,
};

export function classifyGapDuration(durationMinutes: number): GapClassification {
  if (durationMinutes < GAP_FLAGGED_FROM_MINUTES) {
    return {
      tier: "INTERPOLATION_OK",
      actionRequired:
        "No action required — the AIS data gap is under 30 minutes and falls inside the standard interpolation window.",
      escalation: false,
      label: "Interpolation OK",
    };
  }
  if (durationMinutes < GAP_MANUAL_FROM_MINUTES) {
    return {
      tier: "FLAGGED",
      actionRequired:
        "Flag the covered segment as interpolation-uncertain. No manual voyage draft is required yet.",
      escalation: false,
      label: "Flagged",
    };
  }
  if (durationMinutes <= GAP_CRITICAL_FROM_MINUTES) {
    return {
      tier: "MANUAL_REQUIRED",
      actionRequired:
        "A manual voyage draft is required to substantiate the covered segment before it can be accepted.",
      escalation: false,
      label: "Manual required",
    };
  }
  return {
    tier: "CRITICAL_ESCALATION",
    actionRequired:
      "Escalate — the AIS data gap exceeds 48 hours. A manual voyage draft with supporting evidence is required before the segment can be accepted.",
    escalation: true,
    label: "Critical escalation",
  };
}

export function worstTier(gaps: ReadonlyArray<AisGap>): AisGapTier {
  let worst: AisGapTier = "NONE";
  for (const gap of gaps) {
    if (TIER_ORDER[gap.tier] > TIER_ORDER[worst]) {
      worst = gap.tier;
    }
  }
  return worst;
}

export function coveragePct(
  gaps: ReadonlyArray<AisGap>,
  referenceFrom: string,
  referenceTo: string,
): number {
  const totalMinutes = Math.max(
    1,
    Math.round((new Date(referenceTo).getTime() - new Date(referenceFrom).getTime()) / 60_000),
  );
  const gapMinutes = gaps.reduce((acc, gap) => acc + gap.durationMinutes, 0);
  const covered = Math.max(0, totalMinutes - gapMinutes);
  return Math.min(100, Math.round((covered / totalMinutes) * 100));
}

export function summarizeGaps(
  gaps: ReadonlyArray<AisGap>,
  referenceFrom: string,
  referenceTo: string,
): VoyageDataGapSummary {
  const worst = worstTier(gaps);
  const worstGap =
    gaps.length === 0
      ? null
      : gaps.reduce((a, b) => (TIER_ORDER[b.tier] > TIER_ORDER[a.tier] ? b : a));
  return {
    totalGaps: gaps.length,
    worstTier: worst,
    worstGap,
    flaggedGaps: gaps.filter((g) => g.tier === "FLAGGED").length,
    manualGaps: gaps.filter((g) => g.tier === "MANUAL_REQUIRED").length,
    criticalGaps: gaps.filter((g) => g.tier === "CRITICAL_ESCALATION").length,
    coveragePct: coveragePct(gaps, referenceFrom, referenceTo),
    referencePeriodMinutes: Math.max(
      1,
      Math.round((new Date(referenceTo).getTime() - new Date(referenceFrom).getTime()) / 60_000),
    ),
    referenceFrom,
    referenceTo,
  };
}

export function formatGapLadder(): string {
  return [
    "AIS GAP LADDER (deterministic tiers):",
    "- < 30 minutes: INTERPOLATION_OK — standard interpolation window, no action.",
    "- 30 minutes to under 6 hours: FLAGGED — segment is interpolation-uncertain.",
    "- 6 hours to 48 hours: MANUAL_REQUIRED — a manual voyage draft is required.",
    "- over 48 hours: CRITICAL_ESCALATION — escalation required with supporting evidence.",
  ].join("\n");
}
