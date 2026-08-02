/**
 * noon-assistant/mock-data.ts — deterministic fixtures for the Noon Assistant
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Snapshots are produced by running the real (pure, deterministic) noon
 * engines on fixed mock reports, so the assistant answers match the actual
 * pipeline output byte-for-byte across test runs.
 */

import {
  MOCK_DESTINATION,
  MOCK_IMO,
  MOCK_VESSEL_ID,
  MOCK_VESSEL_NAME,
  analyzeNoonReport,
  correlateNoonEts,
  correlateNoonFuel,
  correlateNoonFuelEu,
  correlateNoonVoyage,
  mockEngineReference,
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockVoyagePlan,
  validateNoonReport,
} from "@/lib/noon-report";
import type {
  NoonFinding,
  NoonReportDomain,
} from "@/lib/noon-report";
import type {
  NoonAssistantState,
  NoonReportSnapshot,
  NoonVessel,
} from "./types";

export type NoonScenarioKey =
  | "clean-at-sea"
  | "heavy-weather"
  | "high-consumption"
  | "behind-schedule"
  | "low-confidence"
  | "in-port";

export const NOON_MOCK_NOW = "2026-08-01T13:00:00.000Z";

export const NOON_MOCK_VESSELS: ReadonlyArray<NoonVessel> = [
  { vesselId: MOCK_VESSEL_ID, name: MOCK_VESSEL_NAME, imo: MOCK_IMO },
  { vesselId: "vsl-serenity", name: "Serenity", imo: "9384711" },
  { vesselId: "vsl-marguerite", name: "Marguerite", imo: "9612358" },
];

export const POSEIDON: NoonVessel = NOON_MOCK_VESSELS[0]!;

const ENGINE_REFERENCE = mockEngineReference();
const VOYAGE_PLAN = mockVoyagePlan();

function buildSnapshot(
  report: NoonReportDomain,
  previous: NoonReportDomain,
): NoonReportSnapshot {
  const fuel = correlateNoonFuel({ report, previous, deliveries: [] });
  const analysis = analyzeNoonReport({
    report,
    vessel: { vesselId: MOCK_VESSEL_ID, imo: MOCK_IMO, name: MOCK_VESSEL_NAME },
    previous,
    engineReference: ENGINE_REFERENCE,
    voyagePlan: VOYAGE_PLAN,
    fuelAttribution: fuel.attribution.length > 0 ? fuel.attribution : null,
    now: NOON_MOCK_NOW,
  });
  const validator = validateNoonReport({ report, analysis });
  const voyage = correlateNoonVoyage({ report, previous, analysis, voyagePlan: VOYAGE_PLAN });
  const fueleu = correlateNoonFuelEu({ report, analysis });
  const ets = correlateNoonEts({ report, analysis });

  const findings: NoonFinding[] = [
    ...validator.findings,
    ...fuel.findings,
    ...voyage.findings,
    ...fueleu.findings,
    ...ets.findings,
  ];

  return { report, analysis, validator, fuel, voyage, fueleu, ets, findings };
}

function buildState(latestDomain: NoonReportDomain): NoonAssistantState {
  const previous = mockPreviousNoonReport();
  const reports: NoonReportDomain[] = [latestDomain, previous];
  const latest = buildSnapshot(latestDomain, previous);
  return {
    vessel: POSEIDON,
    reports,
    latest,
  };
}

export function createMockNoonState(scenario: NoonScenarioKey): NoonAssistantState {
  switch (scenario) {
    case "heavy-weather":
      return buildState(
        mockNoonReportDomain({
          id: "noon-heavy",
          windSpeedKnots: 34,
          seaState: "ROUGH",
          windDirection: "SW",
          summary: "Heavy weather encountered overnight.",
        }),
      );

    case "high-consumption":
      return buildState(
        mockNoonReportDomain({
          id: "noon-high-consumption",
          fuelConsumptionTonnes: 46.2,
          speedKnots: 15.8,
          engineRpm: 90,
          summary: "Higher than typical daily consumption observed.",
        }),
      );

    case "behind-schedule":
      return buildState(
        mockNoonReportDomain({
          id: "noon-behind",
          distanceToGoNm: 1240,
          speedKnots: 11.0,
          engineRpm: 74,
          summary: "Vessel is behind the planned arrival schedule.",
        }),
      );

    case "low-confidence":
      return buildState(
        mockNoonReportDomain({
          id: "noon-low-confidence",
          confidence: 0.42,
          summary: null,
          seaState: null,
          windSpeedKnots: null,
          warnings: ["noon.parser: seaState missing — value rejected"],
        }),
      );

    case "in-port":
      return buildState(
        mockNoonReportDomain({
          id: "noon-port",
          speedKnots: 0,
          engineRpm: 0,
          seaState: "CALM",
          distanceToGoNm: 0,
          positionLatitude: 51.945,
          positionLongitude: 4.1277,
          summary: "Alongside in Rotterdam.",
        }),
      );

    case "clean-at-sea":
    default:
      return buildState(mockNoonReportDomain());
  }
}

/** Short human label for a scenario, used by the assistant service. */
export function scenarioLabel(scenario: NoonScenarioKey): string {
  switch (scenario) {
    case "heavy-weather":
      return "heavy weather";
    case "high-consumption":
      return "high consumption";
    case "behind-schedule":
      return "behind schedule";
    case "low-confidence":
      return "low data confidence";
    case "in-port":
      return "in port";
    default:
      return "clean at sea";
  }
}

/** Destination label used in assistant copy. */
export function noonDestinationLabel(): string {
  return MOCK_DESTINATION;
}
