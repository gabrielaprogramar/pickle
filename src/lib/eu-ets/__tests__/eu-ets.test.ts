import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { etsScopeForGt, mrvScopeForGt } from "@/lib/eu-ets/types";
import {
  getEtsCoverageRate,
  getVoyageCoverageFactor,
  getVoyageCoverageLabel,
  getDeadlineForYear,
  ETS_COVERAGE_SCHEDULE,
  ETS_CURRENT_PARAMETER_VERSION,
} from "@/lib/eu-ets/parameters";
import {
  isEuPort,
  classifyVoyageCoverage,
  classifyVoyagePortStatus,
  PORT_CLASSIFIER_VERSION,
} from "@/lib/eu-ets/port-classifier";
import { ETS_PARAMETER_VERSION_WITH_CLASSIFIER } from "@/lib/eu-ets/parameters";
import { computeEtsEmissions } from "@/lib/eu-ets/emissions";
import { deadlineStatus, computeDeadlines } from "@/lib/eu-ets/deadlines";
import { EtsComplianceService } from "@/lib/eu-ets/service";

import { makeDeliveryInput, makeVoyageInput, VESSEL_ID } from "./fixtures";

// ── Scope ──────────────────────────────────────────────────────────────────

describe("ets scope", () => {
  it("returns IN_SCOPE for GT >= 5000", () => {
    const s = etsScopeForGt(5000);
    if (s !== "IN_SCOPE") throw new Error(`Expected IN_SCOPE, got ${s}`);
  });

  it("returns OUT_OF_SCOPE for GT < 5000", () => {
    const s = etsScopeForGt(4999);
    if (s !== "OUT_OF_SCOPE") throw new Error(`Expected OUT_OF_SCOPE, got ${s}`);
  });

  it("returns UNKNOWN_DATA for null GT", () => {
    const s = etsScopeForGt(null);
    if (s !== "UNKNOWN_DATA") throw new Error(`Expected UNKNOWN_DATA, got ${s}`);
  });

  it("returns UNKNOWN_DATA for undefined GT", () => {
    const s = etsScopeForGt(undefined as unknown as number | null);
    if (s !== "UNKNOWN_DATA") throw new Error(`Expected UNKNOWN_DATA, got ${s}`);
  });
});

describe("mrv scope", () => {
  it("returns IN_SCOPE for GT >= 400", () => {
    const s = mrvScopeForGt(400);
    if (s !== "IN_SCOPE") throw new Error(`Expected IN_SCOPE, got ${s}`);
  });

  it("returns OUT_OF_SCOPE for GT < 400", () => {
    const s = mrvScopeForGt(399);
    if (s !== "OUT_OF_SCOPE") throw new Error(`Expected OUT_OF_SCOPE, got ${s}`);
  });

  it("returns UNKNOWN_DATA for null GT", () => {
    const s = mrvScopeForGt(null);
    if (s !== "UNKNOWN_DATA") throw new Error(`Expected UNKNOWN_DATA, got ${s}`);
  });
});

// ── Parameters ─────────────────────────────────────────────────────────────

describe("ETS parameters", () => {
  it("CURRENT_PARAMETER_VERSION is 2025.1", () => {
    if (ETS_CURRENT_PARAMETER_VERSION !== "2025.1") throw new Error("Expected 2025.1");
  });

  it("COVERAGE_SCHEDULE has 3 entries", () => {
    if (ETS_COVERAGE_SCHEDULE.length !== 3) throw new Error("Expected 3 schedule entries");
  });

  it("getEtsCoverageRate for 2024 returns 0.40", () => {
    const r = getEtsCoverageRate(2024);
    if (r.rate !== 0.40) throw new Error(`Expected 0.40, got ${r.rate}`);
    if (r.year !== 2024) throw new Error(`Expected year 2024, got ${r.year}`);
  });

  it("getEtsCoverageRate for 2025 returns 0.70", () => {
    const r = getEtsCoverageRate(2025);
    if (r.rate !== 0.70) throw new Error(`Expected 0.70, got ${r.rate}`);
  });

  it("getEtsCoverageRate for 2026 returns 1.00", () => {
    const r = getEtsCoverageRate(2026);
    if (r.rate !== 1.00) throw new Error(`Expected 1.00, got ${r.rate}`);
  });

  it("getEtsCoverageRate for 2030 returns 1.00 (last entry used)", () => {
    const r = getEtsCoverageRate(2030);
    if (r.rate !== 1.00) throw new Error(`Expected 1.00, got ${r.rate}`);
  });

  it("getEtsCoverageRate for 2023 returns 0.40 (first entry)", () => {
    const r = getEtsCoverageRate(2023);
    if (r.rate !== 0.40) throw new Error(`Expected 0.40, got ${r.rate}`);
  });
});

describe("voyage coverage factors", () => {
  it("INTRA_EU factor is 1.0", () => {
    if (getVoyageCoverageFactor("INTRA_EU") !== 1.0) throw new Error("Expected 1.0");
  });

  it("EU_TO_THIRD factor is 0.5", () => {
    if (getVoyageCoverageFactor("EU_TO_THIRD") !== 0.5) throw new Error("Expected 0.5");
  });

  it("THIRD_TO_EU factor is 0.5", () => {
    if (getVoyageCoverageFactor("THIRD_TO_EU") !== 0.5) throw new Error("Expected 0.5");
  });

  it("NON_EU factor is 0.0", () => {
    if (getVoyageCoverageFactor("NON_EU") !== 0.0) throw new Error("Expected 0.0");
  });

  it("getVoyageCoverageLabel returns valid label for each type", () => {
    const types = ["INTRA_EU", "EU_TO_THIRD", "THIRD_TO_EU", "NON_EU"] as const;
    for (const t of types) {
      const label = getVoyageCoverageLabel(t);
      if (!label || label.length === 0) throw new Error(`Empty label for ${t}`);
    }
  });
});

describe("deadline parameters", () => {
  it("surrender deadline is 30 September", () => {
    const d = getDeadlineForYear("surrender", 2026);
    if (d.date.getMonth() !== 8) throw new Error(`Expected month 8 (Sep), got ${d.date.getMonth()}`);
    if (d.date.getDate() !== 30) throw new Error(`Expected day 30, got ${d.date.getDate()}`);
  });

  it("mrv_reporting deadline is 31 March", () => {
    const d = getDeadlineForYear("mrv_reporting", 2026);
    if (d.date.getMonth() !== 2) throw new Error(`Expected month 2 (Mar), got ${d.date.getMonth()}`);
    if (d.date.getDate() !== 31) throw new Error(`Expected day 31, got ${d.date.getDate()}`);
  });
});

// ── Port classifier ────────────────────────────────────────────────────────

describe("port classifier", () => {
  it("classifies Rotterdam as EU", () => {
    if (isEuPort("Rotterdam") !== "eu") throw new Error("Expected eu");
  });

  it("classifies Singapore as non-EU", () => {
    if (isEuPort("Singapore") !== "non_eu") throw new Error("Expected non_eu");
  });

  it("classifies unknown port as unknown", () => {
    if (isEuPort("Atlantis") !== "unknown") throw new Error("Expected unknown");
  });

  it("is case-insensitive", () => {
    if (isEuPort("ROTTERDAM") !== "eu") throw new Error("Expected eu");
  });

  it("classifies Intra-EU voyage", () => {
    const t = classifyVoyageCoverage("Rotterdam", "Hamburg");
    if (t !== "INTRA_EU") throw new Error(`Expected INTRA_EU, got ${t}`);
  });

  it("classifies EU to Third country", () => {
    const t = classifyVoyageCoverage("Rotterdam", "Singapore");
    if (t !== "EU_TO_THIRD") throw new Error(`Expected EU_TO_THIRD, got ${t}`);
  });

  it("classifies Third to EU", () => {
    const t = classifyVoyageCoverage("Singapore", "Rotterdam");
    if (t !== "THIRD_TO_EU") throw new Error(`Expected THIRD_TO_EU, got ${t}`);
  });

  it("classifies Non-EU voyage", () => {
    const t = classifyVoyageCoverage("Singapore", "Shanghai");
    if (t !== "NON_EU") throw new Error(`Expected NON_EU, got ${t}`);
  });

  it("classifies unknown ports as NON_EU via legacy projection", () => {
    const t = classifyVoyageCoverage("Atlantis", "El Dorado");
    if (t !== "NON_EU") throw new Error(`Expected NON_EU, got ${t}`);
  });

  it("classifies UK ports as NON_EU", () => {
    if (isEuPort("Southampton") !== "non_eu") throw new Error("Expected Southampton non_eu");
    if (isEuPort("Felixstowe") !== "non_eu") throw new Error("Expected Felixstowe non_eu");
    if (isEuPort("London") !== "non_eu") throw new Error("Expected London non_eu");
    if (isEuPort("Liverpool") !== "non_eu") throw new Error("Expected Liverpool non_eu");
  });

  it("classifies EU→UK voyage as EU_TO_THIRD (50%)", () => {
    const t = classifyVoyageCoverage("Rotterdam", "Felixstowe");
    if (t !== "EU_TO_THIRD") throw new Error(`Expected EU_TO_THIRD, got ${t}`);
  });

  it("surfaces unknown ports via classifyVoyagePortStatus", () => {
    const s = classifyVoyagePortStatus("Rotterdam", "El Dorado");
    if (s.type !== "UNKNOWN") throw new Error(`Expected UNKNOWN, got ${s.type}`);
    if (s.unknownPorts.length !== 1) throw new Error("Expected 1 unknown port");
    if (s.unknownPorts[0] !== "El Dorado") throw new Error("Expected El Dorado in unknownPorts");
  });

  it("surfaces no unknown ports for fully resolved routes", () => {
    const s = classifyVoyagePortStatus("Rotterdam", "Singapore");
    if (s.type !== "EU_TO_THIRD") throw new Error(`Expected EU_TO_THIRD, got ${s.type}`);
    if (s.unknownPorts.length !== 0) throw new Error("Expected no unknown ports");
  });

  it("exports a classifier version", () => {
    if (!PORT_CLASSIFIER_VERSION || PORT_CLASSIFIER_VERSION.length === 0) {
      throw new Error("Expected a classifier version");
    }
  });
});

describe("ETS parameter version carries the classifier version", () => {
  it("contains the classifier version", () => {
    if (!ETS_PARAMETER_VERSION_WITH_CLASSIFIER.includes(PORT_CLASSIFIER_VERSION)) {
      throw new Error(
        `Expected parameter version ${ETS_PARAMETER_VERSION_WITH_CLASSIFIER} to include classifier ${PORT_CLASSIFIER_VERSION}`,
      );
    }
  });
});

// ── Emissions ──────────────────────────────────────────────────────────────

describe("ETS emissions", () => {
  it("computes TtW CO2 from HFO deliveries", () => {
    const result = computeEtsEmissions([
      makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 }),
    ]);
    // hfo_380 co2_factor = 3.114 → 100mt × 1000 × 3.114 = 311,400 kg = 311.4 tonnes
    if (Math.abs(result.total_ttw_co2_tonnes - 311.4) > 0.01) {
      throw new Error(`Expected 311.4, got ${result.total_ttw_co2_tonnes}`);
    }
    if (result.deliveries_used !== 1) throw new Error("Expected 1 delivery used");
    if (result.unresolved_fuel_types.length !== 0) throw new Error("Expected no unresolved");
  });

  it("computes TtW CO2 from MGO deliveries", () => {
    const result = computeEtsEmissions([
      makeDeliveryInput({ fuel_type: "mgo", quantity_mt: 50 }),
    ]);
    // mgo co2_factor = 3.206 → 50 × 1000 × 3.206 = 160,300 kg = 160.3 tonnes
    if (Math.abs(result.total_ttw_co2_tonnes - 160.3) > 0.01) {
      throw new Error(`Expected 160.3, got ${result.total_ttw_co2_tonnes}`);
    }
  });

  it("accumulates multiple deliveries", () => {
    const result = computeEtsEmissions([
      makeDeliveryInput({ id: "1", fuel_type: "hfo_380", quantity_mt: 100 }),
      makeDeliveryInput({ id: "2", fuel_type: "mgo", quantity_mt: 50 }),
    ]);
    // 311.4 + 160.3 = 471.7
    if (Math.abs(result.total_ttw_co2_tonnes - 471.7) > 0.01) {
      throw new Error(`Expected 471.7, got ${result.total_ttw_co2_tonnes}`);
    }
    if (result.deliveries_used !== 2) throw new Error("Expected 2 deliveries");
  });

  it("produces 0 for empty deliveries", () => {
    const result = computeEtsEmissions([]);
    if (result.total_ttw_co2_tonnes !== 0) throw new Error("Expected 0");
    if (result.deliveries_used !== 0) throw new Error("Expected 0 deliveries used");
  });
});

// ── Deadlines ──────────────────────────────────────────────────────────────

describe("deadlines", () => {
  it("deadlineStatus OVERDUE for negative days", () => {
    if (deadlineStatus(-1) !== "OVERDUE") throw new Error("Expected OVERDUE");
  });

  it("deadlineStatus URGENT for 0-7 days", () => {
    if (deadlineStatus(0) !== "URGENT") throw new Error("Expected URGENT");
    if (deadlineStatus(7) !== "URGENT") throw new Error("Expected URGENT for 7");
  });

  it("deadlineStatus WARNING for 8-30 days", () => {
    if (deadlineStatus(8) !== "WARNING") throw new Error("Expected WARNING for 8");
    if (deadlineStatus(30) !== "WARNING") throw new Error("Expected WARNING for 30");
  });

  it("deadlineStatus OK for > 30 days", () => {
    if (deadlineStatus(31) !== "OK") throw new Error("Expected OK");
  });

  it("computeDeadlines returns both deadlines with status", () => {
    // Reference date well before any deadline (e.g. 2026-01-01)
    const ref = new Date("2026-01-01T00:00:00Z");
    const d = computeDeadlines(2026, ref);
    if (!d.surrender) throw new Error("Expected surrender deadline");
    if (!d.mrvReporting) throw new Error("Expected MRV deadline");
    if (d.surrender.type !== "surrender") throw new Error("Expected surrender type");
    if (d.mrvReporting.type !== "mrv_reporting") throw new Error("Expected mrv_reporting type");
  });
});

// ── Service ────────────────────────────────────────────────────────────────

describe("EtsComplianceService", () => {
  it("calculate returns result with correct structure", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [
        makeVoyageInput({ id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg" }),
        makeVoyageInput({ id: "v2", departure_port: "Rotterdam", arrival_port: "Singapore" }),
      ],
    });

    if (result.ets_scope !== "IN_SCOPE") throw new Error(`Expected IN_SCOPE, got ${result.ets_scope}`);
    if (result.is_in_scope !== true) throw new Error("Expected in scope");
    if (result.total_ttw_co2_tonnes <= 0) throw new Error("Expected positive CO2");
    if (result.covered_co2_tonnes <= 0) throw new Error("Expected positive covered CO2");
    if (result.coverage_rate !== 1.0) throw new Error(`Expected 1.0, got ${result.coverage_rate}`);
    if (result.eua_obligation_tonnes <= 0) throw new Error("Expected positive obligation");
    if (result.eua_price_available !== true) throw new Error("Expected price available");
    if (result.estimated_cost_eur === null) throw new Error("Expected estimated cost");
    if (!result.surrender_deadline) throw new Error("Expected surrender deadline");
    if (!result.mrv_deadline) throw new Error("Expected MRV deadline");
    if (result.voyage_contributions.length !== 2) throw new Error("Expected 2 voyage contributions");
  });

  it("out of scope vessel has zero obligation", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 1000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [makeVoyageInput()],
    });

    if (result.ets_scope !== "OUT_OF_SCOPE") throw new Error("Expected OUT_OF_SCOPE");
    if (result.is_in_scope !== false) throw new Error("Expected not in scope");
    if (result.eua_obligation_tonnes !== 0) throw new Error("Expected 0 obligation");
    if (result.estimated_cost_eur !== null) throw new Error("Expected null cost");
  });

  it("2024 phase-in uses 40% rate", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2024,
      gt: 15000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [makeVoyageInput({ departure_port: "Rotterdam", arrival_port: "Hamburg" })],
    });

    if (result.coverage_rate !== 0.40) throw new Error(`Expected 0.40, got ${result.coverage_rate}`);
  });

  it("calculateAndSave persists via repo", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculateAndSave({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [makeVoyageInput()],
    });

    // Should now be retrievable
    const saved = await repo.findByVesselAndYear(VESSEL_ID, 2026);
    if (!saved) throw new Error("Expected saved record");
    if (saved.ets_scope !== "IN_SCOPE") throw new Error("Expected IN_SCOPE");
  });

  it("getRecord returns null for non-existent", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const record = await service.getRecord("nonexistent", 2026);
    if (record !== null) throw new Error("Expected null");
  });

  it("surfaces unknown ports and classifier version in parameter_version", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [
        makeVoyageInput({ id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg" }),
        makeVoyageInput({ id: "v2", departure_port: "Rotterdam", arrival_port: "El Dorado" }),
      ],
    });

    if (result.parameter_version !== ETS_PARAMETER_VERSION_WITH_CLASSIFIER) {
      throw new Error(`Expected combined parameter version, got ${result.parameter_version}`);
    }
    if (result.unknown_ports.length !== 1 || result.unknown_ports[0] !== "El Dorado") {
      throw new Error(`Expected unknown port, got ${JSON.stringify(result.unknown_ports)}`);
    }
  });

  it("never counts UK voyages as INTRA_EU", async () => {
    const repo = createFakeEuEtsRepo();
    const service = new EtsComplianceService(repo);

    const result = await service.calculate({
      vessel_id: VESSEL_ID,
      reporting_year: 2026,
      gt: 15000,
      deliveries: [makeDeliveryInput({ fuel_type: "hfo_380", quantity_mt: 100 })],
      voyages: [
        makeVoyageInput({ id: "v1", departure_port: "Rotterdam", arrival_port: "Felixstowe" }),
      ],
    });

    const contribution = result.voyage_contributions[0];
    if (!contribution || contribution.coverage_type !== "EU_TO_THIRD") {
      throw new Error(
        `Expected EU_TO_THIRD (0.5), got ${JSON.stringify(contribution?.coverage_type)}`,
      );
    }
    if (contribution.coverage_factor !== 0.5) {
      throw new Error(`Expected factor 0.5, got ${contribution.coverage_factor}`);
    }
  });
});

// ── Fake repo helper ───────────────────────────────────────────────────────

import type { EuEtsRecordRow, EuEtsRecordInsert } from "@/lib/eu-ets/types";
import type { EuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";

function createFakeEuEtsRepo(): EuEtsRecordRepository {
  const store: EuEtsRecordRow[] = [];

  return {
    async findByVesselAndYear(vesselId: string, year: number) {
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
      if (existing >= 0) {
        store[existing] = row;
      } else {
        store.push(row);
      }
      return row;
    },
    async listByVessel(vesselId: string) {
      return store.filter((r) => r.vessel_id === vesselId);
    },
    async delete(id: string) {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
  };
}

// ── Run ────────────────────────────────────────────────────────────────────

run();
