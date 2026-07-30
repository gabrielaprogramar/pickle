import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  KnowledgeDocumentRow,
  KnowledgeDocumentInsert,
  KnowledgeSource,
  KnowledgeRegulation,
} from "../types";

export interface KnowledgeDocumentRepository {
  findById(id: string): Promise<KnowledgeDocumentRow | null>;
  listByRegulation(regulation: KnowledgeRegulation): Promise<ReadonlyArray<KnowledgeDocumentRow>>;
  listBySource(source: KnowledgeSource): Promise<ReadonlyArray<KnowledgeDocumentRow>>;
  list(limit?: number, offset?: number): Promise<ReadonlyArray<KnowledgeDocumentRow>>;
  insert(doc: KnowledgeDocumentInsert): Promise<KnowledgeDocumentRow>;
  update(id: string, changes: Partial<KnowledgeDocumentInsert>): Promise<KnowledgeDocumentRow>;
  delete(id: string): Promise<void>;
}

export interface CreateKnowledgeDocumentRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createKnowledgeDocumentRepository(
  opts: CreateKnowledgeDocumentRepositoryOptions = {},
): KnowledgeDocumentRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<KnowledgeDocumentRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as KnowledgeDocumentRow | null;
      } catch (e) {
        throw mapError("find knowledge document by id", e);
      }
    },

    async listByRegulation(regulation: KnowledgeRegulation): Promise<ReadonlyArray<KnowledgeDocumentRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .select("*")
          .eq("regulation", regulation)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as KnowledgeDocumentRow[];
      } catch (e) {
        throw mapError("list knowledge documents by regulation", e);
      }
    },

    async listBySource(source: KnowledgeSource): Promise<ReadonlyArray<KnowledgeDocumentRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .select("*")
          .eq("source", source)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as KnowledgeDocumentRow[];
      } catch (e) {
        throw mapError("list knowledge documents by source", e);
      }
    },

    async list(limit = 50, offset = 0): Promise<ReadonlyArray<KnowledgeDocumentRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as KnowledgeDocumentRow[];
      } catch (e) {
        throw mapError("list knowledge documents", e);
      }
    },

    async insert(doc: KnowledgeDocumentInsert): Promise<KnowledgeDocumentRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .insert(doc as any)
          .select()
          .single();
        if (error) throw error;
        return data as KnowledgeDocumentRow;
      } catch (e) {
        throw mapError("insert knowledge document", e);
      }
    },

    async update(id: string, changes: Partial<KnowledgeDocumentInsert>): Promise<KnowledgeDocumentRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_documents")
          .update(changes as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as KnowledgeDocumentRow;
      } catch (e) {
        throw mapError("update knowledge document", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("knowledge_documents")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete knowledge document", e);
      }
    },
  };
}
