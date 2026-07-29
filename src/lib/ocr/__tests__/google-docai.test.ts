import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  GoogleOcrError,
  GoogleOcrConfigError,
  GoogleOcrAuthError,
  GoogleOcrApiError,
  GoogleOcrTimeoutError,
  GoogleOcrRateLimitError,
  GoogleOcrInvalidResponseError,
} from "../errors";
import { loadGoogleDocAiConfig, createGoogleDocAiOcrProvider } from "../google-docai";
import type { GoogleDocAiConfig } from "../google-docai";

const MOCK_CREDENTIALS = JSON.stringify({
  type: "service_account",
  project_id: "test-proj",
  private_key_id: "key123",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
  client_email: "test@test.iam.gserviceaccount.com",
  client_id: "12345",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
});

const defaultConfig: GoogleDocAiConfig = {
  projectId: "test-project",
  location: "us",
  processorId: "test-processor",
  credentials: {
    type: "service_account",
    project_id: "test-project",
    private_key_id: "key123",
    private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
    client_email: "test@test.iam.gserviceaccount.com",
    client_id: "12345",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  },
};

describe("GoogleOcrError hierarchy", () => {
  it("GoogleOcrConfigError is instanceof GoogleOcrError", () => {
    const err = new GoogleOcrConfigError("config err");
    expect(err instanceof GoogleOcrError).toBe(true);
    expect(err.name).toBe("GoogleOcrConfigError");
    expect(err.message).toBe("config err");
  });

  it("GoogleOcrAuthError is instanceof GoogleOcrError", () => {
    const err = new GoogleOcrAuthError("auth err");
    expect(err instanceof GoogleOcrError).toBe(true);
    expect(err.name).toBe("GoogleOcrAuthError");
  });

  it("GoogleOcrApiError carries status and body", () => {
    const err = new GoogleOcrApiError("api err", 500, { detail: "fail" });
    expect(err.status).toBe(500);
    expect(err.body).toEqual({ detail: "fail" });
    expect(err instanceof GoogleOcrError).toBe(true);
  });

  it("GoogleOcrTimeoutError is instanceof GoogleOcrError", () => {
    const err = new GoogleOcrTimeoutError("timeout");
    expect(err instanceof GoogleOcrError).toBe(true);
  });

  it("GoogleOcrRateLimitError is instanceof GoogleOcrError", () => {
    const err = new GoogleOcrRateLimitError("rate limit");
    expect(err instanceof GoogleOcrError).toBe(true);
  });

  it("GoogleOcrInvalidResponseError is instanceof GoogleOcrError", () => {
    const err = new GoogleOcrInvalidResponseError("invalid");
    expect(err instanceof GoogleOcrError).toBe(true);
  });

  it("GoogleOcrApiError with cause", () => {
    const cause = new Error("underlying");
    const err = new GoogleOcrApiError("wrapped", 0, undefined, cause);
    expect(err.cause).toBe(cause);
    expect(err.status).toBe(0);
  });
});

describe("loadGoogleDocAiConfig", () => {
  it("loads all fields from env vars", () => {
    const cfg = loadGoogleDocAiConfig({
      GOOGLE_OCR_PROJECT_ID: "my-project",
      GOOGLE_OCR_LOCATION: "europe-west1",
      GOOGLE_OCR_PROCESSOR_ID: "proc-1",
      GOOGLE_OCR_CREDENTIALS: MOCK_CREDENTIALS,
    });

    expect(cfg.projectId).toBe("my-project");
    expect(cfg.location).toBe("europe-west1");
    expect(cfg.processorId).toBe("proc-1");
    expect(cfg.credentials.client_email).toBe("test@test.iam.gserviceaccount.com");
  });

  it("uses default location 'us' when not set", () => {
    const cfg = loadGoogleDocAiConfig({
      GOOGLE_OCR_PROJECT_ID: "p",
      GOOGLE_OCR_PROCESSOR_ID: "pid",
      GOOGLE_OCR_CREDENTIALS: MOCK_CREDENTIALS,
    });
    expect(cfg.location).toBe("us");
  });

  it("reads credentials from GOOGLE_APPLICATION_CREDENTIALS file", () => {
    const cfg = loadGoogleDocAiConfig({
      GOOGLE_OCR_PROJECT_ID: "p",
      GOOGLE_OCR_PROCESSOR_ID: "pid",
      GOOGLE_APPLICATION_CREDENTIALS: "src/lib/ocr/__tests__/fixtures/test-credentials.json",
    });
    expect(cfg.credentials.client_email).toBe("test@fixtures.iam.gserviceaccount.com");
  });

  it("throws GoogleOcrConfigError when project ID missing", async () => {
    await expect(() =>
      loadGoogleDocAiConfig({
        GOOGLE_OCR_PROCESSOR_ID: "pid",
        GOOGLE_OCR_CREDENTIALS: MOCK_CREDENTIALS,
      }),
    ).toThrow(GoogleOcrConfigError);
  });

  it("throws GoogleOcrConfigError when processor ID missing", async () => {
    await expect(() =>
      loadGoogleDocAiConfig({
        GOOGLE_OCR_PROJECT_ID: "p",
        GOOGLE_OCR_CREDENTIALS: MOCK_CREDENTIALS,
      }),
    ).toThrow(GoogleOcrConfigError);
  });

  it("throws GoogleOcrConfigError when credentials missing", async () => {
    await expect(() =>
      loadGoogleDocAiConfig({
        GOOGLE_OCR_PROJECT_ID: "p",
        GOOGLE_OCR_PROCESSOR_ID: "pid",
      }),
    ).toThrow(GoogleOcrConfigError);
  });

  it("throws GoogleOcrConfigError when credentials JSON is invalid", async () => {
    await expect(() =>
      loadGoogleDocAiConfig({
        GOOGLE_OCR_PROJECT_ID: "p",
        GOOGLE_OCR_PROCESSOR_ID: "pid",
        GOOGLE_OCR_CREDENTIALS: "not-json",
      }),
    ).toThrow(GoogleOcrConfigError);
  });
});

describe("createGoogleDocAiOcrProvider", () => {
  it("returns a provider that implements OcrProvider", () => {
    const provider = createGoogleDocAiOcrProvider(defaultConfig, { log: () => {} });
    expect(typeof provider.extract).toBe("function");
  });
});

run();
