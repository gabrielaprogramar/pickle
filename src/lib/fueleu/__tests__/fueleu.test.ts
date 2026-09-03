import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { computeFuelEuEnergy } from "@/lib/fueleu/energy";
import { computeFuelEuEmissions } from "@/lib/fueleu/emissions";
import { evaluateFuelEuCompliance, type FuelEuComplianceInput } from "@/lib/fueleu/compliance";
import { estimateFuelEuPenalty, buildPenaltyResult } from "@/lib/fueleu/penalty";
import { computePoolableBalance, resolvePoolingPosition, buildPoolSnapshot } from "@/lib/fueleu/pooling";
import { getLhv, getWtwFactor, CURRENT_PARAMETER_VERSION } from "@/lib/fueleu/parameters";
import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { VesselPoolingPosition } from "@/lib/fueleu/types";

function makeConsumption(overrides: Partial<VoyageConsumptionRow> = {}): VoyageConsumptionRow {
  return {
    id: overrides.id ?? "vc-001",
    vessel_id: overrides.vessel_id ?? "vessel-uuid-001",
    voyage_id: overrides.voyage_id ?? "voy-001",
    reporting_year: overrides.reporting_year ?? 2026,
    fuel_type: overrides.fuel_type ?? "vlsfo_rme180",
    quantity_mt: overrides.quantity_mt ?? 100,
    method: overrides.method ?? "BDN",
    confidence: overrides.confidence ?? "high",
    status: overrides.status ?? "APPROVED",
    source_type: overrides.source_type ?? "bdn",
    source_record_ids: overrides.source_record_ids ?? [],
    attribution_method: overrides.attribution_method ?? "BDN_EVIDENCED",
    traceability: overrides.traceability ?? {},
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
  };
}

const BASE_RULES = {
  baseline_gco2e_per_mj: 91.16,
  target_gco2e_per_mj: 89.34,
  target_source: "regulatory_rules.fueleu_target v1",
  reduction_pct: 0.02,
  penalty_eur_per_tonne_vlsfoe: 2400,
  penalty_formula_version: "fueleu_penalty v1",
};

function complianceInput(partial: Partial<FuelEuComplianceInput> = {}): FuelEuComplianceInput {
  return {
    vesselProfile: { gt: 15000, flag: "NL", vesselType: "cargo" },
    applicability: { status: "APPLICABLE", is_decision_final: true },
    consumption: [makeConsumption()],
    voyages: [
      {
        voyage_id: "voy-001",
        departure_port: "Rotterdam",
        arrival_port: "Hamburg",
        scope_factor: 1,
        scope_type: "INTRA_EU",
        unknown_ports: [],
      },
    ],
    rules: { ...BASE_RULES },
    ops_energy_mj: 0,
    ops_data_available: false,
    biofuel_certification: [],
    penalty_assessed_eur: null,
    banking_requested: false,
    borrowing_requested: false,
    pooling_requested: false,
    pool_snapshot: [],
    ...partial,
  } as FuelEuComplianceInput;
}

// ── Energy (canonical voyage_consumption, NOT fuel_deliveries) ─────────────

describe("energy (fuelEU/energy)", () => {
  it("computes energy from canonical consumption using versioned LHV", () => {
    const res = computeFuelEuEnergy([makeConsumption({ fuel_type: "vlsfo_rme180", quantity_mt: 100 })]);
    expect(res.total_energy_mj).toBe(100 * 1000 * 40.5);
    expect(res.unresolved_fuel_types).toEqual([]);
  });

  it("splits biofuel vs fossil energy", () => {
    const res = computeFuelEuEnergy([
      makeConsumption({ voyage_id: "v1", fuel_type: "bio_mgo", quantity_mt: 50 }),
      makeConsumption({ voyage_id: "v2", fuel_type: "mgo_dma", quantity_mt: 50 }),
    ]);
    expect(res.biofuel_energy_mj).toBeGreaterThan(0);
    expect(res.fossil_energy_mj).toBeGreaterThan(0);
  });

  it("surfaces unknown fuel types as unresolved (zero energy)", () => {
    const res = computeFuelEuEnergy([makeConsumption({ fuel_type: "not_a_fuel", quantity_mt: 100 })]);
    expect(res.unresolved_fuel_types).toEqual(["not_a_fuel"]);
    expect(res.total_energy_mj).toBe(0);
    expect(res.contributions[0]?.energy_mj).toBe(0);
  });
});

// ── Emissions ──────────────────────────────────────────────────────────────

describe("emissions (fuelEU/emissions)", () => {
  it("computes WtW emissions from energy", () => {
    const energy = computeFuelEuEnergy([makeConsumption()]);
    const res = computeFuelEuEmissions(energy.contributions);
    const factor = getWtwFactor("vlsfo_rme180");
    expect(res.total_wtw_emissions_gco2e).toBe(energy.total_energy_mj * (factor?.wtw_gco2e_per_mj ?? 0));
  });
});

// ── Compliance engine ──────────────────────────────────────────────────────

describe("compliance (fuelEU/compliance)", () => {
  it("NOT_APPLICABLE when applicability is final non-applicable", () => {
    const res = evaluateFuelEuCompliance(
      complianceInput({ applicability: { status: "NOT_APPLICABLE", is_decision_final: true } }),
    );
    expect(res.compliance_status).toBe("NOT_APPLICABLE");
    expect(res.is_scope_resolved).toBe(true);
    expect(res.scope_applicable).toBe(false);
    expect(res.energy_input_mj).toBeNull();
  });

  it("UNKNOWN when applicability is unresolved (no rule)", () => {
    const res = evaluateFuelEuCompliance(complianceInput({ applicability: null }));
    expect(res.compliance_status).toBe("UNKNOWN");
    expect(res.is_scope_resolved).toBe(false);
  });

  it("APPLICABLE + surplus computes intensity, target and positive balance", () => {
    const res = evaluateFuelEuCompliance(complianceInput());
    expect(res.compliance_status).toBe("SURPLUS");
    expect(res.ghg_intensity_gco2e_per_mj).toBeGreaterThan(0);
    expect(res.target_gco2e_per_mj).toBe(89.34);
    expect(res.compliance_balance).toBeGreaterThan(0);
    expect(res.surplus_or_deficit).toBe("surplus");
  });

  it("high-intensity in deficit → DEFICIT + penalty estimate + issue", () => {
    // A tight target (2035, 15% → 77.49) below fossil intensity (HFO 87.5)
    // produces a real deficit on an in-scope intra-EU voyage.
    const res = evaluateFuelEuCompliance(
      complianceInput({
        rules: { ...BASE_RULES, target_gco2e_per_mj: 77.49, reduction_pct: 0.15 },
      }),
    );
    expect(res.compliance_status).toBe("DEFICIT");
    expect(res.surplus_or_deficit).toBe("deficit");
    expect(res.penalty_exposure_estimate).toBeGreaterThan(0);
    expect(res.penalty_is_estimate).toBe(true);
  });

  it("MISSING_CONSUMPTION → DATA_INCOMPLETE, nothing fabricated", () => {
    const res = evaluateFuelEuCompliance(
      complianceInput({ consumption: [], voyages: [
        { voyage_id: "voy-001", departure_port: "Rotterdam", arrival_port: "Hamburg", scope_factor: 1, scope_type: "INTRA_EU", unknown_ports: [] },
      ] }),
    );
    expect(res.compliance_status).toBe("DATA_INCOMPLETE");
    expect(res.energy_input_mj).toBeNull();
    expect(res.exceptions.some((e) => e.code === "MISSING_CONSUMPTION")).toBe(true);
  });

  it("UNKNOWN voyage scope → scope unresolved, energy not counted", () => {
    const res = evaluateFuelEuCompliance(
      complianceInput({ voyages: [
        { voyage_id: "voy-001", departure_port: "WeirdPort", arrival_port: "OtherPort", scope_factor: null, scope_type: "UNKNOWN", unknown_ports: ["WeirdPort", "OtherPort"] },
      ] }),
    );
    expect(res.compliance_status).toBe("DATA_INCOMPLETE");
    expect(res.exceptions.some((e) => e.code === "UNRESOLVED_PORT")).toBe(true);
  });

  it("missing/expired biofuel certification → REQUIRES_REVIEW exception", () => {
    const res = evaluateFuelEuCompliance(
      complianceInput({
        consumption: [makeConsumption({ fuel_type: "bio_mgo", quantity_mt: 50 })],
        biofuel_certification: [
          { fuel_type: "bio_mgo", voyage_id: null, certificate_status: "MISSING", detail: "No ISCC certificate." },
        ],
      }),
    );
    expect(res.iscc_missing.length).toBe(1);
    expect(res.exceptions.some((e) => e.code === "BIOFUEL_CERTIFICATION_MISSING")).toBe(true);
  });

  it("pooling requested without verified pool surplus → POOLING_REQUIRES_REVIEW", () => {
    const res = evaluateFuelEuCompliance(
      complianceInput({
        rules: { ...BASE_RULES, target_gco2e_per_mj: 77.49, reduction_pct: 0.15 },
        pooling_requested: true,
        pool_snapshot: [],
      }),
    );
    expect(res.compliance_status).toBe("POOLING_REQUIRES_REVIEW");
    expect(res.pooling.status).toBe("POOLING_REQUIRES_REVIEW");
  });
});

// ── Penalty ────────────────────────────────────────────────────────────────

describe("penalty (fuelEU/penalty)", () => {
  it("estimates penalty in EUR per tonne VLSFOe", () => {
    const est = estimateFuelEuPenalty({ deficit_gco2e_per_mj: 5, total_energy_mj: 10_000_000, penalty_eur_per_tonne_vlsfoe: 2400 });
    expect(est).toBeGreaterThan(0);
  });

  it("returns null when no penalty rule", () => {
    const est = estimateFuelEuPenalty({ deficit_gco2e_per_mj: 5, total_energy_mj: 10_000_000, penalty_eur_per_tonne_vlsfoe: null });
    expect(est).toBeNull();
  });

  it("buildPenaltyResult marks formally assessed figures as not an estimate", () => {
    const est = buildPenaltyResult(
      { deficit_gco2e_per_mj: 5, total_energy_mj: 10_000_000, penalty_eur_per_tonne_vlsfoe: 2400 },
      12345.67,
    );
    expect(est.is_estimate).toBe(false);
    expect(est.penalty_exposure_estimate_eur).toBe(12345.67);
  });
});

// ── Pooling ────────────────────────────────────────────────────────────────

describe("pooling (fuelEU/pooling)", () => {
  it("only surplus vessels contribute poolable balance", () => {
    const vessel: VesselPoolingPosition = {
      vessel_id: "v1", vessel_name: "A", imo: "1000001", reporting_year: 2026,
      total_energy_mj: 1000, actual_intensity: 80, target_intensity: 89.34,
      compliance_balance: 9.34, surplus_or_deficit: "surplus", poolable_balance: 0,
      penalty_exposure_estimate: null,
    };
    const res = resolvePoolingPosition(vessel);
    expect(res.poolable).toBe(true);
    expect(res.poolable_balance).toBe(9.34);
  });

  it("deficit vessels are not poolable", () => {
    const vessel: VesselPoolingPosition = {
      vessel_id: "v1", vessel_name: "A", imo: "1000001", reporting_year: 2026,
      total_energy_mj: 1000, actual_intensity: 95, target_intensity: 89.34,
      compliance_balance: -5.66, surplus_or_deficit: "deficit", poolable_balance: 0,
      penalty_exposure_estimate: null,
    };
    expect(resolvePoolingPosition(vessel).poolable).toBe(false);
  });

  it("buildPoolSnapshot excludes unresolved balances", () => {
    const snapshot = buildPoolSnapshot([
      { vessel_id: "v1", vessel_name: "A", imo: "1000001", reporting_year: 2026, total_energy_mj: 1, actual_intensity: 1, target_intensity: 2, compliance_balance: 5, surplus_or_deficit: "surplus", poolable_balance: 0, penalty_exposure_estimate: null },
      { vessel_id: "v2", vessel_name: "B", imo: "1000002", reporting_year: 2026, total_energy_mj: 1, actual_intensity: 1, target_intensity: 2, compliance_balance: null, surplus_or_deficit: null, poolable_balance: 0, penalty_exposure_estimate: null },
    ]);
    expect(snapshot.length).toBe(1);
    expect(snapshot[0]?.vessel_id).toBe("v1");
  });
});

// ── Parameters ─────────────────────────────────────────────────────────────

describe("parameters (fuelEU/parameters)", () => {
  it("provides a versioned parameter tag", () => {
    expect(typeof CURRENT_PARAMETER_VERSION).toBe("string");
  });
  it("registers LHV for hfo and marks WtW factors as regulatory", () => {
    const lhv = getLhv("hfo_rme180");
    expect(lhv?.lhv_mj_per_kg).toBe(40.5);
    const wtw = getWtwFactor("hfo_rme180");
    expect(wtw?.requires_regulatory_verification).toBe(true);
  });
});

run();
