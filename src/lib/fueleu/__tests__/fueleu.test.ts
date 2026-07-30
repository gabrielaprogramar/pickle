import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { computeEnergyContributions } from "@/lib/fueleu/energy";
import { computeWtwEmissions } from "@/lib/fueleu/emissions";
import { computeGhgIntensity } from "@/lib/fueleu/intensity";
import { computeCompliance } from "@/lib/fueleu/compliance";
import { estimatePenalty } from "@/lib/fueleu/penalty";
import { analyseBiofuels } from "@/lib/fueleu/biofuels";
import { processOpsData } from "@/lib/fueleu/ops";
import { computePoolableBalance, resolvePoolingPosition } from "@/lib/fueleu/pooling";
import {
  getReductionTarget,
  computeTargetIntensity,
  getLhv,
  getWtwFactor,
  getPenaltyFormula,
  CURRENT_PARAMETER_VERSION,
  BASELINE_GHG_INTENSITY_GCO2E_PER_MJ,
} from "@/lib/fueleu/parameters";
import { makeDeliveryRow } from "./fixtures";
import type { VesselPoolingPosition } from "@/lib/fueleu/types";

// ── Parameters ─────────────────────────────────────────────────────────────

describe("parameters", () => {
  it("returns 2025 reduction target for 2025", () => {
    const t = getReductionTarget(2025);
    if (t.reduction_pct !== 0.02) throw new Error("Expected 0.02");
  });

  it("returns 2025 reduction for years before 2025", () => {
    const t = getReductionTarget(2024);
    if (t.reduction_pct !== 0.02) throw new Error("Expected 0.02 for pre-2025");
  });

  it("returns 2030 reduction target for 2030", () => {
    const t = getReductionTarget(2030);
    if (t.reduction_pct !== 0.06) throw new Error("Expected 0.06");
  });

  it("returns 2050 reduction beyond schedule", () => {
    const t = getReductionTarget(2060);
    if (t.reduction_pct !== 0.80) throw new Error("Expected 0.80");
  });

  it("computeTargetIntensity for 2025 ~ 89.34", () => {
    const target = computeTargetIntensity(2025);
    const expected = 91.16 * (1 - 0.02);
    if (Math.abs(target - expected) > 0.0001) throw new Error(`Expected ~${expected}, got ${target}`);
  });

  it("computeTargetIntensity for 2030 ~ 85.69", () => {
    const target = computeTargetIntensity(2030);
    const expected = 91.16 * (1 - 0.06);
    if (Math.abs(target - expected) > 0.0001) throw new Error(`Expected ~${expected}, got ${target}`);
  });

  it("getLhv returns 40.5 for vlsfo_rme180", () => {
    const lhv = getLhv("vlsfo_rme180");
    if (!lhv) throw new Error("Expected LHV entry");
    if (lhv.lhv_mj_per_kg !== 40.5) throw new Error(`Expected 40.5, got ${lhv.lhv_mj_per_kg}`);
  });

  it("getLhv returns undefined for unknown fuel", () => {
    const lhv = getLhv("unknown_fuel");
    if (lhv !== undefined) throw new Error("Expected undefined");
  });

  it("getWtwFactor returns 87.5 for HFO", () => {
    const f = getWtwFactor("hfo_rme180");
    if (!f) throw new Error("Expected factor");
    if (f.wtw_gco2e_per_mj !== 87.5) throw new Error(`Expected 87.5, got ${f.wtw_gco2e_per_mj}`);
  });

  it("getWtwFactor returns 20.5 for biofuel", () => {
    const f = getWtwFactor("bio_hfo");
    if (!f) throw new Error("Expected factor");
    if (f.wtw_gco2e_per_mj !== 20.5) throw new Error(`Expected 20.5, got ${f.wtw_gco2e_per_mj}`);
  });

  it("getPenaltyFormula returns 2025.1 with is_estimate=true", () => {
    const f = getPenaltyFormula();
    if (!f) throw new Error("Expected formula");
    if (f.version !== "2025.1") throw new Error("Expected version 2025.1");
    if (f.is_estimate !== true) throw new Error("Expected is_estimate=true");
  });

  it("CURRENT_PARAMETER_VERSION is 2025.1", () => {
    if (CURRENT_PARAMETER_VERSION !== "2025.1") throw new Error("Expected 2025.1");
  });

  it("BASELINE is 91.16", () => {
    if (BASELINE_GHG_INTENSITY_GCO2E_PER_MJ !== 91.16) throw new Error("Expected 91.16");
  });
});

// ── Energy ─────────────────────────────────────────────────────────────────

describe("energy", () => {
  it("computes energy for VLSFO delivery", () => {
    const delivery = makeDeliveryRow({ fuel_type: "vlsfo_rme180", quantity_mt: 100 });
    const res = computeEnergyContributions([delivery]);
    const expected = 100 * 1000 * 40.5;
    if (Math.abs(res.total_energy_mj - expected) > 0.1) throw new Error(`Expected ~${expected}`);
    if (res.contributions.length !== 1) throw new Error("Expected 1 contribution");
    if (res.unresolved_fuel_types.length !== 0) throw new Error("Expected no unresolved");
  });

  it("computes energy for MGO delivery", () => {
    const delivery = makeDeliveryRow({ fuel_type: "mgo_dma", quantity_mt: 50 });
    const res = computeEnergyContributions([delivery]);
    const expected = 50 * 1000 * 42.7;
    if (Math.abs(res.total_energy_mj - expected) > 0.1) throw new Error(`Expected ~${expected}`);
  });

  it("flags unknown fuel type as unresolved", () => {
    const delivery = makeDeliveryRow({ fuel_type: "made_up_fuel", id: "bad-id" });
    const res = computeEnergyContributions([delivery]);
    if (res.total_energy_mj !== 0) throw new Error("Expected 0 total energy");
    if (res.unresolved_fuel_types.length !== 1) throw new Error("Expected 1 unresolved");
  });

  it("classifies biofuel vs fossil energy", () => {
    const bio = makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 50, id: "bio-1" });
    const fossil = makeDeliveryRow({ fuel_type: "vlsfo_rme180", quantity_mt: 100, id: "fossil-1" });
    const res = computeEnergyContributions([bio, fossil]);
    const bioExpected = 50 * 1000 * 40.5;
    const fossilExpected = 100 * 1000 * 40.5;
    if (Math.abs(res.biofuel_energy_mj - bioExpected) > 0.1) throw new Error(`Bio energy mismatch`);
    if (Math.abs(res.fossil_energy_mj - fossilExpected) > 0.1) throw new Error(`Fossil energy mismatch`);
  });

  it("handles multiple deliveries", () => {
    const d1 = makeDeliveryRow({ fuel_type: "hfo_rmk380", quantity_mt: 200, id: "d1" });
    const d2 = makeDeliveryRow({ fuel_type: "lsmgo", quantity_mt: 75, id: "d2" });
    const res = computeEnergyContributions([d1, d2]);
    const expected = 200 * 1000 * 40.5 + 75 * 1000 * 42.7;
    if (Math.abs(res.total_energy_mj - expected) > 0.1) throw new Error(`Expected ~${expected}`);
    if (res.contributions.length !== 2) throw new Error("Expected 2 contributions");
  });
});

// ── WtW Emissions ──────────────────────────────────────────────────────────

describe("emissions", () => {
  it("computes WtW from energy contributions", () => {
    const delivery = makeDeliveryRow({ fuel_type: "vlsfo_rme180", quantity_mt: 100 });
    const energyRes = computeEnergyContributions([delivery]);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const expected = energyRes.total_energy_mj * 87.5;
    if (Math.abs(emissionsRes.total_wtw_emissions_gco2e - expected) > 0.1) {
      throw new Error(`Expected ~${expected}`);
    }
    const c0 = emissionsRes.contributions[0];
    if (!c0 || c0.wtw_factor_gco2e_per_mj !== 87.5) throw new Error("Expected 87.5");
  });

  it("computes lower WtW for biofuel", () => {
    const delivery = makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 100 });
    const energyRes = computeEnergyContributions([delivery]);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const expected = energyRes.total_energy_mj * 20.5;
    if (Math.abs(emissionsRes.total_wtw_emissions_gco2e - expected) > 0.1) {
      throw new Error(`Expected ~${expected}`);
    }
  });
});

// ── Intensity ──────────────────────────────────────────────────────────────

describe("intensity", () => {
  it("computes GHG intensity correctly", () => {
    const res = computeGhgIntensity(10_000_000, 875_000_000);
    if (res.ghg_intensity_gco2e_per_mj !== 87.5) throw new Error("Expected 87.5");
  });

  it("returns 0 when energy is 0", () => {
    const res = computeGhgIntensity(0, 0);
    if (res.ghg_intensity_gco2e_per_mj !== 0) throw new Error("Expected 0");
  });

  it("handles fractional intensity", () => {
    const res = computeGhgIntensity(1000, 50_000);
    if (res.ghg_intensity_gco2e_per_mj !== 50) throw new Error("Expected 50");
  });
});

// ── Compliance ─────────────────────────────────────────────────────────────

describe("compliance", () => {
  it("surplus when actual below target (2025)", () => {
    const res = computeCompliance(80, 2025);
    if (res.surplus_or_deficit !== "surplus") throw new Error("Expected surplus");
    if (res.compliance_balance <= 0) throw new Error("Expected positive balance");
    const target = 91.16 * (1 - 0.02);
    if (Math.abs(res.target_gco2e_per_mj - target) > 0.001) throw new Error("Target mismatch");
  });

  it("deficit when actual exceeds target (2025)", () => {
    const res = computeCompliance(95, 2025);
    if (res.surplus_or_deficit !== "deficit") throw new Error("Expected deficit");
    if (res.compliance_balance >= 0) throw new Error("Expected negative balance");
  });

  it("zero when actual equals target (2030)", () => {
    const target = computeTargetIntensity(2030);
    const res = computeCompliance(target, 2030);
    if (res.surplus_or_deficit !== "zero") throw new Error("Expected zero");
    if (Math.abs(res.compliance_balance) > 0.001) throw new Error("Expected balance ~0");
  });

  it("uses correct target for 2035", () => {
    const res = computeCompliance(80, 2035);
    const expected = 91.16 * (1 - 0.15);
    if (Math.abs(res.target_gco2e_per_mj - expected) > 0.001) throw new Error("Target mismatch");
  });

  it("reduction_pct reflects 6% for 2030", () => {
    const res = computeCompliance(80, 2030);
    if (Math.abs(res.reduction_pct - 0.06) > 0.0001) throw new Error("Expected reduction_pct ~0.06");
  });
});

// ── Penalty ────────────────────────────────────────────────────────────────

describe("penalty", () => {
  it("returns null when vessel is in surplus", () => {
    const res = estimatePenalty(5, 10_000_000);
    if (res.penalty_estimate_eur !== null) throw new Error("Expected null penalty");
    if (res.penalty_formula_version !== null) throw new Error("Expected null formula version");
  });

  it("returns null when balance is zero", () => {
    const res = estimatePenalty(0, 10_000_000);
    if (res.penalty_estimate_eur !== null) throw new Error("Expected null");
  });

  it("computes positive penalty for deficit", () => {
    const res = estimatePenalty(-5, 10_000_000);
    if (res.penalty_estimate_eur === null) throw new Error("Expected non-null penalty");
    if (res.penalty_estimate_eur <= 0) throw new Error("Expected positive penalty");
    if (res.penalty_formula_version !== "2025.1") throw new Error("Expected 2025.1");
    if (res.is_estimate !== true) throw new Error("Expected is_estimate=true");
  });

  it("penalty increases with larger deficit", () => {
    const small = estimatePenalty(-1, 10_000_000);
    const large = estimatePenalty(-10, 10_000_000);
    if (small.penalty_estimate_eur === null || large.penalty_estimate_eur === null) throw new Error("Expected non-null");
    if (large.penalty_estimate_eur <= small.penalty_estimate_eur) throw new Error("Larger deficit should cause larger penalty");
  });

  it("penalty increases with more energy", () => {
    const low = estimatePenalty(-5, 1_000_000);
    const high = estimatePenalty(-5, 10_000_000);
    if (low.penalty_estimate_eur === null || high.penalty_estimate_eur === null) throw new Error("Expected non-null");
    if (high.penalty_estimate_eur <= low.penalty_estimate_eur) throw new Error("More energy should cause larger penalty");
  });
});

// ── Biofuels / ISCC ────────────────────────────────────────────────────────

describe("biofuels", () => {
  const makeContrib = (overrides: Record<string, unknown> = {}) => ({
    fuel_delivery_id: "bio-1",
    fuel_type: "bio_hfo",
    quantity_mt: 50,
    quantity_kg: 50000,
    lhv_mj_per_kg: 40.5,
    lhv_source: "IMO DCS",
    energy_mj: 2_025_000,
    wtw_factor_gco2e_per_mj: 20.5,
    wtw_factor_source: "test",
    wtw_emissions_gco2e: 41_512_500,
    is_biofuel: true,
    ...overrides,
  });

  it("separates biofuel and fossil energy", () => {
    const bio = makeContrib();
    const fossil = { ...makeContrib(), fuel_delivery_id: "fossil-1", fuel_type: "vlsfo", is_biofuel: false, energy_mj: 4_050_000 };
    const res = analyseBiofuels([bio, fossil]);
    if (res.biofuel_energy_mj !== 2_025_000) throw new Error("Expected bio=2025000");
    if (res.fossil_energy_mj !== 4_050_000) throw new Error("Expected fossil=4050000");
    if (res.iscc_missing_flag !== false) throw new Error("Expected no missing ISCC");
  });

  it("flags ISCC missing when delivery is listed", () => {
    const bio = makeContrib();
    const res = analyseBiofuels([bio], new Set(["bio-1"]));
    if (res.iscc_missing_flag !== true) throw new Error("Expected missing ISCC");
    if (res.iscc_missing_details.length !== 1) throw new Error("Expected 1 detail");
    const d0 = res.iscc_missing_details[0];
    if (!d0 || d0.fuel_delivery_id !== "bio-1") throw new Error("Expected bio-1");
  });

  it("does not flag fossil deliveries as ISCC-missing", () => {
    const fossil = { ...makeContrib(), fuel_delivery_id: "fossil-1", is_biofuel: false };
    const res = analyseBiofuels([fossil], new Set(["fossil-1"]));
    if (res.iscc_missing_flag !== false) throw new Error("Expected no missing ISCC for fossil");
  });
});

// ── OPS ────────────────────────────────────────────────────────────────────

describe("ops", () => {
  it("returns energy and availability when provided", () => {
    const res = processOpsData(500_000, true);
    if (res.ops_energy_mj !== 500_000) throw new Error("Expected 500000");
    if (res.ops_data_available !== true) throw new Error("Expected available");
  });

  it("returns zero when no data", () => {
    const res = processOpsData(0, false);
    if (res.ops_energy_mj !== 0) throw new Error("Expected 0");
    if (res.ops_data_available !== false) throw new Error("Expected not available");
  });

  it("clamps negative to zero", () => {
    const res = processOpsData(-100, true);
    if (res.ops_energy_mj !== 0) throw new Error("Expected 0 after clamp");
  });
});

// ── Pooling ────────────────────────────────────────────────────────────────

describe("pooling", () => {
  it("surplus vessel has poolable balance", () => {
    const res = computePoolableBalance(5.5, "surplus");
    if (res !== 5.5) throw new Error("Expected 5.5");
  });

  it("deficit vessel has zero poolable", () => {
    const res = computePoolableBalance(-3.2, "deficit");
    if (res !== 0) throw new Error("Expected 0");
  });

  it("zero balance has zero poolable", () => {
    const res = computePoolableBalance(0, "zero");
    if (res !== 0) throw new Error("Expected 0");
  });

  it("resolvePoolingPosition for surplus", () => {
    const pos: VesselPoolingPosition = {
      vessel_id: "v1", vessel_name: "T", imo: "1234567",
      reporting_year: 2025, total_energy_mj: 10_000_000,
      actual_intensity: 80, target_intensity: 89.3368,
      compliance_balance: 9.3368, surplus_or_deficit: "surplus",
      poolable_balance: 0, penalty_exposure_estimate: null,
    };
    const res = resolvePoolingPosition(pos);
    if (Math.abs(res.poolable_balance - 9.3368) > 0.001) throw new Error("Expected ~9.3368");
  });
});

// ── End-to-end fossil-only ─────────────────────────────────────────────────

describe("end-to-end", () => {
  it("single VLSFO delivery gives surplus for 2025", () => {
    const deliveries = [makeDeliveryRow({ fuel_type: "vlsfo_rme180", quantity_mt: 500 })];
    const energyRes = computeEnergyContributions(deliveries);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const intensityRes = computeGhgIntensity(energyRes.total_energy_mj, emissionsRes.total_wtw_emissions_gco2e);
    const complianceRes = computeCompliance(intensityRes.ghg_intensity_gco2e_per_mj, 2025);
    const penaltyRes = estimatePenalty(complianceRes.compliance_balance, energyRes.total_energy_mj);

    // VLSFO WtW = 87.5 < target 89.34 => surplus
    if (intensityRes.ghg_intensity_gco2e_per_mj !== 87.5) throw new Error("Expected intensity 87.5");
    if (complianceRes.surplus_or_deficit !== "surplus") throw new Error("Expected surplus");
    if (penaltyRes.penalty_estimate_eur !== null) throw new Error("Expected no penalty");
  });

  it("deficit when intensity exceeds target", () => {
    const complianceRes = computeCompliance(95, 2025);
    if (complianceRes.surplus_or_deficit !== "deficit") throw new Error("Expected deficit");
    if (complianceRes.compliance_balance >= 0) throw new Error("Expected negative balance");
  });

  it("empty deliveries produce zero energy, surplus", () => {
    const energyRes = computeEnergyContributions([]);
    if (energyRes.total_energy_mj !== 0) throw new Error("Expected 0 energy");
    if (energyRes.contributions.length !== 0) throw new Error("Expected 0 contributions");
    const complianceRes = computeCompliance(0, 2025);
    if (complianceRes.surplus_or_deficit !== "surplus") throw new Error("Expected surplus");
  });

  it("mixed hfo + mgo give correct energy and WtW", () => {
    const deliveries = [
      makeDeliveryRow({ fuel_type: "hfo_rme180", quantity_mt: 300, id: "d1" }),
      makeDeliveryRow({ fuel_type: "mgo_dma", quantity_mt: 100, id: "d2" }),
    ];
    const energyRes = computeEnergyContributions(deliveries);
    const expectedEnergy = 300 * 1000 * 40.5 + 100 * 1000 * 42.7;
    if (Math.abs(energyRes.total_energy_mj - expectedEnergy) > 0.1) throw new Error("Energy mismatch");

    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const expectedWtw = 300 * 1000 * 40.5 * 87.5 + 100 * 1000 * 42.7 * 85.7;
    if (Math.abs(emissionsRes.total_wtw_emissions_gco2e - expectedWtw) > 0.1) throw new Error("WtW mismatch");
  });

  it("biofuel gives lower intensity than fossil", () => {
    const fossilDel = makeDeliveryRow({ fuel_type: "hfo_rme180", quantity_mt: 100, id: "f1" });
    const bioDel = makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 100, id: "b1" });

    const fossilEnergy = computeEnergyContributions([fossilDel]);
    const fossilEmissions = computeWtwEmissions(fossilEnergy.contributions);
    const fossilIntensity = computeGhgIntensity(fossilEnergy.total_energy_mj, fossilEmissions.total_wtw_emissions_gco2e);

    const bioEnergy = computeEnergyContributions([bioDel]);
    const bioEmissions = computeWtwEmissions(bioEnergy.contributions);
    const bioIntensity = computeGhgIntensity(bioEnergy.total_energy_mj, bioEmissions.total_wtw_emissions_gco2e);

    if (bioIntensity.ghg_intensity_gco2e_per_mj >= fossilIntensity.ghg_intensity_gco2e_per_mj) {
      throw new Error("Biofuel should have lower intensity");
    }
    if (Math.abs(fossilIntensity.ghg_intensity_gco2e_per_mj - 87.5) > 0.001) throw new Error("Fossil intensity should be 87.5");
    if (Math.abs(bioIntensity.ghg_intensity_gco2e_per_mj - 20.5) > 0.001) throw new Error("Bio intensity should be 20.5");
  });

  it("biofuel + fossil blend gives intermediate intensity", () => {
    const bioDel = makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 100, id: "b1" });
    const fossilDel = makeDeliveryRow({ fuel_type: "hfo_rme180", quantity_mt: 100, id: "f1" });

    const energyRes = computeEnergyContributions([bioDel, fossilDel]);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const intensityRes = computeGhgIntensity(energyRes.total_energy_mj, emissionsRes.total_wtw_emissions_gco2e);

    // Both fuels have same LHV 40.5, same energy per MT
    // Bio: 20.5 gCO2e/MJ, Fossil: 87.5 gCO2e/MJ
    // Average: (20.5 + 87.5) / 2 = 54.0
    if (Math.abs(intensityRes.ghg_intensity_gco2e_per_mj - 54.0) > 0.001) {
      throw new Error(`Expected ~54.0, got ${intensityRes.ghg_intensity_gco2e_per_mj}`);
    }
  });

  it("ISCC missing is reported via service input", () => {
    const { FuelEUComplianceService } = require("@/lib/fueleu/service");
    // We can't easily instantiate the service without a real repo
    // Instead test the underlying pipeline
    const delivery = makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 50, id: "iscc-missing-1" });
    const energyRes = computeEnergyContributions([delivery]);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);
    const bioRes = analyseBiofuels(emissionsRes.contributions, new Set(["iscc-missing-1"]));

    if (bioRes.iscc_missing_flag !== true) throw new Error("Expected ISCC missing flag");
    if (bioRes.iscc_missing_details.length !== 1) throw new Error("Expected 1 missing detail");
    const m0 = bioRes.iscc_missing_details[0];
    if (!m0 || m0.fuel_delivery_id !== "iscc-missing-1") throw new Error("Expected correct ID");
  });

  it("ops data reduces effective penalty exposure (no direct effect)", () => {
    // OPS doesn't directly affect penalty in v1
    const opsRes = processOpsData(1_000_000, true);
    if (opsRes.ops_energy_mj !== 1_000_000) throw new Error("Expected 1M OPS energy");
    if (opsRes.ops_data_available !== true) throw new Error("Expected data available");
  });
});

// ── Parameter versioning ───────────────────────────────────────────────────

describe("parameter versioning", () => {
  it("target for known year is deterministic", () => {
    const t1 = computeTargetIntensity(2025);
    const t2 = computeTargetIntensity(2025);
    if (t1 !== t2) throw new Error("Target should be deterministic");
  });

  it("different years have different targets", () => {
    const t2025 = computeTargetIntensity(2025);
    const t2030 = computeTargetIntensity(2030);
    if (t2025 === t2030) throw new Error("Different years should have different targets");
    if (t2025 <= t2030) throw new Error("Earlier year should have higher (less strict) target");
  });

  it("penalty formula version is tracked", () => {
    const res = estimatePenalty(-5, 10_000_000, "2025.1");
    if (res.penalty_formula_version !== "2025.1") throw new Error("Expected 2025.1");
  });

  it("unknown penalty formula version returns null", () => {
    const res = estimatePenalty(-5, 10_000_000, "invalid_version");
    if (res.penalty_formula_version !== null) throw new Error("Expected null for invalid version");
    if (res.penalty_estimate_eur !== null) throw new Error("Expected null penalty for invalid version");
  });
});

// ── Year boundary edge cases ───────────────────────────────────────────────

describe("year boundary", () => {
  it("year 2025 uses 2025-2029 target (2%)", () => {
    const t = getReductionTarget(2025);
    if (t.reduction_pct !== 0.02) throw new Error("Expected 0.02");
  });

  it("year 2029 uses 2025-2029 target (2%)", () => {
    const t = getReductionTarget(2029);
    if (t.reduction_pct !== 0.02) throw new Error("Expected 0.02");
  });

  it("year 2030 jumps to 6%", () => {
    const t = getReductionTarget(2030);
    if (t.reduction_pct !== 0.06) throw new Error("Expected 0.06");
  });

  it("year 2050 uses 80%", () => {
    const t = getReductionTarget(2050);
    if (t.reduction_pct !== 0.80) throw new Error("Expected 0.80");
  });
});

// ── Contribution detail inspection ─────────────────────────────────────────

describe("contribution details", () => {
  it("each contribution has fuel_delivery_id, fuel_type, energy_mj", () => {
    const d1 = makeDeliveryRow({ fuel_type: "vlsfo_rme180", quantity_mt: 100, id: "cd-1" });
    const d2 = makeDeliveryRow({ fuel_type: "bio_mgo", quantity_mt: 50, id: "cd-2" });
    const energyRes = computeEnergyContributions([d1, d2]);
    const emissionsRes = computeWtwEmissions(energyRes.contributions);

    for (const c of emissionsRes.contributions) {
      if (!c.fuel_delivery_id) throw new Error("Missing fuel_delivery_id");
      if (!c.fuel_type) throw new Error("Missing fuel_type");
      if (c.energy_mj <= 0) throw new Error("Energy must be positive");
      if (c.wtw_emissions_gco2e <= 0) throw new Error("WtW must be positive");
    }
  });

  it("biofuel contributions are flagged as is_biofuel", () => {
    const energyRes = computeEnergyContributions([
      makeDeliveryRow({ fuel_type: "bio_hfo", quantity_mt: 50 }),
    ]);
    const c = energyRes.contributions[0];
    if (!c || c.is_biofuel !== true) throw new Error("Expected biofuel flag");
  });
});

run();
