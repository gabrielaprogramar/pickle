/**
 * repositories/document_entities.ts — extracted entity persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Stores named entities extracted from document text: IMO numbers, vessel
 * names, ports, dates, certificate numbers, etc. Each entity links back to
 * its source document (and optionally to the OCR result it came from).
 *
 * HOW IT FITS
 * The entity extraction pipeline writes rows here after OCR completes. The
 * API layer queries entities to build compliance dashboards and vessel profiles.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  DocumentEntityInsert,
  DocumentEntityRow,
  DocumentEntityType,
} from "../types";

export interface DocumentEntityRepository {
  /** Insert an extracted entity. Returns the stored row. */
  insert(input: DocumentEntityInsert): Promise<DocumentEntityRow>;
  /** Insert many entities in one round-trip. Returns the stored rows. */
  insertBatch(inputs: readonly DocumentEntityInsert[]): Promise<DocumentEntityRow[]>;
  /** Find an entity by its UUID. Returns null when not found. */
  findById(id: string): Promise<DocumentEntityRow | null>;
  /** List all entities for a document. */
  listByDocumentId(documentId: string): Promise<DocumentEntityRow[]>;
  /** List all entities of a specific type for a document. */
  listByDocumentAndType(
    documentId: string,
    entityType: DocumentEntityType,
  ): Promise<DocumentEntityRow[]>;
}

export interface CreateDocumentEntityRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createDocumentEntityRepository(
  opts: CreateDocumentEntityRepositoryOptions = {},
): DocumentEntityRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: DocumentEntityInsert): Promise<DocumentEntityRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_entities")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as DocumentEntityRow;
      } catch (e) {
        throw mapError("insert document entity", e);
      }
    },

    async insertBatch(
      inputs: readonly DocumentEntityInsert[],
    ): Promise<DocumentEntityRow[]> {
      if (inputs.length === 0) return [];
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_entities")
          .insert(inputs as DocumentEntityInsert[])
          .select();

        if (error) throw error;
        return (data as DocumentEntityRow[]) ?? [];
      } catch (e) {
        throw mapError("insert document entity batch", e);
      }
    },

    async findById(id: string): Promise<DocumentEntityRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_entities")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as DocumentEntityRow | null) ?? null;
      } catch (e) {
        throw mapError("find document entity by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<DocumentEntityRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_entities")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentEntityRow[]) ?? [];
      } catch (e) {
        throw mapError("list document entities", e);
      }
    },

    async listByDocumentAndType(
      documentId: string,
      entityType: DocumentEntityType,
    ): Promise<DocumentEntityRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_entities")
          .select()
          .eq("document_id", documentId)
          .eq("entity_type", entityType)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentEntityRow[]) ?? [];
      } catch (e) {
        throw mapError("list document entities by type", e);
      }
    },
  };
}
