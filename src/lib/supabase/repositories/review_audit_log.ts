import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { ReviewAuditLogRow, ReviewAuditLogInsert } from "../types";

export interface ReviewAuditLogRepository {
  insert(input: ReviewAuditLogInsert): Promise<ReviewAuditLogRow>;
  listByReviewTaskId(reviewTaskId: string): Promise<ReviewAuditLogRow[]>;
}

export interface CreateReviewAuditLogRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createReviewAuditLogRepository(
  opts: CreateReviewAuditLogRepositoryOptions = {},
): ReviewAuditLogRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: ReviewAuditLogInsert): Promise<ReviewAuditLogRow> {
      try {
        const client = getClient();
        const payload = {
          review_task_id: input.review_task_id,
          field_name: input.field_name ?? null,
          action: input.action,
          previous_value: input.previous_value ?? null,
          new_value: input.new_value ?? null,
          reviewer: input.reviewer,
          notes: input.notes ?? null,
        };

        const { data, error } = await client
          .from("review_audit_log")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as ReviewAuditLogRow;
      } catch (e) {
        throw mapError("insert review audit log", e);
      }
    },

    async listByReviewTaskId(reviewTaskId: string): Promise<ReviewAuditLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_audit_log")
          .select()
          .eq("review_task_id", reviewTaskId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data as ReviewAuditLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list review audit log by task", e);
      }
    },
  };
}
