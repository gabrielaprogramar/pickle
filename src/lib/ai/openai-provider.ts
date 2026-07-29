import type { DocumentType } from "@/lib/supabase/types";
import type {
  AiExtractionInput,
  AiExtractionResult,
  AiProvider,
  AiTokenUsage,
} from "./types";
import { getExtractionPrompt } from "./prompts";
import {
  OpenAiError,
  OpenAiConfigError,
  OpenAiAuthError,
  OpenAiApiError,
  OpenAiTimeoutError,
  OpenAiRateLimitError,
  OpenAiInvalidResponseError,
} from "./openai-errors";

export interface OpenAiProviderConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly temperature?: number;
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

interface OpenAiChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

interface OpenAiChoice {
  readonly message: {
    readonly role: string;
    readonly content: string;
  };
  readonly finish_reason: string;
}

interface OpenAiUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}

interface OpenAiResponse {
  readonly id: string;
  readonly choices: OpenAiChoice[];
  readonly usage?: OpenAiUsage;
}

type LogLevel = "info" | "warn" | "error";

interface Logger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

function createDefaultLogger(): Logger {
  return {
    log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
      const prefix = "[openai-extract]";
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

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30_000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs: number; maxDelayMs: number },
  logger: Logger,
  operation: string,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (e instanceof OpenAiRateLimitError || e instanceof OpenAiTimeoutError) {
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

      if (e instanceof OpenAiApiError && e.status >= 500 && e.status < 600) {
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

function buildRequestBody(
  model: string,
  messages: OpenAiChatMessage[],
  temperature: number,
  jsonSchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };

  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "extraction",
        strict: true,
        schema: jsonSchema,
      },
    };
  } else {
    body.response_format = { type: "json_object" };
  }

  return body;
}

function mapHttpError(status: number, bodyText: string, logger: Logger): OpenAiError {
  logger.log("error", "OpenAI API error", { status, body: bodyText.slice(0, 500) });

  if (status === 401) {
    return new OpenAiAuthError(`Authentication failed: ${bodyText.slice(0, 200)}`);
  }
  if (status === 429) {
    return new OpenAiRateLimitError(`Rate limited: ${bodyText.slice(0, 200)}`);
  }
  if (status >= 500) {
    return new OpenAiApiError(`Server error: ${status}`, status, bodyText.slice(0, 500));
  }
  return new OpenAiApiError(`Request failed: ${status} ${bodyText.slice(0, 200)}`, status, bodyText.slice(0, 500));
}

export function createOpenAiProvider(
  config: OpenAiProviderConfig,
  logger?: Logger,
): AiProvider {
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new OpenAiConfigError("OpenAI API key is required.");
  }

  const apiKey = config.apiKey.trim();
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY;
  const effectiveLogger = logger ?? createDefaultLogger();

  async function callOpenAi(
    messages: OpenAiChatMessage[],
    jsonSchema: Record<string, unknown> | undefined,
  ): Promise<{ content: string; usage: AiTokenUsage | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody = buildRequestBody(model, messages, temperature, jsonSchema);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw mapHttpError(response.status, body, effectiveLogger);
      }

      const data = (await response.json()) as OpenAiResponse;
      const content = data.choices[0]?.message?.content ?? "";
      const finishReason = data.choices[0]?.finish_reason;

      if (finishReason === "length") {
        effectiveLogger.log("warn", "Response truncated due to token limit", {
          finishReason,
          contentLength: content.length,
        });
      }

      const usage: AiTokenUsage | null = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : null;

      return { content, usage };
    } catch (e) {
      if (e instanceof OpenAiError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new OpenAiTimeoutError("OpenAI API request timed out.");
      }
      throw new OpenAiApiError("Failed to call OpenAI API.", 0, undefined, e);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async extract(input: AiExtractionInput): Promise<AiExtractionResult> {
      const prompt = getExtractionPrompt(input.documentType);

      effectiveLogger.log("info", "Extracting document", {
        documentType: input.documentType,
        ocrConfidence: input.ocrConfidence,
        textLength: input.rawText.length,
        title: input.title,
      });

      const messages: OpenAiChatMessage[] = [
        { role: "system", content: prompt.systemPrompt },
        {
          role: "user",
          content:
            `Document type: ${input.documentType}\n` +
            `OCR confidence: ${(input.ocrConfidence * 100).toFixed(1)}%\n` +
            (input.title ? `Document title: ${input.title}\n` : "") +
            `\nOCR Text:\n${input.rawText}`,
        },
      ];

      const { content, usage } = await retryWithBackoff(
        () => callOpenAi(messages, prompt.jsonSchema),
        { maxRetries, baseDelayMs, maxDelayMs },
        effectiveLogger,
        "openaiExtract",
      );

      let parsed: Record<string, unknown>;
      try {
        const cleaned = content
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
        parsed = JSON.parse(cleaned) as Record<string, unknown>;
      } catch {
        effectiveLogger.log("error", "Failed to parse AI response as JSON", { contentLength: content.length });
        return {
          confidence: 0.1,
          summary: "Failed to parse AI response as JSON.",
          documentType: input.documentType,
          fields: {},
          warnings: ["AI response was not valid JSON"],
          missingFields: prompt.expectedFields,
          usage,
        };
      }

      const fields: Record<string, unknown> = {};
      const missingFields: string[] = [];
      const warnings: string[] = [];

      for (const field of prompt.expectedFields) {
        if (parsed[field] !== undefined && parsed[field] !== null) {
          fields[field] = parsed[field];
        } else {
          missingFields.push(field);
        }
      }

      for (const [key, value] of Object.entries(parsed)) {
        if (!prompt.expectedFields.includes(key) && key !== "summary" && key !== "warnings") {
          fields[key] = value;
        }
      }

      if (typeof parsed["warnings"] === "string") {
        warnings.push(parsed["warnings"]);
      } else if (Array.isArray(parsed["warnings"])) {
        for (const w of parsed["warnings"]) {
          if (typeof w === "string") warnings.push(w);
        }
      }

      const fieldCompleteness =
        prompt.expectedFields.length > 0
          ? (prompt.expectedFields.length - missingFields.length) /
            prompt.expectedFields.length
          : 0.5;
      const confidence = Math.min(
        0.95,
        fieldCompleteness * 0.8 + (input.ocrConfidence * 0.2),
      );

      const summary =
        typeof parsed["summary"] === "string"
          ? parsed["summary"]
          : `AI extraction completed for ${input.documentType} document.`;

      effectiveLogger.log("info", "Extraction complete", {
        documentType: input.documentType,
        confidence,
        fieldsCount: Object.keys(fields).length,
        missingCount: missingFields.length,
        warningsCount: warnings.length,
        tokenUsage: usage?.totalTokens,
      });

      return {
        confidence,
        summary,
        documentType: input.documentType,
        fields,
        warnings,
        missingFields,
        usage,
      };
    },
  };
}
