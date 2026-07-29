export { getOcrProvider, createOcrProvider } from "./provider";
export type { OcrProvider } from "./types";

export type {
  OcrResult,
  BdnExtractedData,
  CiiExtractedData,
  EuEtsExtractedData,
  FuelEuExtractedData,
} from "./types";

export { createMockOcrProvider, MOCK_FIXTURES } from "./mock-provider";

export { createGoogleDocAiOcrProvider, loadGoogleDocAiConfig } from "./google-docai";
export type { GoogleDocAiConfig, GoogleServiceAccountCredentials } from "./google-docai";

export {
  GoogleOcrError,
  GoogleOcrConfigError,
  GoogleOcrAuthError,
  GoogleOcrApiError,
  GoogleOcrTimeoutError,
  GoogleOcrRateLimitError,
  GoogleOcrInvalidResponseError,
} from "./errors";
