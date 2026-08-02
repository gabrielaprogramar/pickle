/**
 * engine.test.ts — deterministic noon report intelligence engine tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Asserts the pure functions (round3, haversineNm, hoursBetween,
 * resolveOperationalState) and the deterministic analysis produced by
 * analyzeNoonReport on the fixed mock fixtures. All numbers are byte-for-byte
 * deterministic (rounded to 3 decimals) so they are asserted exactly.
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/engine.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  analyzeNoonReport,
  resolveOperationalState,
  haversineNm,
  hoursBetween,
  round3,
  buildNoonDedupKey,
} from "../engine";
import type { NoonReportEngineInput, NoonReportDomain } from "../types";
import { NOON_REPORT_ENGINE_VERSION } from "../types";
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

function analyze(
  report: NoonReportDomain = mockNoonReportDomain(),
  overrides: Partial<NoonReportEngineInput> = {},
) {
  return analyzeNoonReport({
    report,
    vessel: { vesselId: MOCK_VESSEL_ID, imo: MOCK_IMO, name: MOCK_VESSEL_NAME },
    previous: mockPreviousNoonReport(),
    engineReference: mockEngineReference(),
    voyagePlan: mockVoyagePlan(),
    now: NOW,
    ...overrides,
  });
}

describe("round3", () => {
  it("rounds to three decimals", () => {
    expect(round3(1.23449)).toBe(1.234);
    expect(round3(1.2345)).toBe(1.235);
  });

  it("handles zero and integers", () => {
    expect(round3(0)).toBe(0);
    expect(round3(100)).toBe(100);
  });

  it("rounds negative values", () => {
    expect(round3(-2.11549)).toBe(-2.115);
  });
});

describe("haversineNm", () => {
  it("returns zero for identical positions", () => {
    expect(haversineNm(10.5, 106.8, 10.5, 106.8)).toBe(0);
  });

  it("matches the mock previous→report distance", () => {
    expect(haversineNm(8.12, 112.0, 10.5, 106.8)).toBe(339.599);
  });

  it("matches the Singapore→Rotterdam mock leg distance", () => {
    expect(haversineNm(8.12, 112.0, 51.945, 4.1277)).toBe(5665.551);
  });
});

describe("hoursBetween", () => {
  it("returns the positive hour difference", () => {
    expect(hoursBetween("2026-07-31T12:00:00.000Z", "2026-08-01T12:00:00.000Z")).toBe(24);
  });

  it("returns null when elapsed time is not positive", () => {
    expect(hoursBetween("2026-08-01T12:00:00.000Z", "2026-08-01T12:00:00.000Z")).toBeNull();
    expect(hoursBetween("2026-08-02T12:00:00.000Z", "2026-08-01T12:00:00.000Z")).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(hoursBetween("not-a-date", "2026-08-01T12:00:00.000Z")).toBeNull();
  });
});

describe("resolveOperationalState", () => {
  it("resolves AT_SEA when under way", () => {
    expect(resolveOperationalState(14.2, 1100)).toBe("AT_SEA");
  });

  it("resolves IN_PORT when stationary with distance to go 5 nm or less", () => {
    expect(resolveOperationalState(0, 3)).toBe("IN_PORT");
    expect(resolveOperationalState(0, 5)).toBe("IN_PORT");
  });

  it("resolves WAITING when stationary but far from the destination", () => {
    expect(resolveOperationalState(0, 100)).toBe("WAITING");
    expect(resolveOperationalState(0.3, 1200)).toBe("WAITING");
  });

  it("resolves UNKNOWN when speed is missing", () => {
    expect(resolveOperationalState(null, 1100)).toBe("UNKNOWN");
  });
});

describe("analyzeNoonReport — clean at sea (mock fixture)", () => {
  const a = analyze();

  it("sets the engine version and evaluatedAt to now", () => {
    expect(a.engineVersion).toBe(NOON_REPORT_ENGINE_VERSION);
    expect(a.engineVersion).toBe("1.0.0");
    expect(a.evaluatedAt).toBe(NOW);
  });

  it("resolves the operational state", () => {
    expect(a.operationalState).toBe("AT_SEA");
  });

  it("computes the consumption summary", () => {
    expect(a.consumption.totalTonnes).toBe(32.4);
    expect(a.consumption.sinceLastReportTonnes).toBe(32.4);
    expect(a.consumption.intervalDays).toBe(1);
    expect(a.consumption.rateTonnesPerDay).toBe(32.4);
    expect(a.consumption.trendPct).toBe(-2.115);
    expect(a.consumption.confidence).toBe(0.95);
  });

  it("leaves the fuel breakdown unresolved without attribution", () => {
    expect(a.fuelBreakdown.resolved).toBe(false);
    expect(a.fuelBreakdown.unresolvedFuelTypes).toEqual(["UNKNOWN"]);
    expect(a.fuelBreakdown.items.length).toBe(0);
  });

  it("computes remaining on board and endurance", () => {
    expect(a.remainingOnBoard.robTonnes).toBe(860);
    expect(a.remainingOnBoard.enduranceDays).toBe(26.543);
  });

  it("computes engine load against the design reference", () => {
    expect(a.engine.rpm).toBe(82);
    expect(a.engine.loadPct).toBe(97.619);
    expect(a.engine.atDesign).toBe(false);
  });

  it("reports the weather state", () => {
    expect(a.weather.seaState).toBe("MODERATE");
    expect(a.weather.windSpeedKnots).toBe(18);
    expect(a.weather.windDirection).toBe("NE");
    expect(a.weather.significant).toBe(false);
  });

  it("computes voyage made good between consecutive positions", () => {
    expect(a.voyage.position.latitude).toBe(10.5);
    expect(a.voyage.position.longitude).toBe(106.8);
    expect(a.voyage.courseDegrees).toBe(295);
    expect(a.voyage.distanceMadeGoodNm).toBe(339.599);
    expect(a.voyage.speedMadeGoodKnots).toBe(14.15);
  });

  it("computes distance progress against the planned leg", () => {
    expect(a.distance.plannedDistanceNm).toBe(1200);
    expect(a.distance.distanceToGoNm).toBe(1100);
    expect(a.distance.progressPct).toBe(8.333);
    expect(a.distance.remainingPct).toBe(91.667);
  });

  it("computes the slip analysis", () => {
    expect(a.slip.slipPct).toBe(4.887);
    expect(a.slip.theoreticalSpeedKnots).toBe(14.877);
    expect(a.slip.actualSpeedKnots).toBe(14.15);
  });

  it("computes RPM deviation from design", () => {
    expect(a.rpm.rpm).toBe(82);
    expect(a.rpm.designRpm).toBe(84);
    expect(a.rpm.deviationFromDesignPct).toBe(-2.381);
    expect(a.rpm.atReference).toBe(false);
  });

  it("computes speed deviations and slow steaming flag", () => {
    expect(a.speed.speedKnots).toBe(14.2);
    expect(a.speed.deviationFromDesignPct).toBe(-2.069);
    expect(a.speed.deviationFromPlannedPct).toBe(-2.069);
    expect(a.speed.slowSteaming).toBe(false);
  });

  it("has no waiting or port state at sea", () => {
    expect(a.waiting).toBeNull();
    expect(a.port!.inPort).toBe(false);
    expect(a.port!.destinationPort).toBe("ROTTERDAM");
  });

  it("predicts the arrival, remaining consumption and ROB", () => {
    expect(a.prediction.arrivalDate).toBe("2026-08-04T17:44:20.400Z");
    expect(a.prediction.remainingConsumptionTonnes).toBe(104.948);
    expect(a.prediction.predictedArrivalRobTonnes).toBe(755.052);
    expect(a.prediction.confidence).toBe(0.8);
  });

  it("records no deviations for a clean at-sea report", () => {
    expect(a.deviations.length).toBe(0);
  });

  it("builds the deterministic dedup key", () => {
    expect(a.dedupKey).toBe("2026-08-01T12:00:00.000Z|10.5|106.8|32.4|860|14.2|82");
    expect(buildNoonDedupKey(mockNoonReportDomain())).toBe(a.dedupKey);
  });
});

describe("analyzeNoonReport — null previous report", () => {
  const a = analyze(mockNoonReportDomain(), { previous: null });

  it("nulls all previous-derived consumption fields", () => {
    expect(a.consumption.sinceLastReportTonnes).toBeNull();
    expect(a.consumption.intervalDays).toBeNull();
    expect(a.consumption.rateTonnesPerDay).toBeNull();
    expect(a.consumption.trendPct).toBeNull();
    expect(a.consumption.totalTonnes).toBe(32.4);
  });

  it("nulls voyage made good and lowers its confidence", () => {
    expect(a.voyage.distanceMadeGoodNm).toBeNull();
    expect(a.voyage.speedMadeGoodKnots).toBeNull();
    expect(a.voyage.confidence).toBe(0.2);
  });

  it("still resolves endurance off the raw consumption rate fallback", () => {
    expect(a.remainingOnBoard.enduranceDays).toBeNull();
  });

  it("uses the reported speed as the slip actual", () => {
    expect(a.slip.theoreticalSpeedKnots).toBe(14.877);
    expect(a.slip.actualSpeedKnots).toBe(14.2);
    expect(a.slip.slipPct).toBeTruthy();
  });

  it("nulls the prediction's consumption figures but keeps the arrival", () => {
    expect(a.prediction.arrivalDate).toBeTruthy();
    expect(a.prediction.remainingConsumptionTonnes).toBeNull();
    expect(a.prediction.predictedArrivalRobTonnes).toBeNull();
    expect(a.prediction.confidence).toBe(0.2);
  });
});

describe("analyzeNoonReport — missing engine reference", () => {
  const a = analyze(mockNoonReportDomain(), { engineReference: null });

  it("nulls engine load and design flags", () => {
    expect(a.engine.loadPct).toBeNull();
    expect(a.engine.atDesign).toBeNull();
  });

  it("nulls slip and RPM deviation", () => {
    expect(a.slip.theoreticalSpeedKnots).toBeNull();
    expect(a.slip.slipPct).toBeNull();
    expect(a.slip.confidence).toBe(0.2);
    expect(a.rpm.deviationFromDesignPct).toBeNull();
    expect(a.rpm.atReference).toBeNull();
  });

  it("nulls speed deviations from design and slow steaming", () => {
    expect(a.speed.deviationFromDesignPct).toBeNull();
    expect(a.speed.slowSteaming).toBeNull();
  });
});

describe("analyzeNoonReport — missing voyage plan", () => {
  const a = analyze(mockNoonReportDomain(), { voyagePlan: null });

  it("nulls planned-distance progress", () => {
    expect(a.distance.plannedDistanceNm).toBeNull();
    expect(a.distance.progressPct).toBeNull();
    expect(a.distance.remainingPct).toBeNull();
  });

  it("nulls planned-speed deviations", () => {
    expect(a.speed.plannedSpeedKnots).toBeNull();
    expect(a.speed.deviationFromPlannedPct).toBeNull();
  });

  it("drops the destination port", () => {
    expect(a.port!.destinationPort).toBeNull();
  });
});

describe("analyzeNoonReport — deterministic deviations", () => {
  it("flags consumption that does not match the ROB delta", () => {
    const a = analyze(mockNoonReportDomain({ fuelConsumptionTonnes: 46.2 }));
    const d = a.deviations.find((x) => x.kind === "CONSUMPTION");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("HIGH");
    expect(d!.actual).toBe(32.4);
    expect(d!.expected).toBe(46.2);
    expect(d!.deviationPct).toBe(-29.87);
  });

  it("flags speed well below the planned speed", () => {
    const a = analyze(mockNoonReportDomain({ speedKnots: 11, engineRpm: 74 }));
    const d = a.deviations.find((x) => x.kind === "SPEED");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("HIGH");
    expect(d!.deviationPct).toBe(-24.138);
  });

  it("flags RPM outside the design band", () => {
    const a = analyze(mockNoonReportDomain({ engineRpm: 90 }));
    const d = a.deviations.find((x) => x.kind === "RPM");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("HIGH");
    expect(d!.deviationPct).toBe(7.143);
  });

  it("warns on moderate apparent slip", () => {
    const a = analyze(mockNoonReportDomain({ engineRpm: 90, speedKnots: 15.8, fuelConsumptionTonnes: 46.2 }));
    const d = a.deviations.find((x) => x.kind === "SLIP");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("WARNING");
    expect(d!.deviationPct).toBe(13.339);
  });

  it("flags severe apparent slip as HIGH", () => {
    const a = analyze(mockNoonReportDomain({ engineRpm: 100 }));
    const d = a.deviations.find((x) => x.kind === "SLIP");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("HIGH");
  });

  it("flags a predicted arrival more than 6 h late", () => {
    const a = analyze(
      mockNoonReportDomain({ distanceToGoNm: 3000, speedKnots: 5, fuelConsumptionTonnes: 12, fuelRobsTonnes: 400 }),
    );
    const d = a.deviations.find((x) => x.kind === "ARRIVAL");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("HIGH");
  });

  it("flags a negative predicted arrival ROB as CRITICAL", () => {
    const a = analyze(mockNoonReportDomain({ distanceToGoNm: 50000, fuelRobsTonnes: 300 }));
    const d = a.deviations.find((x) => x.kind === "ROB");
    expect(d).toBeTruthy();
    expect(d!.severity).toBe("CRITICAL");
    expect(d!.reason).toContainString("negative");
  });
});

describe("analyzeNoonReport — in-port report", () => {
  const a = analyze(
    mockNoonReportDomain({
      speedKnots: 0,
      engineRpm: 0,
      distanceToGoNm: 0,
      positionLatitude: 51.945,
      positionLongitude: 4.1277,
      seaState: "CALM",
    }),
  );

  it("resolves the operational state to IN_PORT", () => {
    expect(a.operationalState).toBe("IN_PORT");
    expect(a.port!.inPort).toBe(true);
    expect(a.waiting).toBeTruthy();
    expect(a.waiting!.stationary).toBe(true);
  });

  it("nulls slip when the theoretical speed is zero", () => {
    expect(a.slip.slipPct).toBeNull();
    expect(a.slip.theoreticalSpeedKnots).toBe(0);
  });
});

run();
