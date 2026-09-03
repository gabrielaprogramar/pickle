/**
 * repositories/mrv_report_versions.ts — append-only revision/amendment trail for
 * an annual EU MRV report
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 requires that annual MRV reports support revisions/amendments WITHOUT
 * destroying history. History lives in the append-only `mrv_report_versions`
 * table: each revision is a new row keyed by (mrv_report_id, version_number).
 * The annual HEAD lives in `mrv_reports`; the numbers in the latest revision
 * mirror the HEAD. This repository appends and reads versions; it never rewrites
 * a recorded version in place (immutability is also enforced in code).
 *
 * All methods throw RepositoryError subclasses via mapError().
 */

import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  MrvReportVersionRow,
  MrvReportVersionInsert,
} from "../types";

export interface MrvReportVersionRepository {
  /** Latest (highest) version for an annual report, or null. */
  findLatest(reportId: string): Promise<MrvReportVersionRow | null>;
  /** All versions for an annual report, ascending by version_number. */
  listByReport(reportId: string): Promise<MrvReportVersionRow[]>;
  /** Append a new (immutable) revision. */
  append(version: MrvReportVersionInsert): Promise<MrvReportVersionRow>;
}

export interface CreateMrvReportVersionRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createMrvReportVersionRepository(
  opts: CreateMrvReportVersionRepositoryOptions = {},
): MrvReportVersionRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findLatest(reportId: string): Promise<MrvReportVersionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_report_versions")
          .select("*")
          .eq("mrv_report_id", reportId)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return (data as MrvReportVersionRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest report version", e);
      }
    },

    async listByReport(reportId: string): Promise<MrvReportVersionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_report_versions")
          .select("*")
          .eq("mrv_report_id", reportId)
          .order("version_number", { ascending: true });
        if (error) throw error;
        return (data as MrvReportVersionRow[]) ?? [];
      } catch (e) {
        throw mapError("list report versions", e);
      }
    },

    async append(version: MrvReportVersionInsert): Promise<MrvReportVersionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_report_versions")
          .insert(version as any)
          .select()
          .single();
        if (error) throw error;
        return data as MrvReportVersionRow;
      } catch (e) {
        throw mapError("append report version", e);
      }
    },
  };
}
