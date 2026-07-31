export type {
  VoyageVessel,
  VoyageContext,
  VoyageRequest,
  VoyageAnswer,
  AisGapTier,
  VoyageClassification,
  VoyagePortRef,
  VoyageRecord,
  AisPosition,
  AisGap,
  PortCall,
  GreenZoneEncounter,
  Violation,
  VoyageComplianceContext,
  ManualVoyageDraft,
  AisSyncRequest,
  VoyageDataGapSummary,
  VoyageMemoryEntry,
} from "./types";

export { VOYAGE_ASSISTANT_VERSION, VOYAGE_SYSTEM_PROMPT_VERSION } from "./types";

export type { VoyageScenarioKey, VoyageMockState, VoyagePortEntry } from "./mock-data";
export {
  createMockVoyageState,
  AURELIA,
  VOYAGE_MOCK_NOW,
  VOYAGE_MOCK_VESSELS,
  VOYAGE_PORT_REGISTRY,
  getVoyagePort,
} from "./mock-data";

export type {
  GapClassification,
} from "./gap-ladder";
export {
  classifyGapDuration,
  worstTier,
  coveragePct,
  summarizeGaps,
  formatGapLadder,
  TIER_ORDER,
  GAP_FLAGGED_FROM_MINUTES,
  GAP_MANUAL_FROM_MINUTES,
  GAP_CRITICAL_FROM_MINUTES,
} from "./gap-ladder";

export type {
  VoyageToolContext,
  VoyageToolResult,
  VoyageToolRegistry,
} from "./voyage-tools";
export {
  createVoyageToolRegistry,
  assertVoyageScope,
  validateVoyageToolInput,
  VoyageVesselScopeError,
  VOYAGE_TOOL_DEFINITIONS,
  VOYAGE_TOOL_NAMES,
  TOOL_GET_VOYAGE_LOG,
  TOOL_GET_AIS_POSITIONS,
  TOOL_GET_DATA_GAPS,
  TOOL_GET_PORT_INFO,
  TOOL_EXPLAIN_VIOLATION,
  TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT,
  TOOL_DRAFT_MANUAL_VOYAGE,
  TOOL_QUEUE_AIS_SYNC,
} from "./voyage-tools";

export type { VoyageHandoffDecision, VoyageHandoffDetector } from "./handoff";
export { createVoyageHandoffDetector } from "./handoff";

export type { VoyageSafetyCheck, VoyageSafetyGuard } from "./safety";
export { createVoyageSafetyGuard } from "./safety";

export type { VoyageSystemPromptInput } from "./system-prompt";
export { buildVoyageSystemPrompt } from "./system-prompt";

export type { VoyageMemory } from "./memory";
export { createVoyageMemory } from "./memory";

export type { VoyageService, VoyageServiceOptions } from "./voyage-service";
export { createVoyageService } from "./voyage-service";
