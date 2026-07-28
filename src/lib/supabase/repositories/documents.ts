/**
 * repositories/documents.ts — document persistence (insert, find, update status)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The core document entity repository. Handles the full lifecycle of a
 * compliance document: upload (insert), lookup by various keys, status
 * transitions, and listing with filtering. Every other document-domain
 * repository references documents by their UUID.
 *
 * HOW IT FITS
 * The API route calls insertDocument on upload, then downstream processing
 * jobs update the status via updateStatus. find* methods support the UI
 * query paths. All methods throw RepositoryError subclasses via mapError().
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  DocumentInsert,
  DocumentRow,
  DocumentStatus,
  DocumentType,
} from "../types";

export interface DocumentRepository {
  /** Insert a new document. Returns the stored row with server defaults. */
  insert(input: DocumentInsert): Promise<DocumentRow>;
  /** Find a document by its UUID. Returns null when not found. */
  findById(id: string): Promise<DocumentRow | null>;
  /** Update a document's processing status. Returns the updated row. */
  updateStatus(id: string, status: DocumentStatus): Promise<DocumentRow>;
  /** List all documents, optionally filtered by vessel_id. */
  listByVesselId(vesselId: string): Promise<DocumentRow[]>;
  /** List all documents, optionally filtered by type. */
  listByType(documentType: DocumentType): Promise<DocumentRow[]>;
}

export interface CreateDocumentRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createDocumentRepository(
  opts: CreateDocumentRepositoryOptions = {},
): DocumentRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: DocumentInsert): Promise<DocumentRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("documents")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as DocumentRow;
      } catch (e) {
        throw mapError("insert document", e);
      }
    },

    async findById(id: string): Promise<DocumentRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("documents")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as DocumentRow | null) ?? null;
      } catch (e) {
        throw mapError("find document by id", e);
      }
    },

    async updateStatus(id: string, status: DocumentStatus): Promise<DocumentRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("documents")
          .update({ status })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as DocumentRow;
      } catch (e) {
        throw mapError("update document status", e);
      }
    },

    async listByVesselId(vesselId: string): Promise<DocumentRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("documents")
          .select()
          .eq("vessel_id", vesselId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentRow[]) ?? [];
      } catch (e) {
        throw mapError("list documents by vessel", e);
      }
    },

    async listByType(documentType: DocumentType): Promise<DocumentRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("documents")
          .select()
          .eq("document_type", documentType)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentRow[]) ?? [];
      } catch (e) {
        throw mapError("list documents by type", e);
      }
    },
  };
}
