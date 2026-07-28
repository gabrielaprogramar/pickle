/**
 * index.ts — public barrel export for the OCR module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One clean import path for everything downstream:
 *
 *   import { getOcrProvider, OcrProvider } from "@/lib/ocr";
 */

// Provider factory.
export { getOcrProvider, createOcrProvider } from "./provider";
export type { OcrProvider } from "./types";

// Types.
export type {
  OcrResult,
  BdnExtractedData,
  CiiExtractedData,
  EuEtsExtractedData,
  FuelEuExtractedData,
} from "./types";

// Mock provider (exported for tests).
export { createMockOcrProvider, MOCK_FIXTURES } from "./mock-provider";
