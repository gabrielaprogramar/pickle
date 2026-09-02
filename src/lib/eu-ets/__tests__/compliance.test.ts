import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { EtsComplianceService } from "@/lib/eu-ets/service";
import { evaluateEtsCompliance } from "@/lib/eu-ets/compliance";
import type { ComplianceInput } from "@/lib/eu-ets/compliance";
import { classifyVoyagePortStatus } from "@/lib/eu-ets/port-classifier";
import {
  makeConsumptionRow,
  makeVoyageInput,
  makeDeliveryInput,
  VESSEL_ID,
} from "./fixtures";
import type { EuEtsRecordRow, EuEtsRecordInsert } from "@/lib/eu-ets/types";
import type { EuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";

const BASE_APPLICABLE = {
  vesselProfile: { gt: 15000, flag: "GR", vesselType: "cargo", vesselCategory: null },
  applicability: { status: "APPLICABLE" as const, is_decision_final: true },
  consumption: [],
  coverageRate: 1.0,
  price: { available: true, source: "test", value_eur: 75 },
  actualAllowanceTonnes: null,
};

function classify(dep: string, arr: string) {
  return classifyVoyagePortStatus(dep, arr);
}

function runCompliance(input: Partial<ComplianceInput>): ReturnType<typeof evaluateEtsCompliance> {
  return evaluateEtsCompliance({
    ...BASE_APPLICABLE,
    ...input,
  } as ComplianceInput);
}

// ── Applicability ───────────────────────────────────────────────────────────

describe("ETS applicability (Part 2)", () => {
  it("MISSING_APPLICABILITY when no determination is provided", () => {
    const r = runCompliance({ applicability: null });
    expect(r.compliance_status).toBe("UNKNOWN");
    expect(r.exceptions[0]?.code).toBe("MISSING_APPLICABILITY");
    expect(r.eua_obligation_tonnes).toBeNull();
  });

  it("NOT_APPLICABLE yields zero obligation and no fabricated figure", () => {
    const r = runCompliance({
      applicability: { status: "NOT_APPLICABLE", is_decision_final: true },
      consumption: [makeConsumptionRow({ voyage_id: "v1" })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    expect(r.compliance_status).toBe("NOT_APPLICABLE");
    expect(r.eua_obligation_tonnes).toBe(0);
    expect(r.covered_co2_tonnes).toBe(0);
  });

  it("REQUIRES_REVIEW is surfaced, not silently assumed", () => {
    const r = runCompliance({
      applicability: { status: "REQUIRES_REVIEW", is_decision_final: false },
    });
    expect(r.compliance_status).toBe("REQUIRES_REVIEW");
    expect(r.eua_obligation_tonnes).toBeNull();
    expect(r.exceptions.some((e) => e.code === "APPLICABILITY_UNRESOLVED")).toBe(true);
  });
});

// ── Voyage scope ────────────────────────────────────────────────────────────

describe("ETS voyage coverage (Part 2)", () => {
  it("classifies all four coverage types", () => {
    const cases: Array<[string, string, "INTRA_EU" | "EU_TO_THIRD" | "THIRD_TO_EU" | "NON_EU"]> = [
      ["Rotterdam", "Hamburg", "INTRA_EU"],
      ["Rotterdam", "Singapore", "EU_TO_THIRD"],
      ["Singapore", "Rotterdam", "THIRD_TO_EU"],
      ["Singapore", "Shanghai", "NON_EU"],
    ];
    for (const [dep, arr, expected] of cases) {
      const r = runCompliance({
        consumption: [makeConsumptionRow({ voyage_id: "v1" })],
        voyages: [{ voyage_id: "v1", departure_port: dep, arrival_port: arr, status: classify(dep, arr) }],
      });
      const vc = r.voyageCompliance[0];
      if (!vc) throw new Error("Expected a voyage compliance entry");
      expect(vc.coverage_type).toBe(expected);
      expect(vc.coverage_resolved).toBe(true);
    }
  });

  it("unresolved port blocks a precise covered figure", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1" })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "El Dorado", status: classify("Rotterdam", "El Dorado") }],
    });
    expect(r.voyageCompliance[0]?.coverage_resolved).toBe(false);
    expect(r.covered_co2_tonnes).toBeNull();
    expect(r.compliance_status).toBe("DATA_INCOMPLETE");
    expect(r.exceptions.some((e) => e.code === "UNRESOLVED_PORT")).toBe(true);
  });

  it("missing voyage ports raised explicitly", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1" })],
      voyages: [{ voyage_id: "v1", departure_port: "", arrival_port: "", status: classify("", "") }],
    });
    expect(r.exceptions.some((e) => e.code === "MISSING_VOYAGE_PORTS")).toBe(true);
  });

  it("never silently coerces an unresolved port to NON_EU", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1" })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "El Dorado", status: classify("Rotterdam", "El Dorado") }],
    });
    // It must NOT be counted as NON_EU (0%) producing a covered=0 that looks precise.
    expect(r.covered_co2_tonnes).toBeNull();
    expect(r.exceptions.some((e) => e.code === "UNRESOLVED_PORT")).toBe(true);
  });
});

// ── Consumption (no equal-share) ────────────────────────────────────────────

describe("ETS consumption (Part 2, no equal-share)", () => {
  it("computes per-voyage emissions from canonical consumption only", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    // hfo_380 co2 = 100 mt × 3.114 = 311.4 t
    expect(Math.abs(r.total_ttw_co2_tonnes - 311.4)).toBeLessThanOrEqual(0.01);
    expect(r.voyageCompliance[0]?.consumption_resolved).toBe(true);
  });

  it("MISSING_CONSUMPTION → UNKNOWN, never equal-share of deliveries", () => {
    const r = runCompliance({
      consumption: [],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    expect(r.exceptions.some((e) => e.code === "MISSING_CONSUMPTION")).toBe(true);
    expect(r.voyageCompliance[0]?.consumption_resolved).toBe(false);
    expect(r.covered_co2_tonnes).toBeNull();
    expect(r.compliance_status).toBe("DATA_INCOMPLETE");
  });

  it("INSUFFICIENT_DATA/BLOCKED consumption → BLOCKED exposure", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", method: "INSUFFICIENT_DATA", status: "BLOCKED" })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    expect(r.exceptions.some((e) => e.code === "INSUFFICIENT_CONSUMPTION")).toBe(true);
    expect(r.covered_co2_tonnes).toBeNull();
  });

  it("CONFLICT_DELTA/REVIEW consumption → REVIEW exposure", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", method: "CONFLICT_DELTA", status: "REVIEW" })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    expect(r.exceptions.some((e) => e.code === "CONFLICTING_CONSUMPTION")).toBe(true);
    expect(r.covered_co2_tonnes).toBeNull();
  });

  it("equal-share is impossible: a voyage never inherits another voyage's fuel", () => {
    // Two voyages, only one has canonical consumption. The other must NOT get
    // half the fuel.
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [
        { voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") },
        { voyage_id: "v2", departure_port: "Rotterdam", arrival_port: "Singapore", status: classify("Rotterdam", "Singapore") },
      ],
    });
    const v2 = r.voyageCompliance.find((v) => v.voyage_id === "v2");
    expect(v2?.consumption_resolved).toBe(false);
    expect(v2?.ttw_co2_tonnes).toBe(0);
    expect(r.covered_co2_tonnes).toBeNull(); // v2 unresolved → blocked
  });

  it("UNKNOWN_FUEL_TYPE is surfaced (not silently a MGO proxy)", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "nuclear_magic", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
    });
    expect(r.exceptions.some((e) => e.code === "UNKNOWN_FUEL_TYPE")).toBe(true);
    expect(r.voyageCompliance[0]?.consumption_resolved).toBe(false);
  });
});

// ── Emissions / EUA / price ─────────────────────────────────────────────────

describe("ETS EUA obligation (Part 2)", () => {
  it("applies coverage factor per voyage (INTRA_EU 100% + EU_TO_THIRD 50%)", () => {
    const r = runCompliance({
      consumption: [
        makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 }),
        makeConsumptionRow({ voyage_id: "v2", fuel_type: "hfo_380", quantity_mt: 100 }),
      ],
      voyages: [
        { voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") },
        { voyage_id: "v2", departure_port: "Rotterdam", arrival_port: "Singapore", status: classify("Rotterdam", "Singapore") },
      ],
      coverageRate: 1.0,
    });
    // covered = 311.4×1.0 + 311.4×0.5 = 467.1
    expect(Math.abs((r.covered_co2_tonnes ?? 0) - 467.1)).toBeLessThanOrEqual(0.05);
    // obligation = covered × 100% = 467.1
    expect(Math.abs((r.eua_obligation_tonnes ?? 0) - 467.1)).toBeLessThanOrEqual(0.05);
  });

  it("2024 phase-in 40% applies to covered CO2", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
      coverageRate: 0.40,
    });
    expect(Math.abs((r.eua_obligation_tonnes ?? 0) - 311.4 * 0.4)).toBeLessThanOrEqual(0.01);
  });

  it("PRICE_UNAVAILABLE surfaces instead of a fabricated price", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
      price: { available: false, source: "mock:unavailable", value_eur: null },
    });
    expect(r.exceptions.some((e) => e.code === "PRICE_UNAVAILABLE")).toBe(true);
    expect(r.estimated_cost_eur).toBeNull();
  });

  it("estimated monetary exposure uses obligation × price", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
      coverageRate: 1.0,
      price: { available: true, source: "test", value_eur: 75 },
    });
    expect(Math.abs((r.estimated_cost_eur ?? 0) - 311.4 * 75)).toBeLessThanOrEqual(1);
  });
});

// ── Allowance ───────────────────────────────────────────────────────────────

describe("ETS allowance (Part 2)", () => {
  it("CALCULATED obligation is not presented as an actual balance", () => {
    const r = runCompliance({
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
      actualAllowanceTonnes: null,
    });
    expect(r.allowance.source).toBe("CALCULATED");
    expect(r.allowance.actual_balance_tonnes).toBeNull();
    expect(r.exceptions.some((e) => e.code === "ALLOWANCE_INCOMPLETE")).toBe(true);
  });

  it("authoritative balance drives COMPLIANT/NON_COMPLIANT", () => {
    expect(
      runCompliance({
        consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
        voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
        actualAllowanceTonnes: 500,
      }).compliance_status,
    ).toBe("COMPLIANT");

    expect(
      runCompliance({
        consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
        voyages: [{ voyage_id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", status: classify("Rotterdam", "Hamburg") }],
        actualAllowanceTonnes: 100,
      }).compliance_status,
    ).toBe("NON_COMPLIANT");
  });
});

// ── Service integration ─────────────────────────────────────────────────────

describe("ETS service integration (Part 2)", () => {
  it("never claims COMPLIANT merely because an obligation was calculated", async () => {
    const service = new EtsComplianceService(createFakeEuEtsRepo());
    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      vessel_profile: { flag: "GR", vessel_type: "cargo", vessel_category: null },
      applicability: { status: "APPLICABLE", is_decision_final: true },
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      deliveries: [makeDeliveryInput()],
      voyages: [makeVoyageInput({ id: "v1" })],
    });
    // With no authoritative allowance balance, the verdict is CALCULATED, not COMPLIANT.
    expect(result.compliance_status).toBe("CALCULATED");
    expect(result.eua_obligation_tonnes).toBeGreaterThan(0);
  });

  it("records audit-friendly details including compliance status", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);
    const result = await service.calculateAndSave({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      vessel_profile: { flag: "GR", vessel_type: "cargo", vessel_category: null },
      applicability: { status: "APPLICABLE", is_decision_final: true },
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      deliveries: [makeDeliveryInput()],
      voyages: [makeVoyageInput({ id: "v1" })],
    });
    const saved = await repo.findByVesselAndYear(VESSEL_ID, 2026);
    expect(saved?.calculation_details).toBeTruthy();
    const details = saved?.calculation_details as { compliance?: { status?: string } };
    expect(details.compliance?.status).toBe(result.compliance_status);
  });

  it("resolves applicability from the effective EU_ETS rule (effective-date aware)", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo, {
      effectiveEtsRule: {
        id: "rule-ets-v2",
        regulation: "EU_ETS",
        rule_key: "ets_scope",
        version: 2,
        effective_from: "2026-01-01",
        effective_until: null,
        is_active: true,
        parameters: { applicable_gt_min: 5000, flag_exemptions: ["XX_FLAG"] },
        rule_text: null,
        source_reference: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
    // Vessel with an exempt flag → NOT_APPLICABLE via rule (not GT-only).
    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      vessel_profile: { flag: "XX_FLAG", vessel_type: "cargo", vessel_category: null },
      consumption: [makeConsumptionRow({ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100 })],
      deliveries: [makeDeliveryInput()],
      voyages: [makeVoyageInput({ id: "v1" })],
    });
    expect(result.compliance_status).toBe("NOT_APPLICABLE");
    expect(result.compliance_applicable).toBe(false);
    expect(result.eua_obligation_tonnes).toBe(0);
  });
});

// ── Fake repo ───────────────────────────────────────────────────────────────

function createFakeEuEtsRepo(): EuEtsRecordRepository {
  const store: EuEtsRecordRow[] = [];
  return {
    async findByVesselAndYear(vesselId, year) {
      return store.find((r) => r.vessel_id === vesselId && r.reporting_year === year) ?? null;
    },
    async upsert(record: EuEtsRecordInsert) {
      const existing = store.findIndex(
        (r) => r.vessel_id === record.vessel_id && r.reporting_year === record.reporting_year,
      );
      const ts = new Date().toISOString();
      const row: EuEtsRecordRow = {
        id: existing >= 0 ? store[existing]!.id : crypto.randomUUID(),
        vessel_id: record.vessel_id,
        reporting_year: record.reporting_year,
        calculation_version: record.calculation_version,
        gt: record.gt ?? null,
        ets_scope: record.ets_scope,
        mrv_scope: record.mrv_scope,
        total_ttw_co2_tonnes: record.total_ttw_co2_tonnes,
        covered_co2_tonnes: record.covered_co2_tonnes,
        coverage_rate: record.coverage_rate,
        coverage_rate_version: record.coverage_rate_version,
        eua_obligation_tonnes: record.eua_obligation_tonnes,
        eua_price_eur: record.eua_price_eur ?? null,
        eua_price_available: record.eua_price_available,
        estimated_cost_eur: record.estimated_cost_eur ?? null,
        surrender_deadline: record.surrender_deadline ?? null,
        surrender_status: record.surrender_status ?? null,
        mrv_deadline: record.mrv_deadline ?? null,
        mrv_deadline_status: record.mrv_deadline_status ?? null,
        parameter_version: record.parameter_version,
        calculation_details: record.calculation_details,
        calculated_at: record.calculated_at ?? ts,
        created_at: ts,
        updated_at: ts,
      };
      if (existing >= 0) store[existing] = row;
      else store.push(row);
      return row;
    },
    async listByVessel(vesselId) {
      return store.filter((r) => r.vessel_id === vesselId);
    },
    async delete(id) {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
  };
}

run();
