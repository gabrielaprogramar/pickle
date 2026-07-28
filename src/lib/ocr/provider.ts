/**
 * provider.ts — OCR provider factory (mock/real seam)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Single entry point for obtaining an OcrProvider. Reads the OCR_USE_MOCK flag
 * and returns either the mock or real implementation. Follows the same pattern
 * as storage/client.ts and supabase/client.ts.
 *
 * HOW IT FITS
 * The document processing pipeline calls getOcrProvider() and invokes
 * provider.extract(). The factory is the only place that knows which
 * implementation is active.
 */

import { createMockOcrProvider } from "./mock-provider";
import type { OcrProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

let cached: OcrProvider | null = null;

/**
 * Returns the process-wide OCR provider, building it on first call.
 * In mock mode, returns a deterministic mock provider.
 */
export function getOcrProvider(): OcrProvider {
  if (cached) return cached;

  const useMock = parseBoolean(process.env.OCR_USE_MOCK, true);

  if (useMock) {
    cached = createMockOcrProvider();
  } else {
    // Future: plug in a real OCR provider (e.g. Google Vision, AWS Textract).
    // For now, always fall back to mock until a real implementation exists.
    cached = createMockOcrProvider();
  }

  return cached;
}

/**
 * Create a fresh OCR provider (for tests / DI).
 */
export function createOcrProvider(): OcrProvider {
  return createMockOcrProvider();
}

/**
 * Test helper: reset the cached singleton.
 */
export function _resetOcrProviderForTest(): void {
  cached = null;
}
