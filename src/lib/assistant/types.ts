export const AI_ASSISTANT_VERSION = "1.0.0";

export interface RegulatoryCitation {
  readonly source: string;
  readonly regulation: string;
  readonly article_section: string | null;
  readonly version: string;
  readonly chunk_id: string;
  readonly document_id: string;
  readonly relevance_score: number;
  readonly excerpt: string;
}

export interface CitationGroup {
  readonly regulation: string;
  readonly citations: ReadonlyArray<RegulatoryCitation>;
}

export interface RegulatorySearchInput {
  readonly question: string;
  readonly regulation?: string | null;
  readonly effective_date?: string | null;
  readonly max_results?: number;
}

export interface RegulatorySearchResult {
  readonly chunks: ReadonlyArray<{
    readonly id: string;
    readonly document_id: string;
    readonly content: string;
    readonly article_section: string | null;
    readonly heading: string | null;
    readonly source_title: string;
    readonly regulation: string;
    readonly version: string;
    readonly relevance_score: number;
  }>;
  readonly total: number;
}

export type ToolCategory = "compliance" | "voyage" | "document" | "regulatory" | "fleet" | "notification";

export type ToolPermission = "read" | "write";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly permission: ToolPermission;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
  readonly requiresConfirmation: boolean;
}

export interface ToolCallRequest {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly conversationId: string;
}

export interface ToolCallResult {
  readonly success: boolean;
  readonly data: unknown;
  readonly error?: string;
  readonly latencyMs: number;
}

export interface ToolCallRecord {
  readonly id: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly output: unknown;
  readonly success: boolean;
  readonly error: string | null;
  readonly latencyMs: number;
  readonly timestamp: string;
}

export type ModelProviderType = "mock" | "openai" | "anthropic" | "custom";

export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmRequest {
  readonly messages: ReadonlyArray<LlmMessage>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LlmResponse {
  readonly content: string;
  readonly model: string;
  readonly provider: ModelProviderType;
  readonly latencyMs: number;
  readonly tokenCount?: number;
}

export type IntentType =
  | "REGULATORY"
  | "COMPLIANCE"
  | "VOYAGE"
  | "DOCUMENT"
  | "SEARCH"
  | "CAPTAIN"
  | "UNKNOWN";

export interface IntentClassification {
  readonly intent: IntentType;
  readonly confidence: number;
  readonly subcategories: ReadonlyArray<string>;
}

export interface RouterInput {
  readonly query: string;
  readonly conversationHistory?: ReadonlyArray<LlmMessage>;
}

export interface RouterOutput {
  readonly intent: IntentType;
  readonly confidence: number;
  readonly specialistRequired: boolean;
}

export interface SafetyCheckResult {
  readonly passed: boolean;
  readonly warnings: ReadonlyArray<string>;
  readonly violations: ReadonlyArray<string>;
}

export interface AssistantResponse {
  readonly content: string;
  readonly citations: ReadonlyArray<RegulatoryCitation>;
  readonly toolCalls: ReadonlyArray<ToolCallRecord>;
  readonly disclaimer: string;
  readonly safetyCheck: SafetyCheckResult;
}

export interface EvaluationResult {
  readonly testName: string;
  readonly assistantType: string;
  readonly query: string;
  readonly response: string | null;
  readonly citationAccuracy: number | null;
  readonly retrievalPrecision: number | null;
  readonly hallucinationFlag: boolean;
  readonly toolSelectionAccuracy: number | null;
  readonly responseLatencyMs: number | null;
  readonly noMathLeakViolation: boolean;
}

export interface ConversationContext {
  readonly conversationId: string;
  readonly userId: string;
  readonly organizationId: string | null;
  readonly messages: ReadonlyArray<unknown>;
  readonly metadata: Record<string, unknown>;
}
