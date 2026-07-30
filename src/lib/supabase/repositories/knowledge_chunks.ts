import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { KnowledgeChunkRow, KnowledgeChunkInsert } from "../types";

export interface KnowledgeChunkRepository {
  findById(id: string): Promise<KnowledgeChunkRow | null>;
  findByDocumentId(documentId: string): Promise<ReadonlyArray<KnowledgeChunkRow>>;
  searchByKeyword(keywords: string): Promise<ReadonlyArray<KnowledgeChunkRow>>;
  insert(chunk: KnowledgeChunkInsert): Promise<KnowledgeChunkRow>;
  insertBatch(chunks: ReadonlyArray<KnowledgeChunkInsert>): Promise<ReadonlyArray<KnowledgeChunkRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateKnowledgeChunkRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createKnowledgeChunkRepository(
  opts: CreateKnowledgeChunkRepositoryOptions = {},
): KnowledgeChunkRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<KnowledgeChunkRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_chunks")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as KnowledgeChunkRow | null;
      } catch (e) {
        throw mapError("find knowledge chunk by id", e);
      }
    },

    async findByDocumentId(documentId: string): Promise<ReadonlyArray<KnowledgeChunkRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_chunks")
          .select("*")
          .eq("document_id", documentId)
          .order("chunk_index", { ascending: true });
        if (error) throw error;
        return (data ?? []) as KnowledgeChunkRow[];
      } catch (e) {
        throw mapError("find knowledge chunks by document id", e);
      }
    },

    async searchByKeyword(keywords: string): Promise<ReadonlyArray<KnowledgeChunkRow>> {
      try {
        const client = getClient();
        const terms = keywords.split(/\s+/).filter(Boolean);
        if (terms.length === 0) return [];

        const promises = terms.map((term) =>
          client
            .from("knowledge_chunks")
            .select("*")
            .ilike("content", `%${term}%`),
        );

        const results = await Promise.all(promises);
        const seen = new Set<string>();
        const all: KnowledgeChunkRow[] = [];

        for (const { data, error } of results) {
          if (error) throw error;
          for (const row of data ?? []) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              all.push(row as KnowledgeChunkRow);
            }
          }
        }

        return all;
      } catch (e) {
        throw mapError("search knowledge chunks by keyword", e);
      }
    },

    async insert(chunk: KnowledgeChunkInsert): Promise<KnowledgeChunkRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_chunks")
          .insert(chunk as any)
          .select()
          .single();
        if (error) throw error;
        return data as KnowledgeChunkRow;
      } catch (e) {
        throw mapError("insert knowledge chunk", e);
      }
    },

    async insertBatch(chunks: ReadonlyArray<KnowledgeChunkInsert>): Promise<ReadonlyArray<KnowledgeChunkRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("knowledge_chunks")
          .insert(chunks as any)
          .select();
        if (error) throw error;
        return (data ?? []) as KnowledgeChunkRow[];
      } catch (e) {
        throw mapError("insert knowledge chunks batch", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("knowledge_chunks")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete knowledge chunk", e);
      }
    },
  };
}
