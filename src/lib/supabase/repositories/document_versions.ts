/**
 * repositories/document_versions.ts — document version persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Tracks the upload history of a document. Each re-upload creates a new version
 * row with a monotonically increasing version_number. The repository handles
 * insert + lookup by document.
 *
 * HOW IT FITS
 * The documents repository owns the current-state record. This repository owns
 * the historical trail. On a re-upload, the caller inserts a new version and
 * updates the documents row to point at the latest file path.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { DocumentVersionInsert, DocumentVersionRow } from "../types";

export interface DocumentVersionRepository {
  /** Insert a new version for a document. Returns the stored row. */
  insert(input: DocumentVersionInsert): Promise<DocumentVersionRow>;
  /** List all versions for a document, ordered by version_number ASC. */
  listByDocumentId(documentId: string): Promise<DocumentVersionRow[]>;
  /** Find the latest (highest version_number) version for a document. */
  findLatestByDocumentId(documentId: string): Promise<DocumentVersionRow | null>;
}

export interface CreateDocumentVersionRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createDocumentVersionRepository(
  opts: CreateDocumentVersionRepositoryOptions = {},
): DocumentVersionRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: DocumentVersionInsert): Promise<DocumentVersionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_versions")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as DocumentVersionRow;
      } catch (e) {
        throw mapError("insert document version", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<DocumentVersionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_versions")
          .select()
          .eq("document_id", documentId)
          .order("version_number", { ascending: true });

        if (error) throw error;
        return (data as DocumentVersionRow[]) ?? [];
      } catch (e) {
        throw mapError("list document versions", e);
      }
    },

    async findLatestByDocumentId(
      documentId: string,
    ): Promise<DocumentVersionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_versions")
          .select()
          .eq("document_id", documentId)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as DocumentVersionRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest document version", e);
      }
    },
  };
}
