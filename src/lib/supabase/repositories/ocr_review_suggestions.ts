/**
 * repositories/ocr_review_suggestions.ts — OCR repair suggestion persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Persists the deterministic OCR repair suggestions (IMO checksum, date
 * format, fuel/port spelling, certificate spacing, merged characters) that a
 * human reviewer accepts or rejects during document review.
 *
 * HOW IT FITS
 * The OCR review API writes suggestion rows alongside the quality score. The
 * Document Review panel lists open suggestions and transitions their status as
 * the reviewer decides.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  OcrReviewSuggestionInsert,
  OcrReviewSuggestionRow,
  OcrReviewSuggestionStatus,
} from "../types";

export interface OcrReviewSuggestionRepository {
  insert(input: OcrReviewSuggestionInsert): Promise<OcrReviewSuggestionRow>;
  insertMany(inputs: ReadonlyArray<OcrReviewSuggestionInsert>): Promise<OcrReviewSuggestionRow[]>;
  findById(id: string): Promise<OcrReviewSuggestionRow | null>;
  listByDocumentId(documentId: string): Promise<OcrReviewSuggestionRow[]>;
  listByStatus(status: OcrReviewSuggestionStatus): Promise<OcrReviewSuggestionRow[]>;
  updateStatus(id: string, status: OcrReviewSuggestionStatus): Promise<OcrReviewSuggestionRow>;
}

export interface CreateOcrReviewSuggestionRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOcrReviewSuggestionRepository(
  opts: CreateOcrReviewSuggestionRepositoryOptions = {},
): OcrReviewSuggestionRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OcrReviewSuggestionInsert): Promise<OcrReviewSuggestionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .insert({ ...input, status: input.status ?? "open" })
          .select()
          .single();

        if (error) throw error;
        return data as OcrReviewSuggestionRow;
      } catch (e) {
        throw mapError("insert ocr review suggestion", e);
      }
    },

    async insertMany(
      inputs: ReadonlyArray<OcrReviewSuggestionInsert>,
    ): Promise<OcrReviewSuggestionRow[]> {
      if (inputs.length === 0) return [];
      try {
        const client = getClient();
        const payload = inputs.map((input) => ({
          ...input,
          status: input.status ?? "open",
        }));
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .insert(payload)
          .select();

        if (error) throw error;
        return (data as OcrReviewSuggestionRow[]) ?? [];
      } catch (e) {
        throw mapError("insert ocr review suggestions", e);
      }
    },

    async findById(id: string): Promise<OcrReviewSuggestionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as OcrReviewSuggestionRow | null) ?? null;
      } catch (e) {
        throw mapError("find ocr review suggestion by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<OcrReviewSuggestionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as OcrReviewSuggestionRow[]) ?? [];
      } catch (e) {
        throw mapError("list ocr review suggestions by document", e);
      }
    },

    async listByStatus(status: OcrReviewSuggestionStatus): Promise<OcrReviewSuggestionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .select()
          .eq("status", status)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as OcrReviewSuggestionRow[]) ?? [];
      } catch (e) {
        throw mapError("list ocr review suggestions by status", e);
      }
    },

    async updateStatus(
      id: string,
      status: OcrReviewSuggestionStatus,
    ): Promise<OcrReviewSuggestionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_review_suggestions")
          .update({ status })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as OcrReviewSuggestionRow;
      } catch (e) {
        throw mapError("update ocr review suggestion status", e);
      }
    },
  };
}
