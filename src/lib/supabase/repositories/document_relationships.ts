/**
 * repositories/document_relationships.ts — inter-document link persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Records typed relationships between documents: supersedes, amends, references,
 * requires, attached_to. The UNIQUE composite (source, target, type) prevents
 * duplicate links.
 *
 * HOW IT FITS
 * The API layer creates relationships when documents reference each other
 * (e.g., a new report supersedes an old one). The UI traverses relationships
 * to show document lineage and dependencies.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  DocumentRelationshipInsert,
  DocumentRelationshipRow,
  DocumentRelationshipType,
} from "../types";

export interface DocumentRelationshipRepository {
  /** Insert a relationship. Returns the stored row. */
  insert(input: DocumentRelationshipInsert): Promise<DocumentRelationshipRow>;
  /** Find a relationship by its UUID. Returns null when not found. */
  findById(id: string): Promise<DocumentRelationshipRow | null>;
  /** List all outgoing relationships from a document. */
  listBySourceDocumentId(documentId: string): Promise<DocumentRelationshipRow[]>;
  /** List all incoming relationships to a document. */
  listByTargetDocumentId(documentId: string): Promise<DocumentRelationshipRow[]>;
  /** List relationships of a specific type for a source document. */
  listBySourceAndType(
    documentId: string,
    relationshipType: DocumentRelationshipType,
  ): Promise<DocumentRelationshipRow[]>;
}

export interface CreateDocumentRelationshipRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createDocumentRelationshipRepository(
  opts: CreateDocumentRelationshipRepositoryOptions = {},
): DocumentRelationshipRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(
      input: DocumentRelationshipInsert,
    ): Promise<DocumentRelationshipRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_relationships")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as DocumentRelationshipRow;
      } catch (e) {
        throw mapError("insert document relationship", e);
      }
    },

    async findById(id: string): Promise<DocumentRelationshipRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_relationships")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as DocumentRelationshipRow | null) ?? null;
      } catch (e) {
        throw mapError("find document relationship by id", e);
      }
    },

    async listBySourceDocumentId(
      documentId: string,
    ): Promise<DocumentRelationshipRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_relationships")
          .select()
          .eq("source_document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentRelationshipRow[]) ?? [];
      } catch (e) {
        throw mapError("list document relationships by source", e);
      }
    },

    async listByTargetDocumentId(
      documentId: string,
    ): Promise<DocumentRelationshipRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_relationships")
          .select()
          .eq("target_document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentRelationshipRow[]) ?? [];
      } catch (e) {
        throw mapError("list document relationships by target", e);
      }
    },

    async listBySourceAndType(
      documentId: string,
      relationshipType: DocumentRelationshipType,
    ): Promise<DocumentRelationshipRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("document_relationships")
          .select()
          .eq("source_document_id", documentId)
          .eq("relationship_type", relationshipType)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as DocumentRelationshipRow[]) ?? [];
      } catch (e) {
        throw mapError("list document relationships by source and type", e);
      }
    },
  };
}
