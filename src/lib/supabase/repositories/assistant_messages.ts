import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { AssistantMessageRow, AssistantMessageInsert } from "../types";

export interface AssistantMessageRepository {
  findById(id: string): Promise<AssistantMessageRow | null>;
  listByConversation(conversationId: string): Promise<ReadonlyArray<AssistantMessageRow>>;
  insert(message: AssistantMessageInsert): Promise<AssistantMessageRow>;
  insertBatch(messages: ReadonlyArray<AssistantMessageInsert>): Promise<ReadonlyArray<AssistantMessageRow>>;
  delete(id: string): Promise<void>;
  deleteByConversation(conversationId: string): Promise<void>;
}

export interface CreateAssistantMessageRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAssistantMessageRepository(
  opts: CreateAssistantMessageRepositoryOptions = {},
): AssistantMessageRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<AssistantMessageRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_messages")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as AssistantMessageRow | null;
      } catch (e) {
        throw mapError("find assistant message by id", e);
      }
    },

    async listByConversation(conversationId: string): Promise<ReadonlyArray<AssistantMessageRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as AssistantMessageRow[];
      } catch (e) {
        throw mapError("list assistant messages by conversation", e);
      }
    },

    async insert(message: AssistantMessageInsert): Promise<AssistantMessageRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_messages")
          .insert(message as any)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantMessageRow;
      } catch (e) {
        throw mapError("insert assistant message", e);
      }
    },

    async insertBatch(messages: ReadonlyArray<AssistantMessageInsert>): Promise<ReadonlyArray<AssistantMessageRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_messages")
          .insert(messages as any)
          .select();
        if (error) throw error;
        return (data ?? []) as AssistantMessageRow[];
      } catch (e) {
        throw mapError("insert assistant messages batch", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("assistant_messages")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete assistant message", e);
      }
    },

    async deleteByConversation(conversationId: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("assistant_messages")
          .delete()
          .eq("conversation_id", conversationId);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete assistant messages by conversation", e);
      }
    },
  };
}
