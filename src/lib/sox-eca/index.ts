/**
 * sox-eca/index.ts — public barrel for the Med SOx ECA / BDN sulphur watch
 */

export { SOX_ECA_VERSION, SOX_PARAMETER_VERSION } from "./types";
export type {
  EvidenceStatus,
  WatchStatus,
  WatchSeverity,
  ZoneState,
  SoxEventType,
  SoxRuleId,
  SoxRuleResultKind,
  SoxRuleResult,
  SoxEvidenceSource,
  BunkerEvidenceSelection,
  SoxEvaluationInput,
  SoxEvaluationResult,
  SoxComplianceEvent,
  SoxComplianceEventInsert,
  SoxWatchState,
  SoxWatchStateInsert,
} from "./types";

export {
  GLOBAL_SULPHUR_LIMIT_PCT,
  ECA_SULPHUR_LIMIT_PCT,
  MED_SOX_ECA_CODE,
  MED_SOX_ECA_EFFECTIVE_DATE,
  MED_SOX_ECA_EFFECTIVE_FROM,
  SOX_PARAMETER_SET,
  isMedSoxEcaEffective,
  getApplicableSulphurLimit,
  isSulphurConforming,
  formatSulphurLimit,
} from "./parameters";

export {
  evidenceFromFuelDelivery,
  selectBunkerEvidence,
} from "./evidence";

export {
  toEnvironmentalZone,
  hasUsableGeometry,
  isMedSoxZone,
  isInsideZone,
  computeZoneState,
} from "./zone";

export { evaluateSox, buildDedupKey } from "./engine";

export { createMockSoxScenario, SOX_MOCK_SCENARIOS, isSoxMockScenarioKey } from "./mock-data";
export type { SoxMockScenarioKey, SoxMockScenario } from "./mock-data";
export {
  SOX_MOCK_NOW,
  SOX_MOCK_VESSEL,
  SOX_MOCK_ZONE,
  SOX_POSITION_INSIDE,
  SOX_POSITION_OUTSIDE,
} from "./mock-data";

export { SoxComplianceService } from "./service";
export type {
  SoxComplianceRepository,
  SoxServiceDeps,
  EvaluateOptions,
  EvaluateOutcome,
} from "./service";

export {
  buildSoxNotification,
  soxNotificationTypeForEvent,
} from "./notifications";
export type { SoxNotificationInput } from "./notifications";

export {
  captainSoxReadiness,
  captainReadinessText,
  complianceSoxExplanation,
  soxSearchPhrases,
} from "./handoff";
export type { SoxHandoffStatement, SoxHandoffTarget } from "./handoff";
