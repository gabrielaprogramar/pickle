/**
 * provider.ts — AI provider factory (mock/real seam)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Single entry point for obtaining an AI provider. Reads the AI_USE_MOCK flag
 * and returns either the mock or real OpenAI implementation. Follows the same
 * pattern as ocr/provider.ts and storage/client.ts.
 *
 * HOW IT FITS
 * The extraction service calls getAiProvider() and invokes provider.extract().
 * The factory is the only place that knows which implementation is active.
 */

import { createMockAiProvider } from "./mock-provider";
import type { AiProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

let cached: AiProvider | null = null;

/**
 * Returns the process-wide AI provider, building it on first call.
 * In mock mode, returns a deterministic mock provider.
 * In live mode, creates an OpenAI GPT-4o provider.
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const useMock = parseBoolean(process.env.AI_USE_MOCK, true);

  if (useMock) {
    cached = createMockAiProvider();
  } else {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
    if (!apiKey) {
      // Fallback to mock if no API key is set.
      cached = createMockAiProvider();
    } else {
      // Lazy-import to avoid loading openai in mock mode.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createOpenAiProvider } = require("./openai-provider") as {
          createOpenAiProvider: typeof import("./openai-provider").createOpenAiProvider;
        };
        cached = createOpenAiProvider({
          apiKey,
          model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
        });
      } catch {
        cached = createMockAiProvider();
      }
    }
  }

  return cached;
}

/**
 * Create a fresh AI provider (for tests / DI).
 */
export function createAiProvider(): AiProvider {
  return createMockAiProvider();
}

/**
 * Test helper: reset the cached singleton.
 */
export function _resetAiProviderForTest(): void {
  cached = null;
}
