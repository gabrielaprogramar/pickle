/**
 * types.ts — AI provider types and extraction result shapes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Defines the AI provider contract and the structured extraction result type.
 * Every document type (BDN, CII, FuelEU, EU-ETS) produces the same
 * ExtractionResult shape — only the `fields` content varies. Unknown document
 * types produce UnknownDocumentExtraction without failing the pipeline.
 *
 * HOW IT FITS
 * The mock provider (mock-provider.ts) and the real OpenAI provider
 * (openai-provider.ts) implement AIProvider. The extraction service calls
 * aiProvider.extract() and persists the result.
 */

import type { DocumentType } from "@/lib/supabase/types";

// ── AI Provider Contract ────────────────────────────────────────────────────

/** Input to the AI extraction provider. */
export interface AiExtractionInput {
  /** Full OCR text from the document. */
  readonly rawText: string;
  /** OCR confidence (0–1). */
  readonly ocrConfidence: number;
  /** Document type classification. */
  readonly documentType: DocumentType;
  /** Optional document title for context. */
  readonly title?: string;
}

/** Structured output from the AI extraction provider. */
export interface AiExtractionResult {
  /** Overall AI confidence in the extraction (0–1). */
  readonly confidence: number;
  /** Human-readable summary of the document. */
  readonly summary: string;
  /** The document type as determined by AI. */
  readonly documentType: DocumentType;
  /** All extracted maritime fields, keyed by field name. */
  readonly fields: Record<string, unknown>;
  /** Human-readable warnings about data quality. */
  readonly warnings: string[];
  /** List of expected fields that could not be extracted. */
  readonly missingFields: string[];
  /** Token usage information (if available from the provider). */
  readonly usage: AiTokenUsage | null;
}

/** Token usage statistics from an LLM call. */
export interface AiTokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/** Provider metadata stored alongside the extraction. */
export interface AiProviderMetadata {
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
}

/** The AI provider contract. Both mock and real implement this. */
export interface AiProvider {
  /**
   * Extract structured maritime data from OCR text.
   * @param input - The OCR output and document context.
   * @returns The AI extraction result.
   */
  extract(input: AiExtractionInput): Promise<AiExtractionResult>;
}

// ── Extraction Status ────────────────────────────────────────────────────────

/** Possible statuses for an AI extraction record. */
export type AiExtractionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "unknown_document";
