/**
 * repositories/processing_logs.ts — processing audit log persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Append-only audit trail for all processing pipeline events. Every status
 * change, warning, or error during document processing is recorded here.
 * Supports debugging, compliance auditing, and operational monitoring.
 *
 * HOW IT FITS
 * The processing pipeline writes log entries as it executes. The API layer
 * reads logs to display processing history. This table is append-only: no
 * update or delete operations.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  ProcessingLogInsert,
  ProcessingLogRow,
  ProcessingLogLevel,
} from "../types";

export interface ProcessingLogRepository {
  /** Append a log entry. Returns the stored row. */
  insert(input: ProcessingLogInsert): Promise<ProcessingLogRow>;
  /** List all logs for a processing job, ordered by created_at ASC. */
  listByJobId(jobId: string): Promise<ProcessingLogRow[]>;
  /** List all logs for a processing job at a given severity level. */
  listByJobAndLevel(
    jobId: string,
    level: ProcessingLogLevel,
  ): Promise<ProcessingLogRow[]>;
}

export interface CreateProcessingLogRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createProcessingLogRepository(
  opts: CreateProcessingLogRepositoryOptions = {},
): ProcessingLogRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: ProcessingLogInsert): Promise<ProcessingLogRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_logs")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as ProcessingLogRow;
      } catch (e) {
        throw mapError("insert processing log", e);
      }
    },

    async listByJobId(jobId: string): Promise<ProcessingLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_logs")
          .select()
          .eq("processing_job_id", jobId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data as ProcessingLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list processing logs by job", e);
      }
    },

    async listByJobAndLevel(
      jobId: string,
      level: ProcessingLogLevel,
    ): Promise<ProcessingLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("processing_logs")
          .select()
          .eq("processing_job_id", jobId)
          .eq("level", level)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data as ProcessingLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list processing logs by job and level", e);
      }
    },
  };
}
