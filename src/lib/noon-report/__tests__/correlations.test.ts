/**
 * correlations.test.ts — noon report correlation engines tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the four deterministic correlation engines:
 *   fuel-correlation (deliveries vs consumption, ROB delta, attribution),
 *   voyage-correlation (progress, speed, ETA posture, late arrival),
 *   fueleu-correlation (LHV-backed energy extraction),
 *   ets-correlation (emission-factor-backed CO2 extraction).
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/correlations.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  analyzeNoonReport,
  correlateNoonFuel,
  correlateNoonVoyage,
  correlateNoonFuelEu,
  correlateNoonEts,
} from "../index";
import type { FuelDeliveryLike } from "../fuel-correlation";
import type { NoonReportDomain } from "../types";
import {
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockEngineReference,
  mockVoyagePlan,
  MOCK_VESSEL_ID,
  MOCK_IMO,
  MOCK_VESSEL_NAME,
} from "../mock-data";

const NOW = "2026-08-01T13:00:00.000Z";
const VESSEL = { vesselId: MOCK_VESSEL_ID, imo: MOCK_IMO, name: MOCK_VESSEL_NAME };

function analysisFor(
  report: NoonReportDomain,
  attribution: Array<{ fuelType: string; tonnes: number }> | null = null,
) {
  return analyzeNoonReport({
    report,
    vessel: VESSEL,
    previous: mockPreviousNoonReport(),
    engineReference: mockEngineReference(),
    voyagePlan: mockVoyagePlan(),
    fuelAttribution: attribution,
    now: NOW,
  });
}

function delivery(id: string, fuelType: string, quantityMt: number): FuelDeliveryLike {
  return { id, fuel_type: fuelType, quantity_mt: quantityMt, delivery_date: "2026-08-01T06:00:00.000Z" };
}

describe("correlateNoonFuel — no deliveries", () => {
  const report = mockNoonReportDomain();
  const fuel = correlateNoonFuel({ report, previous: mockPreviousNoonReport(), deliveries: [] });

  it("reports insufficient delivery data but consistent ROB", () => {
    expect(fuel.deliveredTonnes).toBeNull();
    expect(fuel.deliveryState).toBe("INSUFFICIENT_DATA");
    expect(fuel.deliveryDiscrepancyTonnes).toBeNull();
    expect(fuel.robDeltaTonnes).toBe(32.4);
    expect(fuel.robDiscrepancyPct).toBe(0);
    expect(fuel.robState).toBe("CONSISTENT");
  });

  it("leaves attribution unresolved", () => {
    expect(fuel.attributionResolved).toBe(false);
    expect(fuel.attribution.length).toBe(0);
    expect(fuel.findings.length).toBe(0);
  });
});

describe("correlateNoonFuel — with deliveries", () => {
  const report = mockNoonReportDomain();
  const fuel = correlateNoonFuel({
    report,
    previous: mockPreviousNoonReport(),
    deliveries: [delivery("d1", "hfo_rme180", 200), delivery("d2", "mgo_dma", 100)],
  });

  it("computes delivery totals and consistency", () => {
    expect(fuel.deliveredTonnes).toBe(300);
    expect(fuel.deliveryDiscrepancyTonnes).toBe(-1160);
    expect(fuel.deliveryDiscrepancyPct).toBe(-97.283);
    expect(fuel.deliveryState).toBe("CONSISTENT");
  });

  it("attributes consumption across fuel types by quantity share", () => {
    expect(fuel.attributionResolved).toBe(true);
    const hfo = fuel.attribution.find((a) => a.fuelType === "hfo_rme180");
    const mgo = fuel.attribution.find((a) => a.fuelType === "mgo_dma");
    expect(hfo!.tonnes).toBe(21.6);
    expect(mgo!.tonnes).toBe(10.8);
  });

  it("keeps ROB consistency intact", () => {
    expect(fuel.robState).toBe("CONSISTENT");
    expect(fuel.findings.length).toBe(0);
  });
});

describe("correlateNoonFuel — impossible consumption", () => {
  const fuel = correlateNoonFuel({
    report: mockNoonReportDomain({ fuelConsumptionTonnes: 1200 }),
    previous: mockPreviousNoonReport(),
    deliveries: [delivery("d1", "hfo_380", 50)],
  });

  it("flags consumption beyond opening ROB plus deliveries", () => {
    expect(fuel.deliveryState).toBe("INCONSISTENT");
    expect(fuel.deliveryDiscrepancyPct).toBe(27.334);
    expect(fuel.findings.some((f) => f.id === "noon.fuel.impossible_consumption")).toBe(true);
    const finding = fuel.findings.find((f) => f.id === "noon.fuel.impossible_consumption")!;
    expect(finding.severity).toBe("ERROR");
    expect(finding.category).toBe("fuel");
  });
});

describe("correlateNoonFuel — ROB inconsistency", () => {
  const fuel = correlateNoonFuel({
    report: mockNoonReportDomain({ fuelConsumptionTonnes: 46.2 }),
    previous: mockPreviousNoonReport(),
    deliveries: [],
  });

  it("flags a ROB delta that mismatches reported consumption", () => {
    expect(fuel.robState).toBe("INCONSISTENT");
    expect(fuel.robDeltaTonnes).toBe(32.4);
    expect(fuel.robDiscrepancyPct).toBe(-29.87);
    expect(fuel.findings.some((f) => f.id === "noon.fuel.rob_inconsistency")).toBe(true);
    const finding = fuel.findings.find((f) => f.id === "noon.fuel.rob_inconsistency")!;
    expect(finding.severity).toBe("WARNING");
  });
});

describe("correlateNoonVoyage — clean at sea", () => {
  const report = mockNoonReportDomain();
  const analysis = analysisFor(report);
  const voyage = correlateNoonVoyage({ report, previous: mockPreviousNoonReport(), analysis, voyagePlan: mockVoyagePlan() });

  it("computes progress, speed deviation and ETA variance", () => {
    expect(voyage.distanceMadeGoodNm).toBe(339.599);
    expect(voyage.progressPct).toBe(28.3);
    expect(voyage.speedMadeGoodKnots).toBe(14.15);
    expect(voyage.speedDeviationPct).toBe(-2.414);
    expect(voyage.etaDeviationHours).toBe(-42.261);
    expect(voyage.lateHours).toBe(0);
  });

  it("resolves the schedule posture to ON_SCHEDULE", () => {
    expect(voyage.state).toBe("ON_SCHEDULE");
    expect(voyage.findings.length).toBe(0);
  });
});

describe("correlateNoonVoyage — behind schedule", () => {
  const report = mockNoonReportDomain({ reportDate: "2026-08-04T12:00:00.000Z" });
  const analysis = analysisFor(report);
  const voyage = correlateNoonVoyage({ report, previous: mockPreviousNoonReport(), analysis, voyagePlan: mockVoyagePlan() });

  it("detects slow made-good speed and a late arrival", () => {
    expect(voyage.speedMadeGoodKnots).toBe(3.537);
    expect(voyage.state).toBe("BEHIND");
    expect(voyage.lateHours).toBeTruthy();
    expect(voyage.lateHours!).toBeGreaterThan(6);
    const ids = voyage.findings.map((f) => f.id);
    expect(ids).toContain("noon.voyage.behind_schedule");
    expect(ids).toContain("noon.voyage.late_arrival");
  });
});

describe("correlateNoonVoyage — ahead of schedule", () => {
  const report = mockNoonReportDomain({
    positionLatitude: 51.945,
    positionLongitude: 4.1277,
    distanceToGoNm: 0,
    speedKnots: 0,
    engineRpm: 0,
  });
  const analysis = analysisFor(report);
  const voyage = correlateNoonVoyage({ report, previous: mockPreviousNoonReport(), analysis, voyagePlan: mockVoyagePlan() });

  it("resolves the posture to AHEAD for the long made-good leg", () => {
    expect(voyage.speedMadeGoodKnots).toBe(236.065);
    expect(voyage.state).toBe("AHEAD");
    expect(voyage.progressPct).toBe(472.129);
  });
});

describe("correlateNoonVoyage — no voyage plan", () => {
  const report = mockNoonReportDomain();
  const analysis = analysisFor(report);
  const voyage = correlateNoonVoyage({ report, previous: mockPreviousNoonReport(), analysis, voyagePlan: null });

  it("reports insufficient data without a plan", () => {
    expect(voyage.state).toBe("INSUFFICIENT_DATA");
    expect(voyage.plannedDistanceNm).toBeNull();
    expect(voyage.progressPct).toBeNull();
    expect(voyage.speedDeviationPct).toBeNull();
    expect(voyage.etaDeviationHours).toBeNull();
    expect(voyage.findings.length).toBe(0);
  });
});

describe("correlateNoonFuelEu", () => {
  it("flags unattributed consumption and reports no energy", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, null);
    const fueleu = correlateNoonFuelEu({ report, analysis });

    expect(fueleu.reportingYear).toBe(2026);
    expect(fueleu.reportCount).toBe(1);
    expect(fueleu.daysCovered).toBe(1);
    expect(fueleu.energyMeters).toEqual([
      { fuelType: "UNKNOWN", tonnes: 32.4, energyMj: null, lhvSource: null, resolved: false },
    ]);
    expect(fueleu.totalEnergyMj).toBeNull();
    expect(fueleu.dataAvailable).toBe(false);
    expect(fueleu.findings.some((f) => f.id === "noon.fueleu.unattributed_consumption")).toBe(true);
  });

  it("resolves LHV-backed energy from attributed fuel types", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, [
      { fuelType: "hfo_rme180", tonnes: 21.6 },
      { fuelType: "mgo_dma", tonnes: 10.8 },
    ]);
    const fueleu = correlateNoonFuelEu({ report, analysis });

    expect(fueleu.dataAvailable).toBe(true);
    expect(fueleu.totalTonnes).toBe(32.4);
    expect(fueleu.energyMeters.length).toBe(2);
    expect(fueleu.energyMeters[0]).toEqual({
      fuelType: "hfo_rme180",
      tonnes: 21.6,
      energyMj: 874800,
      lhvSource: "IMO DCS",
      resolved: true,
    });
    expect(fueleu.energyMeters[1]!.energyMj).toBe(461160);
    expect(fueleu.totalEnergyMj).toBe(1335960);
    expect(fueleu.findings.length).toBe(0);
  });

  it("flags an unknown attributed fuel type as unresolved", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, [{ fuelType: "mystery_oil", tonnes: 32.4 }]);
    const fueleu = correlateNoonFuelEu({ report, analysis });

    expect(fueleu.energyMeters[0]!.resolved).toBe(false);
    expect(fueleu.energyMeters[0]!.energyMj).toBeNull();
    expect(fueleu.dataAvailable).toBe(false);
  });
});

describe("correlateNoonEts", () => {
  it("flags unattributed consumption and reports no CO2", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, null);
    const ets = correlateNoonEts({ report, analysis });

    expect(ets.emissions).toEqual([
      { fuelType: "UNKNOWN", tonnes: 32.4, co2Tonnes: null, factorSource: null, resolved: false },
    ]);
    expect(ets.totalCo2Tonnes).toBeNull();
    expect(ets.dataAvailable).toBe(false);
    expect(ets.findings.some((f) => f.id === "noon.ets.unattributed_consumption")).toBe(true);
  });

  it("resolves CO2 from attributed fuel types using emission factors", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, [
      { fuelType: "hfo_380", tonnes: 21.6 },
      { fuelType: "mgo", tonnes: 10.8 },
    ]);
    const ets = correlateNoonEts({ report, analysis });

    expect(ets.dataAvailable).toBe(true);
    expect(ets.totalTonnes).toBe(32.4);
    expect(ets.emissions[0]).toEqual({
      fuelType: "hfo_380",
      tonnes: 21.6,
      co2Tonnes: 67.262,
      factorSource: "IMO GHG Study / IPCC 2006 Guidelines",
      resolved: true,
    });
    expect(ets.emissions[1]!.co2Tonnes).toBe(34.625);
    expect(ets.totalCo2Tonnes).toBe(101.887);
    expect(ets.findings.length).toBe(0);
  });

  it("flags an unattributed UNKNOWN fuel type as unresolved even when listed", () => {
    const report = mockNoonReportDomain();
    const analysis = analysisFor(report, [{ fuelType: "UNKNOWN", tonnes: 32.4 }]);
    const ets = correlateNoonEts({ report, analysis });

    expect(ets.emissions[0]!.resolved).toBe(false);
    expect(ets.emissions[0]!.co2Tonnes).toBeNull();
    expect(ets.dataAvailable).toBe(false);
  });
});

run();
