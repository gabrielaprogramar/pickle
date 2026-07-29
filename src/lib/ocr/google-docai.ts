import type { DocumentType } from "@/lib/supabase/types";
import type { OcrProvider, OcrResult } from "./types";
import {
  GoogleOcrConfigError,
  GoogleOcrAuthError,
  GoogleOcrApiError,
  GoogleOcrTimeoutError,
  GoogleOcrRateLimitError,
  GoogleOcrInvalidResponseError,
  GoogleOcrError,
} from "./errors";

export interface GoogleDocAiConfig {
  readonly projectId: string;
  readonly location: string;
  readonly processorId: string;
  readonly credentials: GoogleServiceAccountCredentials;
}

export interface GoogleServiceAccountCredentials {
  readonly type: string;
  readonly project_id: string;
  readonly private_key_id: string;
  readonly private_key: string;
  readonly client_email: string;
  readonly client_id: string;
  readonly auth_uri: string;
  readonly token_uri: string;
}

type LogLevel = "info" | "warn" | "error";

interface Logger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

interface RetryOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

function createDefaultLogger(): Logger {
  return {
    log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
      const prefix = "[google-ocr]";
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
      switch (level) {
        case "error":
          console.error(`${prefix} ${message}${metaStr}`);
          break;
        case "warn":
          console.warn(`${prefix} ${message}${metaStr}`);
          break;
        default:
          console.log(`${prefix} ${message}${metaStr}`);
      }
    },
  };
}

export function loadGoogleDocAiConfig(env: NodeJS.ProcessEnv = process.env): GoogleDocAiConfig {
  const projectId = env.GOOGLE_OCR_PROJECT_ID?.trim();
  if (!projectId) {
    throw new GoogleOcrConfigError(
      "GOOGLE_OCR_PROJECT_ID is required when OCR_USE_MOCK=false and GOOGLE_OCR_ENABLED=true.",
    );
  }

  const processorId = env.GOOGLE_OCR_PROCESSOR_ID?.trim();
  if (!processorId) {
    throw new GoogleOcrConfigError(
      "GOOGLE_OCR_PROCESSOR_ID is required when OCR_USE_MOCK=false and GOOGLE_OCR_ENABLED=true.",
    );
  }

  const location = env.GOOGLE_OCR_LOCATION?.trim() || "us";

  const credentialsJson = env.GOOGLE_OCR_CREDENTIALS?.trim();
  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  let credentials: GoogleServiceAccountCredentials;

  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson) as GoogleServiceAccountCredentials;
    } catch {
      throw new GoogleOcrConfigError("GOOGLE_OCR_CREDENTIALS is not valid JSON.");
    }
  } else if (credentialsPath) {
    try {
      const fs = require("fs") as typeof import("fs");
      const raw = fs.readFileSync(credentialsPath, "utf-8");
      credentials = JSON.parse(raw) as GoogleServiceAccountCredentials;
    } catch (e) {
      throw new GoogleOcrConfigError(
        `Failed to read GOOGLE_APPLICATION_CREDENTIALS from ${credentialsPath}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  } else {
    throw new GoogleOcrConfigError(
      "Either GOOGLE_OCR_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS must be set when OCR_USE_MOCK=false and GOOGLE_OCR_ENABLED=true.",
    );
  }

  return { projectId, location, processorId, credentials };
}

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URI = "https://oauth2.googleapis.com/token";

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signRsaSha256(data: string, privateKey: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  const signature = signer.sign(privateKey, "base64");
  return signature.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createJwtAssertion(credentials: GoogleServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: TOKEN_URI,
    exp: now + 3600,
    iat: now,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const claimEncoded = base64UrlEncode(JSON.stringify(claim));
  const signature = signRsaSha256(`${headerEncoded}.${claimEncoded}`, credentials.private_key);

  return `${headerEncoded}.${claimEncoded}.${signature}`;
}

async function exchangeJwtForToken(
  assertion: string,
  timeoutMs: number,
  logger: Logger,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });

    const res = await fetchFn(TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      logger.log("error", "Token exchange failed", { status: res.status, body: text.slice(0, 500) });
      throw new GoogleOcrAuthError(
        `Failed to obtain access token: ${res.status} ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new GoogleOcrAuthError("Token response missing access_token.");
    }

    logger.log("info", "Obtained access token", { expiresIn: data.expires_in });
    return data.access_token;
  } catch (e) {
    if (e instanceof GoogleOcrAuthError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new GoogleOcrTimeoutError("Token exchange timed out.");
    }
    throw new GoogleOcrAuthError("Failed to exchange JWT for token.", e);
  } finally {
    clearTimeout(timeout);
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  logger: Logger,
  operation: string,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (e instanceof GoogleOcrRateLimitError || e instanceof GoogleOcrTimeoutError) {
        if (attempt < options.maxRetries) {
          const backoffMs = Math.min(
            options.baseDelayMs * Math.pow(2, attempt),
            options.maxDelayMs,
          );
          logger.log("warn", `Retry ${attempt + 1}/${options.maxRetries} for ${operation}`, {
            delayMs: backoffMs,
            error: lastError.message,
          });
          await delay(backoffMs);
          continue;
        }
      }

      if (e instanceof GoogleOcrApiError && e.status >= 500 && e.status < 600) {
        if (attempt < options.maxRetries) {
          const backoffMs = Math.min(
            options.baseDelayMs * Math.pow(2, attempt),
            options.maxDelayMs,
          );
          logger.log("warn", `Retry ${attempt + 1}/${options.maxRetries} for ${operation}`, {
            delayMs: backoffMs,
            status: e.status,
          });
          await delay(backoffMs);
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error(`Operation ${operation} failed after ${options.maxRetries + 1} attempts.`);
}

interface AsyncTokenProvider {
  getToken(): Promise<string>;
}

function createTokenProvider(
  credentials: GoogleServiceAccountCredentials,
  logger: Logger,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): AsyncTokenProvider {
  let cachedToken: string | null = null;
  let tokenExpiry: number = 0;

  return {
    async getToken(): Promise<string> {
      const now = Date.now();
      if (cachedToken && tokenExpiry > now + 60000) {
        return cachedToken;
      }

      const assertion = createJwtAssertion(credentials);
      const token = await exchangeJwtForToken(assertion, 10_000, logger, fetchFn);
      cachedToken = token;
      tokenExpiry = now + 3500 * 1000;
      return token;
    },
  };
}

interface DocumentAiDocument {
  readonly text: string;
  readonly pages?: ReadonlyArray<{
    readonly paragraphs?: ReadonlyArray<{
      readonly layout?: {
        readonly textAnchor?: {
          readonly textSegments?: ReadonlyArray<{
            readonly startIndex?: number;
            readonly endIndex?: number;
          }>;
        };
      };
    }>;
    readonly tables?: ReadonlyArray<unknown>;
    readonly formFields?: ReadonlyArray<{
      readonly fieldName?: { readonly textAnchor?: { readonly content?: string } };
      readonly fieldValue?: { readonly textAnchor?: { readonly content?: string } };
    }>;
  }>;
  readonly entities?: ReadonlyArray<{
    readonly type: string;
    readonly mentionText?: string;
    readonly confidence?: number;
    readonly properties?: ReadonlyArray<{
      readonly type: string;
      readonly mentionText?: string;
      readonly confidence?: number;
    }>;
  }>;
}

interface DocumentAiProcessResponse {
  readonly document: DocumentAiDocument;
  readonly humanReviewOperation?: string;
  readonly humanReviewStatus?: { readonly state?: string; readonly stateMessage?: string };
}

interface ProcessOptions {
  readonly mimeType: string;
  readonly fileBuffer: Buffer;
  readonly timeoutMs: number;
  readonly tokenProvider: AsyncTokenProvider;
  readonly config: GoogleDocAiConfig;
  readonly logger: Logger;
}

interface ProcessDeps {
  readonly fetchFn: typeof globalThis.fetch;
}

async function processDocument(opts: ProcessOptions & ProcessDeps): Promise<DocumentAiDocument> {
  const { mimeType, fileBuffer, timeoutMs, tokenProvider, config, logger, fetchFn } = opts;
  const encodedContent = fileBuffer.toString("base64");

  const requestBody = {
    skipHumanReview: true,
    rawDocument: {
      content: encodedContent,
      mimeType,
    },
  };

  const url = `https://${config.location}-documentai.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}:process`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const token = await tokenProvider.getToken();

    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();

      if (res.status === 401 || res.status === 403) {
        throw new GoogleOcrAuthError(`Authentication failed: ${res.status} ${text.slice(0, 200)}`);
      }
      if (res.status === 429) {
        throw new GoogleOcrRateLimitError(`Rate limited: ${text.slice(0, 200)}`);
      }
      if (res.status >= 500) {
        throw new GoogleOcrApiError(`API error: ${res.status}`, res.status, text.slice(0, 500));
      }

      throw new GoogleOcrApiError(`Request failed: ${res.status} ${text.slice(0, 200)}`, res.status, text.slice(0, 500));
    }

    const data = (await res.json()) as DocumentAiProcessResponse;
    logger.log("info", "Document processed successfully", {
      hasHumanReview: !!data.humanReviewOperation,
      textLength: data.document?.text?.length ?? 0,
    });

    return data.document;
  } catch (e) {
    if (e instanceof GoogleOcrError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new GoogleOcrTimeoutError("Document AI request timed out.");
    }
    throw new GoogleOcrApiError("Failed to process document.", 0, undefined, e);
  } finally {
    clearTimeout(timeout);
  }
}

const SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
  "image/gif",
]);

function getDocumentTypeLabel(documentType: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    imo_dcs: "imo_dcs",
    eu_mrv: "eu_mrv",
    certificate: "certificate",
    report: "report",
    correspondence: "correspondence",
    logbook: "logbook",
    other: "other",
  };
  return labels[documentType] ?? "other";
}

function extractTextFromDocument(document: DocumentAiDocument): string {
  return document.text ?? "";
}

function extractEntitiesFromDocument(
  document: DocumentAiDocument,
  documentType: DocumentType,
): Record<string, unknown> {
  const extracted: Record<string, unknown> = {};

  const entities = document.entities ?? [];
  for (const entity of entities) {
    const value = entity.mentionText ?? "";
    const key = entity.type;
    if (key) {
      extracted[key] = value;
    }

    const props = entity.properties ?? [];
    for (const prop of props) {
      const propKey = prop.type;
      const propValue = prop.mentionText ?? "";
      if (propKey) {
        extracted[`${key}_${propKey}`] = propValue;
      }
    }
  }

  const pages = document.pages ?? [];
  for (const page of pages) {
    const formFields = page.formFields ?? [];
    for (const field of formFields) {
      const name = field.fieldName?.textAnchor?.content ?? "";
      const value = field.fieldValue?.textAnchor?.content ?? "";
      if (name) {
        extracted[`form_${name.trim()}`] = value.trim();
      }
    }
  }

  if (Object.keys(extracted).length === 0) {
    const fullText = document.text ?? "";
    extracted["fullText"] = fullText;

    const m = fullText.match(/IMO\s*[:\s]*(\d{7})/i);
    if (m?.[1]) extracted["imoNumber"] = m[1];

    const nameMatch = fullText.match(/(?:Vessel|M\/?V|Ship)\s*[:\s]*([A-Za-z0-9 \-']+)/i);
    if (nameMatch?.[1]) extracted["vesselName"] = nameMatch[1].trim();
  }

  return extracted;
}

function computeConfidence(document: DocumentAiDocument): number {
  const entities = document.entities ?? [];
  if (entities.length === 0) return 0.5;

  const confidences = entities
    .map((e) => e.confidence)
    .filter((c): c is number => c !== undefined && c !== null);

  if (confidences.length === 0) return 0.5;

  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  return Math.min(1, Math.max(0, avgConfidence));
}

export function createGoogleDocAiOcrProvider(
  config?: GoogleDocAiConfig,
  logger?: Logger,
  retryOptions?: RetryOptions,
  fetchFn?: typeof globalThis.fetch,
): OcrProvider {
  const effectiveConfig = config ?? loadGoogleDocAiConfig();
  const effectiveLogger = logger ?? createDefaultLogger();
  const effectiveRetry: RetryOptions = retryOptions ?? {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
  };
  const effectiveFetch = fetchFn ?? globalThis.fetch;

  const tokenProvider = createTokenProvider(effectiveConfig.credentials, effectiveLogger, effectiveFetch);

  return {
    async extract(
      fileBuffer: Buffer,
      mimeType: string,
      documentType: DocumentType,
    ): Promise<OcrResult> {
      effectiveLogger.log("info", "Processing document", {
        mimeType,
        documentType,
        fileSize: fileBuffer.length,
      });

      if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
        effectiveLogger.log("warn", "Unsupported MIME type, attempting anyway", { mimeType });
      }

      const document = await retryWithBackoff(
        () =>
          processDocument({
            mimeType,
            fileBuffer,
            timeoutMs: 120_000,
            tokenProvider,
            config: effectiveConfig,
            logger: effectiveLogger,
            fetchFn: effectiveFetch,
          }),
        effectiveRetry,
        effectiveLogger,
        "processDocument",
      );

      const rawText = extractTextFromDocument(document);
      const extractedData = extractEntitiesFromDocument(document, documentType);
      const confidence = computeConfidence(document);

      const result: OcrResult = {
        rawText,
        extractedData,
        confidence,
      };

      effectiveLogger.log("info", "OCR extraction complete", {
        textLength: rawText.length,
        entityCount: Object.keys(extractedData).length,
        confidence,
      });

      return result;
    },
  };
}
