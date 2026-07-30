import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  AssistantConversationRow,
  AssistantConversationInsert,
} from "../types";

export interface AssistantConversationRepository {
  findById(id: string): Promise<AssistantConversationRow | null>;
  listByUser(userId: string, limit?: number, offset?: number): Promise<ReadonlyArray<AssistantConversationRow>>;
  listActiveByUser(userId: string): Promise<ReadonlyArray<AssistantConversationRow>>;
  insert(conversation: AssistantConversationInsert): Promise<AssistantConversationRow>;
  update(id: string, changes: Partial<AssistantConversationInsert>): Promise<AssistantConversationRow>;
  archive(id: string): Promise<AssistantConversationRow>;
  delete(id: string): Promise<void>;
}

export interface CreateAssistantConversationRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAssistantConversationRepository(
  opts: CreateAssistantConversationRepositoryOptions = {},
): AssistantConversationRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<AssistantConversationRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as AssistantConversationRow | null;
      } catch (e) {
        throw mapError("find assistant conversation by id", e);
      }
    },

    async listByUser(userId: string, limit = 50, offset = 0): Promise<ReadonlyArray<AssistantConversationRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as AssistantConversationRow[];
      } catch (e) {
        throw mapError("list assistant conversations by user", e);
      }
    },

    async listActiveByUser(userId: string): Promise<ReadonlyArray<AssistantConversationRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as AssistantConversationRow[];
      } catch (e) {
        throw mapError("list active assistant conversations by user", e);
      }
    },

    async insert(conversation: AssistantConversationInsert): Promise<AssistantConversationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .insert(conversation as any)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantConversationRow;
      } catch (e) {
        throw mapError("insert assistant conversation", e);
      }
    },

    async update(id: string, changes: Partial<AssistantConversationInsert>): Promise<AssistantConversationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .update(changes as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantConversationRow;
      } catch (e) {
        throw mapError("update assistant conversation", e);
      }
    },

    async archive(id: string): Promise<AssistantConversationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_conversations")
          .update({ status: "ARCHIVED" } as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantConversationRow;
      } catch (e) {
        throw mapError("archive assistant conversation", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("assistant_conversations")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete assistant conversation", e);
      }
    },
  };
}
