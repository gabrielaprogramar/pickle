/**
 * index.ts — public barrel export for the AI module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One clean import path for everything downstream:
 *
 *   import { getAiProvider, AiProvider } from "@/lib/ai";
 */

// Provider factory.
export { getAiProvider, createAiProvider } from "./provider";
export type { AiProvider } from "./types";

// Types.
export type {
  AiExtractionInput,
  AiExtractionResult,
  AiExtractionStatus,
  AiTokenUsage,
  AiProviderMetadata,
} from "./types";

// Prompts.
export { getExtractionPrompt, EXTRACTION_PROMPTS } from "./prompts";
export type { ExtractionPrompt } from "./prompts";

// Mock provider (exported for tests).
export { createMockAiProvider, MOCK_AI_FIXTURES } from "./mock-provider";

// OpenAI provider.
export { createOpenAiProvider } from "./openai-provider";
export type { OpenAiProviderConfig } from "./openai-provider";

// OpenAI errors.
export {
  OpenAiError,
  OpenAiConfigError,
  OpenAiAuthError,
  OpenAiApiError,
  OpenAiTimeoutError,
  OpenAiRateLimitError,
  OpenAiInvalidResponseError,
} from "./openai-errors";
