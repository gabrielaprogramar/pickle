export { buildComplianceSystemPrompt, COMPLIANCE_ASSISTANT_VERSION } from "./system-prompt";
export type { SystemPromptInput } from "./system-prompt";

export { createComplianceResponseBuilder } from "./response-templates";
export type { ComplianceAnswer, ComplianceResponseBuilder } from "./response-templates";

export { createHandoffDetector } from "./handoff";
export type { HandoffDecision, HandoffTarget, HandoffDetector } from "./handoff";

export { createComplianceAssistantService, createMockComplianceAssistantService } from "./compliance-service";
export type { ComplianceAssistantService, ComplianceAssistantOptions } from "./compliance-service";
