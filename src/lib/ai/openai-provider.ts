/**
 * openai-provider.ts — GPT-4o based AI extraction provider
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Real AI extraction using OpenAI's GPT-4o model. This implementation is
 * used when AI_USE_MOCK=false and OPENAI_API_KEY is set. It constructs
 * document-type-specific prompts and parses the structured JSON response.
 *
 * HOW IT FITS
 * The provider factory creates this implementation in live mode. The extraction
 * service calls provider.extract() without knowing the underlying model.
 *
 * NOTE
 * This module dynamically imports openai only when instantiated in live mode,
 * so the mock path never requires the openai package to be installed.
 */

import type { DocumentType } from "@/lib/supabase/types";
import type {
  AiExtractionInput,
  AiExtractionResult,
  AiProvider,
  AiTokenUsage,
} from "./types";
import { getExtractionPrompt } from "./prompts";

/** Configuration for the OpenAI provider. */
export interface OpenAiProviderConfig {
  /** OpenAI API key. Required. */
  readonly apiKey: string;
  /** Model to use. Default: "gpt-4o". */
  readonly model?: string;
  /** Request timeout in ms. Default: 60000. */
  readonly timeoutMs?: number;
  /** Temperature. Default: 0.1 (low for structured extraction). */
  readonly temperature?: number;
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

interface OpenAiResponse {
  readonly id: string;
  readonly choices: OpenAiChoice[];
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

/**
 * Creates an OpenAI GPT-4o based AI extraction provider.
 * @param config - OpenAI API configuration.
 */
export function createOpenAiProvider(config: OpenAiProviderConfig): AiProvider {
  const model = config.model ?? "gpt-4o";
  const timeoutMs = config.timeoutMs ?? 60_000;
  const temperature = config.temperature ?? 0.1;

  async function callOpenAi(
    messages: OpenAiChatMessage[],
  ): Promise<{ content: string; usage: AiTokenUsage | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenAI API error ${response.status}: ${body.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as OpenAiResponse;
      const content = data.choices[0]?.message?.content ?? "";
      const usage: AiTokenUsage | null = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : null;

      return { content, usage };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async extract(input: AiExtractionInput): Promise<AiExtractionResult> {
      const prompt = getExtractionPrompt(input.documentType);

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

      const { content, usage } = await callOpenAi(messages);

      // Parse the JSON response.
      let parsed: Record<string, unknown>;
      try {
        // Strip markdown fences if present.
        const cleaned = content
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
        parsed = JSON.parse(cleaned) as Record<string, unknown>;
      } catch {
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

      // Build the result from parsed data.
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

      // Include any extra fields the AI returned.
      for (const [key, value] of Object.entries(parsed)) {
        if (!prompt.expectedFields.includes(key)) {
          fields[key] = value;
        }
      }

      // Detect warnings from the AI output.
      if (typeof parsed["warnings"] === "string") {
        warnings.push(parsed["warnings"]);
      } else if (Array.isArray(parsed["warnings"])) {
        for (const w of parsed["warnings"]) {
          if (typeof w === "string") warnings.push(w);
        }
      }

      // Calculate confidence based on completeness.
      const fieldCompleteness =
        prompt.expectedFields.length > 0
          ? (prompt.expectedFields.length - missingFields.length) /
            prompt.expectedFields.length
          : 0.5;
      const confidence = Math.min(
        0.95,
        fieldCompleteness * 0.8 + (input.ocrConfidence * 0.2),
      );

      // Build summary.
      const summary =
        typeof parsed["summary"] === "string"
          ? parsed["summary"]
          : `AI extraction completed for ${input.documentType} document.`;

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
