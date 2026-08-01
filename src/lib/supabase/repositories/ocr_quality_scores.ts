/**
 * repositories/ocr_quality_scores.ts — OCR quality score persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Persists the deterministic OCR quality snapshot (composite score, level,
 * sub-scores, confidence distribution, issues, missing mandatory fields) that
 * the OCR Intelligence Assistant derives per OCR result.
 *
 * HOW IT FITS
 * The OCR review API writes a quality row whenever a document is scored, so
 * the Document Review panel and the cross-assistant surfaces can query history
 * without re-running the engines.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { OcrQualityScoreInsert, OcrQualityScoreRow } from "../types";

export interface OcrQualityScoreRepository {
  insert(input: OcrQualityScoreInsert): Promise<OcrQualityScoreRow>;
  findById(id: string): Promise<OcrQualityScoreRow | null>;
  listByDocumentId(documentId: string): Promise<OcrQualityScoreRow[]>;
  findLatestByDocumentId(documentId: string): Promise<OcrQualityScoreRow | null>;
  listByLevel(level: OcrQualityScoreRow["level"]): Promise<OcrQualityScoreRow[]>;
}

export interface CreateOcrQualityScoreRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOcrQualityScoreRepository(
  opts: CreateOcrQualityScoreRepositoryOptions = {},
): OcrQualityScoreRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OcrQualityScoreInsert): Promise<OcrQualityScoreRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_quality_scores")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as OcrQualityScoreRow;
      } catch (e) {
        throw mapError("insert ocr quality score", e);
      }
    },

    async findById(id: string): Promise<OcrQualityScoreRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_quality_scores")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as OcrQualityScoreRow | null) ?? null;
      } catch (e) {
        throw mapError("find ocr quality score by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<OcrQualityScoreRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_quality_scores")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as OcrQualityScoreRow[]) ?? [];
      } catch (e) {
        throw mapError("list ocr quality scores by document", e);
      }
    },

    async findLatestByDocumentId(documentId: string): Promise<OcrQualityScoreRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_quality_scores")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as OcrQualityScoreRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest ocr quality score", e);
      }
    },

    async listByLevel(level: OcrQualityScoreRow["level"]): Promise<OcrQualityScoreRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ocr_quality_scores")
          .select()
          .eq("level", level)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as OcrQualityScoreRow[]) ?? [];
      } catch (e) {
        throw mapError("list ocr quality scores by level", e);
      }
    },
  };
}
