/**
 * noon-report/index.ts — public barrel for the Noon Report Intelligence module
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   import { analyzeNoonReport, NoonReportService } from "@/lib/noon-report";
 */

export { NOON_REPORT_VERSION, NOON_REPORT_ENGINE_VERSION } from "./types";
export type {
  NoonReportStatus,
  NoonReportDomain,
  NoonReportExtractionInput,
  NoonReportParsed,
  EngineReference,
  VoyagePlanInput,
  FuelAttributionInput,
  NoonReportEngineInput,
  OperationalState,
  ConsumptionSummary,
  FuelConsumptionBreakdown,
  RemainingOnBoard,
  EnginePerformance,
  WeatherState,
  VoyageProgress,
  DistanceProgress,
  SlipAnalysis,
  RPMAnalysis,
  SpeedAnalysis,
  WaitingState,
  PortOperations,
  DeviationKind,
  DeviationSeverity,
  DeviationAnalysis,
  ConsumptionPrediction,
  NoonReportAnalysis,
  NoonFindingSeverity,
  NoonFindingCategory,
  NoonFinding,
  NoonValidatorResult,
  NoonFuelCorrelation,
  NoonVoyageCorrelation,
  NoonFuelEuOperationalInput,
  NoonEtsOperationalInput,
  NoonReportRow,
  NoonReportInsert,
  NoonReportUpdate,
} from "./types";

export {
  parseNoonReportExtraction,
  noonReportFromRow,
  NOON_REQUIRED_FIELDS,
  toFiniteNumber,
  toTrimmedString,
} from "./parser";

export {
  analyzeNoonReport,
  resolveOperationalState,
  haversineNm,
  hoursBetween,
  round3,
  buildNoonDedupKey,
} from "./engine";

export { validateNoonReport } from "./validator";
export type { NoonValidatorInput } from "./validator";

export { correlateNoonFuel } from "./fuel-correlation";
export type { FuelDeliveryLike, NoonFuelCorrelationInput } from "./fuel-correlation";

export { correlateNoonVoyage } from "./voyage-correlation";
export type { NoonVoyageCorrelationInput } from "./voyage-correlation";

export { correlateNoonFuelEu } from "./fueleu-correlation";
export type { NoonFuelEuCorrelationInput } from "./fueleu-correlation";

export { correlateNoonEts } from "./ets-correlation";
export type { NoonEtsCorrelationInput } from "./ets-correlation";

export {
  buildNoonNotifications,
  noonNotificationTypeForFinding,
  findingToNotificationSeverity,
} from "./notifications";
export type { NoonNotificationInput } from "./notifications";

export { NoonReportService } from "./service";
export type {
  NoonReportRepository,
  NoonServiceDeps,
  NoonCreateOptions,
  NoonEvaluateOptions,
  NoonEvaluateOutcome,
} from "./service";

export {
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockEngineReference,
  mockVoyagePlan,
  MOCK_IMO,
  MOCK_VESSEL_NAME,
  MOCK_VESSEL_ID,
  MOCK_DESTINATION,
} from "./mock-data";
