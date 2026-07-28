/**
 * repositories/processing_jobs.ts — processing job persistence + status updates
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Manages the lifecycle of async processing jobs: insert a new job, update its
 * status (pending → running → completed/failed), and look up jobs by document.
 * Processing jobs drive the document through its status transitions.
 *
 * HOW IT FITS
 * The processing pipeline creates a job, marks it running, executes the work,
 * then marks it completed or failed. The orchestrator queries by document_id
 * + job_type to determine what processing remains.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  ProcessingJobInsert,
  ProcessingJobRow,
  ProcessingJobStatus,
  ProcessingJobType,
} from "../types";

export interface ProcessingJobRepository {
  /** Insert a new processing job. Returns the stored row. */
  insert(input: ProcessingJobInsert): Promise<ProcessingJobRow>;
  /** Find a job by its UUID. Returns null when not found. */
  findById(id: string): Promise<ProcessingJobRow | null>;
  /** List all jobs for a document, ordered by created_at DESC. */
  listByDocumentId(documentId: string): Promise<ProcessingJobRow[]>;
  /** Find the latest job of a given type for a document. */
  findLatestByDocumentAndType(
    documentId: string,
    jobType: ProcessingJobType,
  ): Promise<ProcessingJobRow | null>;
  /** Update a job's status (plus optional timestamp/error fields). */
  updateStatus(
    id: string,
    status: ProcessingJobStatus,
    extra?: {
      started_at?: string;
      completed_at?: string;
      error_message?: string | null;
      result?: Record<string, unknown> | null;
    },
  ): Promise<ProcessingJobRow>;
}

export interface CreateProcessingJobRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createProcessingJobRepository(
  opts: CreateProcessingJobRepositoryOptions = {},
): ProcessingJobRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: ProcessingJobInsert): Promise<ProcessingJobRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_jobs")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as ProcessingJobRow;
      } catch (e) {
        throw mapError("insert processing job", e);
      }
    },

    async findById(id: string): Promise<ProcessingJobRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_jobs")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as ProcessingJobRow | null) ?? null;
      } catch (e) {
        throw mapError("find processing job by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<ProcessingJobRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_jobs")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ProcessingJobRow[]) ?? [];
      } catch (e) {
        throw mapError("list processing jobs by document", e);
      }
    },

    async findLatestByDocumentAndType(
      documentId: string,
      jobType: ProcessingJobType,
    ): Promise<ProcessingJobRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_jobs")
          .select()
          .eq("document_id", documentId)
          .eq("job_type", jobType)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as ProcessingJobRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest processing job", e);
      }
    },

    async updateStatus(
      id: string,
      status: ProcessingJobStatus,
      extra?: {
        started_at?: string;
        completed_at?: string;
        error_message?: string | null;
        result?: Record<string, unknown> | null;
      },
    ): Promise<ProcessingJobRow> {
      try {
        const client = getClient();
        const update: Record<string, unknown> = { status };
        if (extra?.started_at !== undefined) update.started_at = extra.started_at;
        if (extra?.completed_at !== undefined) update.completed_at = extra.completed_at;
        if (extra?.error_message !== undefined) update.error_message = extra.error_message;
        if (extra?.result !== undefined) update.result = extra.result;

        const { data, error } = await client
          .from("processing_jobs")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(update as any)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as ProcessingJobRow;
      } catch (e) {
        throw mapError("update processing job status", e);
      }
    },
  };
}
