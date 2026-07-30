import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  AssistantEvaluationLogRow,
  AssistantEvaluationLogInsert,
} from "../types";

export interface AssistantEvaluationLogRepository {
  findById(id: string): Promise<AssistantEvaluationLogRow | null>;
  listByTestName(testName: string): Promise<ReadonlyArray<AssistantEvaluationLogRow>>;
  list(limit?: number, offset?: number): Promise<ReadonlyArray<AssistantEvaluationLogRow>>;
  insert(entry: AssistantEvaluationLogInsert): Promise<AssistantEvaluationLogRow>;
}

export interface CreateAssistantEvaluationLogRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAssistantEvaluationLogRepository(
  opts: CreateAssistantEvaluationLogRepositoryOptions = {},
): AssistantEvaluationLogRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<AssistantEvaluationLogRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_evaluation_log")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as AssistantEvaluationLogRow | null;
      } catch (e) {
        throw mapError("find assistant evaluation log by id", e);
      }
    },

    async listByTestName(testName: string): Promise<ReadonlyArray<AssistantEvaluationLogRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_evaluation_log")
          .select("*")
          .eq("test_name", testName)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as AssistantEvaluationLogRow[];
      } catch (e) {
        throw mapError("list assistant evaluation log by test name", e);
      }
    },

    async list(limit = 50, offset = 0): Promise<ReadonlyArray<AssistantEvaluationLogRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_evaluation_log")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as AssistantEvaluationLogRow[];
      } catch (e) {
        throw mapError("list assistant evaluation logs", e);
      }
    },

    async insert(entry: AssistantEvaluationLogInsert): Promise<AssistantEvaluationLogRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("assistant_evaluation_log")
          .insert(entry as any)
          .select()
          .single();
        if (error) throw error;
        return data as AssistantEvaluationLogRow;
      } catch (e) {
        throw mapError("insert assistant evaluation log", e);
      }
    },
  };
}
