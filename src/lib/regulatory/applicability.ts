/**
 * regulatory/applicability.ts — effective-date-aware regulatory applicability
 * determination
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 1 makes regulatory applicability a first-class, deterministic, auditable
 * concern instead of a hardcoded side-effect inside the EU ETS / FuelEU engines.
 *
 *   • Scope is decided by RULES read from the centralised `regulatory_rules`
 *     store, NOT by GT-only thresholds baked into engine code.
 *   • Rules are EFFECTIVE-DATED: the determination uses the rule version that
 *     governs the requested date.
 *   • UNKNOWN and REQUIRES_REVIEW are FIRST-CLASS outcomes. When required vessel
 *     facts are missing the answer is UNKNOWN (never silently assumed
 *     applicable/not); when facts conflict or judgement is needed it is
 *     REQUIRES_REVIEW.
 *
 * This module is PURE / deterministic given its inputs — it takes the effective
 * rule(s) and vessel facts and returns a decision. It does not touch the DB.
 */

import type { VesselProfile } from "./types";
import type { RegulatoryRuleRow } from "@/lib/supabase/types";

export const APPLICABILITY_VALUES = [
  "APPLICABLE",
  "NOT_APPLICABLE",
  "UNKNOWN",
  "REQUIRES_REVIEW",
] as const;

export type Applicability = (typeof APPLICABILITY_VALUES)[number];

/** Regulatory codes the foundation is rule-driven for. */
export const REGULATIONS = [
  "EU_ETS",
  "FUEL_EU",
  "EU_MRV",
] as const;

export type Regulation = (typeof REGULATIONS)[number];

export interface ApplicabilityDecision {
  readonly applicability: Applicability;
  readonly is_decision_final: boolean;
  readonly rule_version: number;
  readonly rule_effective_from: string;
  readonly rule_effective_until: string | null;
  readonly basis: {
    readonly facts_used: Record<string, unknown>;
    readonly missing_facts: string[];
    readonly conflicts: string[];
  };
  readonly notes: string | null;
}

export interface RuleContext {
  readonly rule: RegulatoryRuleRow;
  readonly facts: VesselProfile;
}

/** Pick the rule version that governs a date from a key's version history. */
export function ruleEffectiveOn(
  rules: RegulatoryRuleRow[],
  asOfDate: string,
): RegulatoryRuleRow | null {
  const asOf = new Date(asOfDate + "T00:00:00Z").getTime();
  return (
    rules
      .filter((r) => {
        const from = new Date(r.effective_from + "T00:00:00Z").getTime();
        if (asOf < from) return false;
        if (r.effective_until !== null) {
          const until = new Date(r.effective_until + "T00:00:00Z").getTime();
          if (asOf > until) return false;
        }
        return true;
      })
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

/**
 * Determine applicability of a regulation for a vessel on a given date.
 *
 * The outcome is driven by the effective rule's `parameters`. If the rule or a
 * fact it needs is missing, the result is UNKNOWN with the missing items listed
 * (never a silent assumption). Conflicting conditions yield REQUIRES_REVIEW.
 */
export function determineApplicability(
  context: { rule: RegulatoryRuleRow | null; facts: VesselProfile },
  regulation: Regulation,
  asOfDate: string,
): ApplicabilityDecision {
  const { rule, facts } = context;
  const asOf = asOfDate;

  if (!rule) {
    return {
      applicability: "UNKNOWN",
      is_decision_final: false,
      rule_version: 0,
      rule_effective_from: asOf,
      rule_effective_until: null,
      basis: {
        facts_used: {},
        missing_facts: ["effective_rule"],
        conflicts: [],
      },
      notes: `No effective rule found for ${regulation} as of ${asOf} — cannot determine applicability.`,
    };
  }

  const notes: string[] = [];
  const conflicts: string[] = [];
  const factsUsed: Record<string, unknown> = {};

  if (regulation === "EU_ETS") {
    return decideEts({ rule, facts }, { notes, conflicts, factsUsed });
  }
  if (regulation === "EU_MRV") {
    return decideMrv({ rule, facts }, { notes, conflicts, factsUsed });
  }
  if (regulation === "FUEL_EU") {
    return decideFuelEu({ rule, facts }, { notes, conflicts, factsUsed });
  }
  return {
    applicability: "REQUIRES_REVIEW",
    is_decision_final: false,
    rule_version: rule.version,
    rule_effective_from: rule.effective_from,
    rule_effective_until: rule.effective_until,
    basis: { facts_used: factsUsed, missing_facts: [], conflicts: [`Unknown regulation ${regulation}`] },
    notes: `Unsupported regulation ${regulation} — requires review.`,
  };
}

/**
 * EU ETS surrender obligation scope.
 * Rule: `ets_scope` parameters — `applicable_gt_min` and optional
 * `flag_exemptions` / `vessel_type_exemptions`.
 */
function decideEts(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
) {
  const p = rc.rule.parameters as {
    applicable_gt_min?: number;
    flag_exemptions?: string[];
    vessel_type_exemptions?: string[];
    vessel_route?: string;
  };
  const gtMin = p.applicable_gt_min ?? 5000;

  acc.factsUsed.gt = rc.facts.gt;
  if (rc.facts.flag !== null) acc.factsUsed.flag = rc.facts.flag;
  if (rc.facts.vesselType !== null) acc.factsUsed.vessel_type = rc.facts.vesselType;

  // GT is the primary gate. Without it the answer is UNKNOWN — never assumed.
  if (rc.facts.gt === null) {
    return unknownDecision(
      rc,
      ["gt"],
      acc,
      "EU ETS scope cannot be determined: GT not on file.",
    );
  }

  // Flag exemptions are only resolvable when the flag is known. If exemptions
  // are configured but the flag is unknown, that is REQUIRES_REVIEW rather than
  // a silent in/out call.
  const flagExempts =
    Array.isArray(p.flag_exemptions) && p.flag_exemptions.length > 0;
  if (flagExempts) {
    if (rc.facts.flag === null) {
      return reviewsDecision(
        rc,
        acc,
        "EU ETS flag exemptions are configured but the vessel flag is unknown — requires review.",
      );
    }
    if (p.flag_exemptions!.includes(rc.facts.flag)) {
      acc.notes.push(`Flag ${rc.facts.flag} is exempt from EU ETS surrender.`);
      return notApplicableDecision(rc, acc, "EU ETS flag exemption applies.");
    }
  }

  // Vessel type exemptions: only resolvable when the type is known.
  const typeExempts =
    Array.isArray(p.vessel_type_exemptions) && p.vessel_type_exemptions.length > 0;
  if (typeExempts) {
    if (rc.facts.vesselType === null) {
      return reviewsDecision(
        rc,
        acc,
        "EU ETS vessel-type exemptions are configured but the vessel type is unknown — requires review.",
      );
    }
    if (p.vessel_type_exemptions!.includes(rc.facts.vesselType)) {
      acc.notes.push(`Vessel type ${rc.facts.vesselType} is exempt from EU ETS surrender.`);
      return notApplicableDecision(rc, acc, "EU ETS vessel-type exemption applies.");
    }
  }

  if (rc.facts.gt < gtMin) {
    return notApplicableDecision(
      rc,
      acc,
      `Below EU ETS GT threshold (${gtMin}) — not in surrender scope.`,
    );
  }

  acc.notes.push(`EU ETS surrender scope applies (GT ${rc.facts.gt} >= ${gtMin}).`);
  return applicableDecision(rc, acc, "EU ETS surrender obligation applies.");
}

/** EU MRV monitoring scope (mirrors the classic >=5000 GT rule). */
function decideMrv(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
) {
  const p = rc.rule.parameters as { applicable_gt_min?: number };
  const gtMin = p.applicable_gt_min ?? 5000;
  acc.factsUsed.gt = rc.facts.gt;

  if (rc.facts.gt === null) {
    return unknownDecision(rc, ["gt"], acc, "EU MRV monitoring scope requires GT — unavailable.");
  }
  if (rc.facts.gt < gtMin) {
    return notApplicableDecision(rc, acc, `Below EU MRV GT threshold (${gtMin}).`);
  }
  acc.notes.push(`EU MRV monitoring applies (GT ${rc.facts.gt} >= ${gtMin}).`);
  return applicableDecision(rc, acc, "EU MRV monitoring scope applies.");
}

/**
 * FuelEU Maritime — the audit found FuelEU had NO applicability gate at all.
 * The research gate is >=5000 GT. When GT is unknown, the answer is UNKNOWN —
 * never assumed in/out.
 */
function decideFuelEu(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
) {
  const p = rc.rule.parameters as { applicable_gt_min?: number };
  const gtMin = p.applicable_gt_min ?? 5000;
  acc.factsUsed.gt = rc.facts.gt;

  if (rc.facts.gt === null) {
    return unknownDecision(rc, ["gt"], acc, "FuelEU applicability requires GT — unavailable.");
  }
  if (rc.facts.gt < gtMin) {
    return notApplicableDecision(rc, acc, `Below FuelEU GT threshold (${gtMin}).`);
  }
  acc.notes.push(`FuelEU applies (GT ${rc.facts.gt} >= ${gtMin}).`);
  return applicableDecision(rc, acc, "FuelEU Maritime obligation applies.");
}

function applicableDecision(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
  note: string,
): ApplicabilityDecision {
  acc.notes.push(note);
  return baseDecision("APPLICABLE", true, rc, acc);
}

function notApplicableDecision(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
  note: string,
): ApplicabilityDecision {
  acc.notes.push(note);
  return baseDecision("NOT_APPLICABLE", true, rc, acc);
}

function reviewsDecision(
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
  note: string,
): ApplicabilityDecision {
  acc.notes.push(note);
  return {
    applicability: "REQUIRES_REVIEW",
    is_decision_final: false,
    rule_version: rc.rule.version,
    rule_effective_from: rc.rule.effective_from,
    rule_effective_until: rc.rule.effective_until,
    basis: {
      facts_used: acc.factsUsed,
      missing_facts: [],
      conflicts: acc.conflicts,
    },
    notes: note,
  };
}

function unknownDecision(
  rc: RuleContext,
  missing: string[],
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
  note: string,
): ApplicabilityDecision {
  acc.notes.push(note);
  return {
    applicability: "UNKNOWN",
    is_decision_final: false,
    rule_version: rc.rule.version,
    rule_effective_from: rc.rule.effective_from,
    rule_effective_until: rc.rule.effective_until,
    basis: {
      facts_used: acc.factsUsed,
      missing_facts: missing,
      conflicts: acc.conflicts,
    },
    notes: note,
  };
}

function baseDecision(
  applicability: "APPLICABLE" | "NOT_APPLICABLE",
  final: boolean,
  rc: RuleContext,
  acc: { notes: string[]; conflicts: string[]; factsUsed: Record<string, unknown> },
): ApplicabilityDecision {
  return {
    applicability,
    is_decision_final: final,
    rule_version: rc.rule.version,
    rule_effective_from: rc.rule.effective_from,
    rule_effective_until: rc.rule.effective_until,
    basis: {
      facts_used: acc.factsUsed,
      missing_facts: [],
      conflicts: acc.conflicts,
    },
    notes: acc.notes.join(" ") || null,
  };
}
