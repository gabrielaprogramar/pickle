/**
 * repositories/review_tasks.ts — human review task persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Manages the human-in-the-loop review workflow. After automated processing
 * completes, a review task is created and assigned to a reviewer. This
 * repository handles insert, assignment, status transitions, and queries
 * by document or assignee.
 *
 * HOW IT FITS
 * The processing pipeline creates review tasks after OCR/extraction. The API
 * layer exposes them to reviewers. Completing a review task can trigger a
 * document status transition (e.g., under_review → approved).
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  ReviewTaskInsert,
  ReviewTaskRow,
  ReviewTaskStatus,
  ReviewTaskPriority,
} from "../types";

export interface ReviewTaskRepository {
  /** Insert a new review task. Returns the stored row. */
  insert(input: ReviewTaskInsert): Promise<ReviewTaskRow>;
  /** Find a review task by its UUID. Returns null when not found. */
  findById(id: string): Promise<ReviewTaskRow | null>;
  /** List all review tasks for a document. */
  listByDocumentId(documentId: string): Promise<ReviewTaskRow[]>;
  /** List all review tasks assigned to a user. */
  listByAssignee(assignee: string): Promise<ReviewTaskRow[]>;
  /** List review tasks by status. */
  listByStatus(status: ReviewTaskStatus): Promise<ReviewTaskRow[]>;
  /** Update a review task's status. Returns the updated row. */
  updateStatus(id: string, status: ReviewTaskStatus): Promise<ReviewTaskRow>;
  /** Assign a task to a user. Returns the updated row. */
  assign(id: string, assignee: string): Promise<ReviewTaskRow>;
  /** Complete a review task with a note. Returns the updated row. */
  complete(id: string, note: string): Promise<ReviewTaskRow>;
}

export interface CreateReviewTaskRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createReviewTaskRepository(
  opts: CreateReviewTaskRepositoryOptions = {},
): ReviewTaskRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: ReviewTaskInsert): Promise<ReviewTaskRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as ReviewTaskRow;
      } catch (e) {
        throw mapError("insert review task", e);
      }
    },

    async findById(id: string): Promise<ReviewTaskRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as ReviewTaskRow | null) ?? null;
      } catch (e) {
        throw mapError("find review task by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<ReviewTaskRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ReviewTaskRow[]) ?? [];
      } catch (e) {
        throw mapError("list review tasks by document", e);
      }
    },

    async listByAssignee(assignee: string): Promise<ReviewTaskRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .select()
          .eq("assigned_to", assignee)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ReviewTaskRow[]) ?? [];
      } catch (e) {
        throw mapError("list review tasks by assignee", e);
      }
    },

    async listByStatus(status: ReviewTaskStatus): Promise<ReviewTaskRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .select()
          .eq("status", status)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ReviewTaskRow[]) ?? [];
      } catch (e) {
        throw mapError("list review tasks by status", e);
      }
    },

    async updateStatus(id: string, status: ReviewTaskStatus): Promise<ReviewTaskRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .update({ status })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as ReviewTaskRow;
      } catch (e) {
        throw mapError("update review task status", e);
      }
    },

    async assign(id: string, assignee: string): Promise<ReviewTaskRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .update({ assigned_to: assignee, status: "in_progress" })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as ReviewTaskRow;
      } catch (e) {
        throw mapError("assign review task", e);
      }
    },

    async complete(id: string, note: string): Promise<ReviewTaskRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("review_tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            review_note: note,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as ReviewTaskRow;
      } catch (e) {
        throw mapError("complete review task", e);
      }
    },
  };
}
