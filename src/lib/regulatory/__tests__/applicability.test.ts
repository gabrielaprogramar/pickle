/**
 * regulatory/__tests__/applicability.test.ts — effective-date-aware regulatory
 * applicability, with UNKNOWN/REQUIRES_REVIEW first-class
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies that presence/absence of vessel facts and the effective-dated rule
 * store drive APPLICABLE/NOT_APPLICABLE/UNKNOWN/REQUIRES_REVIEW without
 * hardcoding thresholds in the engine and without guessing when data is missing.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  determineApplicability,
  ruleEffectiveOn,
} from "../applicability";
import type { VesselProfile } from "../types";
import type { RegulatoryRuleRow } from "@/lib/supabase/types";

function rule(overrides: Partial<RegulatoryRuleRow> = {}): RegulatoryRuleRow {
  return {
    id: "rule-1",
    regulation: "EU_ETS",
    rule_key: "ets_scope",
    version: 1,
    effective_from: "2024-01-01",
    effective_until: null,
    is_active: true,
    parameters: { applicable_gt_min: 5000 },
    rule_text: null,
    source_reference: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function profile(overrides: Partial<{
  gt: number | null;
  flag: string | null;
  vesselType: string | null;
  vesselCategory: string | null;
}> = {}): VesselProfile {
  return {
    vessel_id: "v1",
    imo: "9074729",
    gt: overrides.gt ?? null,
    flag: overrides.flag ?? null,
    vesselType: overrides.vesselType ?? null,
    vesselCategory: overrides.vesselCategory ?? null,
  };
}

function ctx(rule_: RegulatoryRuleRow | null, facts = profile()): {
  rule: RegulatoryRuleRow | null;
  facts: VesselProfile;
} {
  return { rule: rule_, facts };
}

describe("ruleEffectiveOn — effective-date selection", () => {
  const v1 = rule({ version: 1, effective_from: "2024-01-01", effective_until: "2024-12-31" });
  const v2 = rule({ version: 2, effective_from: "2025-01-01", effective_until: null });

  it("selects version 1 for a 2024 date", () => {
    expect(ruleEffectiveOn([v1, v2], "2024-06-01")?.version).toBe(1);
  });
  it("selects version 2 for a 2025 date", () => {
    expect(ruleEffectiveOn([v1, v2], "2025-06-01")?.version).toBe(2);
  });
  it("returns null when no version governs the date", () => {
    const v = rule({ version: 1, effective_from: "2030-01-01", effective_until: null });
    expect(ruleEffectiveOn([v], "2025-06-01")).toBeNull();
  });
});

describe("determineApplicability — EU_ETS", () => {
  it("APPLICABLE when GT >= threshold and all facts present", () => {
    const d = determineApplicability(ctx(rule(), profile({ gt: 8000, flag: "PAN", vesselType: "cargo" })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("APPLICABLE");
    expect(d.is_decision_final).toBe(true);
    expect(d.rule_version).toBe(1);
  });
  it("NOT_APPLICABLE when GT < threshold", () => {
    const d = determineApplicability(ctx(rule(), profile({ gt: 200 })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("NOT_APPLICABLE");
  });
  it("UNKNOWN when GT is missing — never assumed", () => {
    const d = determineApplicability(ctx(rule(), profile({ gt: null })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("UNKNOWN");
    expect(d.is_decision_final).toBe(false);
    expect(d.basis.missing_facts).toContain("gt");
  });
  it("REQUIRES_REVIEW when flag exemptions configured but flag unknown", () => {
    const r = rule({ parameters: { applicable_gt_min: 5000, flag_exemptions: ["PAN"] } });
    const d = determineApplicability(ctx(r, profile({ gt: 8000, flag: null })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("REQUIRES_REVIEW");
  });
  it("NOT_APPLICABLE when the vessel flag is exempt", () => {
    const r = rule({ parameters: { applicable_gt_min: 5000, flag_exemptions: ["PAN"] } });
    const d = determineApplicability(ctx(r, profile({ gt: 8000, flag: "PAN" })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("NOT_APPLICABLE");
  });
  it("REQUIRES_REVIEW when vessel-type exemptions configured but type unknown", () => {
    const r = rule({ parameters: { applicable_gt_min: 5000, vessel_type_exemptions: ["pleasure"] } });
    const d = determineApplicability(ctx(r, profile({ gt: 8000, vesselType: null })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("REQUIRES_REVIEW");
  });
  it("NOT_APPLICABLE when vessel type is exempt", () => {
    const r = rule({ parameters: { applicable_gt_min: 5000, vessel_type_exemptions: ["pleasure"] } });
    const d = determineApplicability(ctx(r, profile({ gt: 8000, vesselType: "pleasure" })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("NOT_APPLICABLE");
  });
});

describe("determineApplicability — FUEL_EU (previously had NO gate)", () => {
  it("APPLICABLE at GT >= threshold", () => {
    const r = rule({ regulation: "FUEL_EU", parameters: { applicable_gt_min: 5000 } });
    const d = determineApplicability(ctx(r, profile({ gt: 9000 })), "FUEL_EU", "2025-01-01");
    expect(d.applicability).toBe("APPLICABLE");
  });
  it("UNKNOWN when GT missing — the old engine silently assumed applicability", () => {
    const r = rule({ regulation: "FUEL_EU", parameters: { applicable_gt_min: 5000 } });
    const d = determineApplicability(ctx(r, profile({ gt: null })), "FUEL_EU", "2025-01-01");
    expect(d.applicability).toBe("UNKNOWN");
    expect(d.is_decision_final).toBe(false);
  });
  it("NOT_APPLICABLE below threshold", () => {
    const r = rule({ regulation: "FUEL_EU", parameters: { applicable_gt_min: 5000 } });
    const d = determineApplicability(ctx(r, profile({ gt: 300 })), "FUEL_EU", "2025-01-01");
    expect(d.applicability).toBe("NOT_APPLICABLE");
  });
});

describe("determineApplicability — EU_MRV", () => {
  it("APPLICABLE at GT >= threshold", () => {
    const r = rule({ regulation: "EU_MRV", parameters: { applicable_gt_min: 5000 } });
    const d = determineApplicability(ctx(r, profile({ gt: 6000 })), "EU_MRV", "2025-01-01");
    expect(d.applicability).toBe("APPLICABLE");
  });
  it("UNKNOWN when GT missing", () => {
    const r = rule({ regulation: "EU_MRV", parameters: { applicable_gt_min: 5000 } });
    const d = determineApplicability(ctx(r, profile({ gt: null })), "EU_MRV", "2025-01-01");
    expect(d.applicability).toBe("UNKNOWN");
  });
});

describe("determineApplicability — missing rule", () => {
  it("UNKNOWN when no effective rule governs", () => {
    const d = determineApplicability(ctx(null, profile({ gt: 8000 })), "EU_ETS", "2025-01-01");
    expect(d.applicability).toBe("UNKNOWN");
    expect(d.basis.missing_facts).toContain("effective_rule");
  });
});

run();
