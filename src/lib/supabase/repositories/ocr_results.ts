/**
 * repositories/ocr_results.ts — OCR result persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Stores the output of OCR processing jobs: the raw extracted text, structured
 * data, and confidence score. One OCR result per processing job per document.
 *
 * HOW IT FITS
 * After an OCR job completes, the pipeline writes the result here and the
 * processing job's status transitions to completed. Downstream entity
 * extraction reads ocr_results.raw_text.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { OcrResultInsert, OcrResultRow } from "../types";

export interface OcrResultRepository {
  /** Insert an OCR result. Returns the stored row. */
  insert(input: OcrResultInsert): Promise<OcrResultRow>;
  /** Find an OCR result by its UUID. Returns null when not found. */
  findById(id: string): Promise<OcrResultRow | null>;
  /** Find the OCR result for a specific processing job. */
  findByJobId(jobId: string): Promise<OcrResultRow | null>;
  /** List all OCR results for a document. */
  listByDocumentId(documentId: string): Promise<OcrResultRow[]>;
}

export interface CreateOcrResultRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOcrResultRepository(
  opts: CreateOcrResultRepositoryOptions = {},
): OcrResultRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OcrResultInsert): Promise<OcrResultRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_results")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as OcrResultRow;
      } catch (e) {
        throw mapError("insert OCR result", e);
      }
    },

    async findById(id: string): Promise<OcrResultRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_results")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as OcrResultRow | null) ?? null;
      } catch (e) {
        throw mapError("find OCR result by id", e);
      }
    },

    async findByJobId(jobId: string): Promise<OcrResultRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_results")
          .select()
          .eq("processing_job_id", jobId)
          .maybeSingle();

        if (error) throw error;
        return (data as OcrResultRow | null) ?? null;
      } catch (e) {
        throw mapError("find OCR result by job id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<OcrResultRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_results")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as OcrResultRow[]) ?? [];
      } catch (e) {
        throw mapError("list OCR results by document", e);
      }
    },
  };
}
