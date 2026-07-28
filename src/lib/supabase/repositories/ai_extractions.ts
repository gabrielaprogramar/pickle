/**
 * repositories/ai_extractions.ts — AI extraction persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Stores the structured output from the AI extraction pipeline. Each row
 * captures the extraction result, provider metadata, and token usage for
 * auditing and compliance purposes.
 *
 * HOW IT FITS
 * The AI extraction service calls this repository to persist results after
 * each extraction run. The document service queries extractions to display
 * results in the UI.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { AiExtractionStatus } from "@/lib/ai/types";

export interface AiExtractionRow {
  readonly id: string;
  readonly document_id: string;
  readonly ocr_result_id: string | null;
  readonly status: AiExtractionStatus;
  readonly confidence: number | null;
  readonly summary: string | null;
  readonly document_type: string;
  readonly fields: Record<string, unknown>;
  readonly warnings: string[];
  readonly missing_fields: string[];
  readonly provider: string;
  readonly model: string;
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
  readonly latency_ms: number | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AiExtractionInsert {
  readonly document_id: string;
  readonly ocr_result_id?: string | null;
  readonly status?: AiExtractionStatus;
  readonly confidence?: number | null;
  readonly summary?: string | null;
  readonly document_type: string;
  readonly fields?: Record<string, unknown>;
  readonly warnings?: string[];
  readonly missing_fields?: string[];
  readonly provider?: string;
  readonly model?: string;
  readonly prompt_tokens?: number | null;
  readonly completion_tokens?: number | null;
  readonly total_tokens?: number | null;
  readonly latency_ms?: number | null;
  readonly error_message?: string | null;
}

export interface AiExtractionRepository {
  /** Insert a new AI extraction record. Returns the stored row. */
  insert(input: AiExtractionInsert): Promise<AiExtractionRow>;
  /** Find an extraction by its UUID. Returns null when not found. */
  findById(id: string): Promise<AiExtractionRow | null>;
  /** List all extractions for a document, ordered by created_at DESC. */
  listByDocumentId(documentId: string): Promise<AiExtractionRow[]>;
  /** Find the latest extraction for a document. */
  findLatestByDocumentId(documentId: string): Promise<AiExtractionRow | null>;
  /** Find the latest completed extraction for a document. */
  findLatestCompletedByDocumentId(
    documentId: string,
  ): Promise<AiExtractionRow | null>;
  /** Update an extraction with full fields. Returns the updated row. */
  update(
    id: string,
    fields: {
      status?: AiExtractionStatus;
      confidence?: number | null;
      summary?: string | null;
      fields?: Record<string, unknown>;
      warnings?: string[];
      missing_fields?: string[];
      provider?: string;
      model?: string;
      prompt_tokens?: number | null;
      completion_tokens?: number | null;
      total_tokens?: number | null;
      latency_ms?: number | null;
      error_message?: string | null;
    },
  ): Promise<AiExtractionRow>;
  /** Update an extraction's status and error message. */
  updateStatus(
    id: string,
    status: AiExtractionStatus,
    extra?: { error_message?: string | null },
  ): Promise<AiExtractionRow>;
}

export interface CreateAiExtractionRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAiExtractionRepository(
  opts: CreateAiExtractionRepositoryOptions = {},
): AiExtractionRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: AiExtractionInsert): Promise<AiExtractionRow> {
      try {
        const client = getClient();
        const payload = {
          document_id: input.document_id,
          ocr_result_id: input.ocr_result_id ?? null,
          status: input.status ?? "pending",
          confidence: input.confidence ?? null,
          summary: input.summary ?? null,
          document_type: input.document_type,
          fields: input.fields ?? {},
          warnings: input.warnings ?? [],
          missing_fields: input.missing_fields ?? [],
          provider: input.provider ?? "mock",
          model: input.model ?? "mock",
          prompt_tokens: input.prompt_tokens ?? null,
          completion_tokens: input.completion_tokens ?? null,
          total_tokens: input.total_tokens ?? null,
          latency_ms: input.latency_ms ?? null,
          error_message: input.error_message ?? null,
        };

        const { data, error } = await client
          .from("ai_extractions")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as AiExtractionRow;
      } catch (e) {
        throw mapError("insert AI extraction", e);
      }
    },

    async findById(id: string): Promise<AiExtractionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ai_extractions")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as AiExtractionRow | null) ?? null;
      } catch (e) {
        throw mapError("find AI extraction by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<AiExtractionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ai_extractions")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as AiExtractionRow[]) ?? [];
      } catch (e) {
        throw mapError("list AI extractions by document", e);
      }
    },

    async findLatestByDocumentId(
      documentId: string,
    ): Promise<AiExtractionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ai_extractions")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as AiExtractionRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest AI extraction", e);
      }
    },

    async findLatestCompletedByDocumentId(
      documentId: string,
    ): Promise<AiExtractionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ai_extractions")
          .select()
          .eq("document_id", documentId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as AiExtractionRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest completed AI extraction", e);
      }
    },

    async updateStatus(
      id: string,
      status: AiExtractionStatus,
      extra?: { error_message?: string | null },
    ): Promise<AiExtractionRow> {
      try {
        const client = getClient();
        const update: Record<string, unknown> = { status };
        if (extra?.error_message !== undefined) {
          update.error_message = extra.error_message;
        }

        const { data, error } = await client
          .from("ai_extractions")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(update as any)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as AiExtractionRow;
      } catch (e) {
        throw mapError("update AI extraction status", e);
      }
    },

    async update(
      id: string,
      fields: {
        status?: AiExtractionStatus;
        confidence?: number | null;
        summary?: string | null;
        fields?: Record<string, unknown>;
        warnings?: string[];
        missing_fields?: string[];
        provider?: string;
        model?: string;
        prompt_tokens?: number | null;
        completion_tokens?: number | null;
        total_tokens?: number | null;
        latency_ms?: number | null;
        error_message?: string | null;
      },
    ): Promise<AiExtractionRow> {
      try {
        const client = getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const update: Record<string, any> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) {
            update[key] = value;
          }
        }

        const { data, error } = await client
          .from("ai_extractions")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(update as any)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as AiExtractionRow;
      } catch (e) {
        throw mapError("update AI extraction", e);
      }
    },
  };
}
