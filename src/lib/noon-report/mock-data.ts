/**
 * noon-report/mock-data.ts — deterministic fixtures for tests & demo
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Values are fixed so tests are reproducible. All times are UTC noon.
 */

import type {
  EngineReference,
  NoonReportDomain,
  VoyagePlanInput,
} from "./types";

export const MOCK_IMO = "9488754";
export const MOCK_VESSEL_NAME = "POSEIDON PIONEER";
export const MOCK_VESSEL_ID = "vessel-noon-001";
export const MOCK_DESTINATION = "ROTTERDAM";

export function mockEngineReference(): EngineReference {
  return {
    designRpm: 84,
    designSpeedKnots: 14.5,
    propellerPitchMeters: 5.6,
    maxContinuousRatingKw: 12000,
  };
}

export function mockVoyagePlan(): VoyagePlanInput {
  return {
    plannedDistanceNm: 1200,
    plannedSpeedKnots: 14.5,
    plannedArrival: "2026-08-06T12:00:00.000Z",
    departurePort: "SINGAPORE",
    destinationPort: MOCK_DESTINATION,
  };
}

export function mockNoonReportDomain(
  overrides: Partial<NoonReportDomain> = {},
): NoonReportDomain {
  return {
    id: "noon-001",
    vesselId: MOCK_VESSEL_ID,
    imo: MOCK_IMO,
    vesselName: MOCK_VESSEL_NAME,
    reportDate: "2026-08-01T12:00:00.000Z",
    positionLatitude: 10.5,
    positionLongitude: 106.8,
    speedKnots: 14.2,
    courseDegrees: 295,
    distanceToGoNm: 1100,
    fuelConsumptionTonnes: 32.4,
    fuelRobsTonnes: 860,
    engineRpm: 82,
    seaState: "MODERATE",
    windSpeedKnots: 18,
    windDirection: "NE",
    summary: "All systems normal. Main engine running at service speed.",
    warnings: [],
    confidence: 0.94,
    source: "ai_extraction",
    sourceDocumentId: null,
    reviewState: null,
    isBlocked: false,
    ...overrides,
  };
}

export function mockPreviousNoonReport(): NoonReportDomain {
  return mockNoonReportDomain({
    id: "noon-000",
    reportDate: "2026-07-31T12:00:00.000Z",
    positionLatitude: 8.12,
    positionLongitude: 112.0,
    speedKnots: 14.4,
    courseDegrees: 296,
    distanceToGoNm: 1170,
    fuelConsumptionTonnes: 33.1,
    fuelRobsTonnes: 892.4,
    engineRpm: 84,
  });
}
