export { AI_ASSISTANT_VERSION } from "./types";
export type {
  RegulatoryCitation,
  CitationGroup,
  RegulatorySearchInput,
  RegulatorySearchResult,
  ToolCategory,
  ToolPermission,
  ToolDefinition,
  ToolCallRequest,
  ToolCallResult,
  ToolCallRecord,
  ModelProviderType,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  IntentType,
  IntentClassification,
  RouterInput,
  RouterOutput,
  SafetyCheckResult,
  AssistantResponse,
  EvaluationResult,
  ConversationContext,
} from "./types";

export { createMockKnowledgeBase } from "./mock-knowledge";
export type { MockKnowledgeBase } from "./mock-knowledge";

export { createRegulatorySearchService } from "./regulatory-search";
export type { RegulatorySearchService, RegulatorySearchServiceOptions } from "./regulatory-search";

export { createCitationService } from "./citations";
export type { CitationService } from "./citations";

export {
  createStructuredToolService,
  createMockStructuredToolService,
  TOOL_GET_VESSEL_COMPLIANCE_SCORE,
  TOOL_GET_FLEET_ETS_SUMMARY,
  TOOL_GET_OPEN_VIOLATIONS,
  TOOL_GET_FUEL_DELIVERIES,
  TOOL_GET_VOYAGE_LOG,
  TOOL_GET_MONITORING_PLAN_GAPS,
  TOOL_LOOKUP_EMISSION_FACTOR,
  TOOL_GET_DEADLINES,
  TOOL_GET_COMPLIANCE_REPORTS,
  TOOL_GET_VESSEL_INFO,
} from "./structured-tools";
export type { StructuredToolService, StructuredToolContext } from "./structured-tools";

export { createToolGateway } from "./tool-gateway";
export type { ToolGateway, ToolGatewayOptions } from "./tool-gateway";

export { createSafetyLayer, STANDARD_DISCLAIMER } from "./safety";
export type { SafetyLayer, SafetyLayerOptions } from "./safety";

export { createMockLlmProvider, createRealLlmProvider, createLlmProviderRegistry } from "./llm-provider";
export type { LlmProvider, MockLlmProviderOptions, RealProviderConfig, LlmProviderRegistry } from "./llm-provider";

export { createConversationService } from "./conversation-service";
export type { ConversationService, ConversationServiceOptions } from "./conversation-service";

export { createRouter } from "./router";
export type { Router, RouterOptions } from "./router";

export { createEvaluationHarness } from "./evaluation";
export type { EvaluationHarness, EvaluationHarnessOptions } from "./evaluation";

export { createAssistantService } from "./assistant-service";
export type { AssistantService, AssistantServiceOptions } from "./assistant-service";
