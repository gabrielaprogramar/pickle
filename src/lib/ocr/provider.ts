import { createMockOcrProvider } from "./mock-provider";
import { createGoogleDocAiOcrProvider, loadGoogleDocAiConfig } from "./google-docai";
import type { OcrProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

let cached: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cached) return cached;

  const useMock = parseBoolean(process.env.OCR_USE_MOCK, true);
  const googleOcrEnabled = parseBoolean(process.env.GOOGLE_OCR_ENABLED, false);

  if (useMock) {
    cached = createMockOcrProvider();
  } else if (googleOcrEnabled) {
    const config = loadGoogleDocAiConfig();
    cached = createGoogleDocAiOcrProvider(config);
  } else {
    cached = createMockOcrProvider();
  }

  return cached;
}

export function createOcrProvider(): OcrProvider {
  return createMockOcrProvider();
}

export function _resetOcrProviderForTest(): void {
  cached = null;
}
