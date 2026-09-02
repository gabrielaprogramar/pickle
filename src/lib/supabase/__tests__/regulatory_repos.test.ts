/**
 * regulatory_repos.test.ts — Part 1 regulatory repository tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Verifies persistence of regulatory rules, regulation applicability
 * determinations, and canonical voyage consumption through the in-memory fake
 * Supabase client (which handles any table generically).
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createRegulatoryRuleRepository } from "../repositories/regulatory_rules";
import { createRegulationApplicabilityRepository } from "../repositories/regulation_applicability";
import { createVoyageConsumptionRepository } from "../repositories/voyage_consumption";

const VESSEL_ID = "vessel-uuid-001";
const VOYAGE_ID = "voyage-uuid-001";

describe("RegulatoryRuleRepository — insert + findByKey", () => {
  it("inserts a rule and lists all versions for a key, newest first", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createRegulatoryRuleRepository({ client: fake });

    await repo.insert({
      regulation: "EU_ETS",
      rule_key: "ets_scope",
      version: 1,
      effective_from: "2024-01-01",
      parameters: { applicable_gt_min: 5000 },
    });
    await repo.insert({
      regulation: "EU_ETS",
      rule_key: "ets_scope",
      version: 2,
      effective_from: "2025-01-01",
      parameters: { applicable_gt_min: 400 },
    });

    const rules = await repo.findByKey("EU_ETS", "ets_scope");
    expect(rules.length).toBe(2);
    expect(rules[0]!.version).toBe(2); // newest first
    expect((rules[0]!.parameters as { applicable_gt_min?: number }).applicable_gt_min).toBe(400);
  });
});

describe("RegulationApplicabilityRepository — upsert on conflict key", () => {
  it("stores one determination per (vessel, regulation, year)", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createRegulationApplicabilityRepository({ client: fake });

    await repo.upsert({
      vessel_id: VESSEL_ID,
      regulation: "EU_ETS",
      reporting_year: 2025,
      applicability: "APPLICABLE",
      rule_version: 1,
      rule_effective_from: "2025-01-01",
    });

    const found = await repo.find(VESSEL_ID, "EU_ETS", 2025);
    expect(found?.applicability).toBe("APPLICABLE");
    expect(found?.is_decision_final).toBe(false);

    const all = await repo.listByVessel(VESSEL_ID, 2025);
    expect(all.length).toBe(1);
    expect(all[0]!.regulation).toBe("EU_ETS");
  });
});

describe("VoyageConsumptionRepository — upsert + lookup per (vessel, voyage, fuel)", () => {
  it("stores canonical per-voyage consumption and reads it back", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createVoyageConsumptionRepository({ client: fake });

    await repo.upsert({
      vessel_id: VESSEL_ID,
      voyage_id: VOYAGE_ID,
      reporting_year: 2025,
      fuel_type: "HFO",
      quantity_mt: 120,
      method: "ROB_DELTA",
      confidence: "MEDIUM",
      status: "VERIFIED",
      source_type: "fuel_robs",
      attribution_method: "ROB_DELTA",
    });

    const found = await repo.findByVoyageAndFuel(VESSEL_ID, VOYAGE_ID, "HFO");
    expect(found?.method).toBe("ROB_DELTA");
    expect(found?.quantity_mt).toBe(120);

    const year = await repo.listByVessel(VESSEL_ID, 2025);
    expect(year.length).toBe(1);
  });
});

run();
