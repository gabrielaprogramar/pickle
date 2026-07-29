/**
 * provider.ts — validation provider factory (mock/real seam)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Single entry point for obtaining a validation provider. Reads the
 * VALIDATION_USE_MOCK flag and returns either the mock or real implementation.
 * Follows the same pattern as ai/provider.ts and ocr/provider.ts.
 *
 * HOW IT FITS
 * The validation service calls getValidationProvider() and invokes
 * provider.validate(). The factory is the only place that knows which
 * implementation is active.
 */

import { createMockValidator } from "./mock-validator";
import { createValidator } from "./validator";
import type { ValidationProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

let cached: ValidationProvider | null = null;

/**
 * Returns the process-wide validation provider, building it on first call.
 * In mock mode, returns a deterministic mock provider.
 * In live mode, creates the real rules-based validator.
 */
export function getValidationProvider(): ValidationProvider {
  if (cached) return cached;

  const useMock = parseBoolean(process.env.VALIDATION_USE_MOCK, true);

  if (useMock) {
    cached = createMockValidator();
  } else {
    cached = createValidator();
  }

  return cached;
}

/**
 * Create a fresh validation provider (for tests / DI).
 */
export function createValidationProvider(): ValidationProvider {
  return createMockValidator();
}

/**
 * Test helper: reset the cached singleton.
 */
export function _resetValidationProviderForTest(): void {
  cached = null;
}
