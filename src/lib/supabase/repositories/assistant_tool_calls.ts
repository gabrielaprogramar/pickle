import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { AssistantToolCallRow, AssistantToolCallInsert } from "../types";

export interface AssistantToolCallRepository {
  findById(id: string): Promise<AssistantToolCallRow | null>;
  listByConversation(conversationId: string): Promise<ReadonlyArray<AssistantToolCallRow>>;
  listByToolName(toolName: string, limit?: number): Promise<ReadonlyArray<AssistantToolCallRow>>;
  insert(call: AssistantToolCallInsert): Promise<AssistantToolCallRow>;
}

export interface CreateAssistantToolCallRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAssistantToolCallRepository(
  opts: CreateAssistantToolCallRepositoryOptions = {},
): AssistantToolCallRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<AssistantToolCallRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_tool_calls")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as AssistantToolCallRow | null;
      } catch (e) {
        throw mapError("find assistant tool call by id", e);
      }
    },

    async listByConversation(conversationId: string): Promise<ReadonlyArray<AssistantToolCallRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_tool_calls")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as AssistantToolCallRow[];
      } catch (e) {
        throw mapError("list assistant tool calls by conversation", e);
      }
    },

    async listByToolName(toolName: string, limit = 50): Promise<ReadonlyArray<AssistantToolCallRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_tool_calls")
          .select("*")
          .eq("tool_name", toolName)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data ?? []) as AssistantToolCallRow[];
      } catch (e) {
        throw mapError("list assistant tool calls by tool name", e);
      }
    },

    async insert(call: AssistantToolCallInsert): Promise<AssistantToolCallRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_tool_calls")
          .insert(call as any)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantToolCallRow;
      } catch (e) {
        throw mapError("insert assistant tool call", e);
      }
    },
  };
}
