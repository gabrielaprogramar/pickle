/**
 * repositories/noon_reports.ts — noon report persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Persists raw noon reports and their deterministic evaluation output
 * (analysis, findings, fuel/voyage/FuelEU/ETS correlations) so the Noon Report
 * Intelligence service and the /noon surfaces can query history without
 * re-running the engines.
 *
 * HOW IT FITS
 * The noon report API reads/writes through this repository. Evaluations are
 * stored on the report row itself (jsonb columns) — one row per report.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { NoonReportInsert, NoonReportRow } from "../types";

export type NoonReportUpdate = Partial<NoonReportInsert>;

export interface NoonReportRepository {
  insert(input: NoonReportInsert): Promise<NoonReportRow>;
  findById(id: string): Promise<NoonReportRow | null>;
  /** Ordered by report_date descending. */
  listByVesselId(vesselId: string, limit?: number): Promise<NoonReportRow[]>;
  findLatestByVesselId(vesselId: string): Promise<NoonReportRow | null>;
  update(id: string, patch: NoonReportUpdate): Promise<NoonReportRow>;
}

export interface CreateNoonReportRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createNoonReportRepository(
  opts: CreateNoonReportRepositoryOptions = {},
): NoonReportRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: NoonReportInsert): Promise<NoonReportRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("noon_reports")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as NoonReportRow;
      } catch (e) {
        throw mapError("insert noon report", e);
      }
    },

    async findById(id: string): Promise<NoonReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("noon_reports")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as NoonReportRow | null) ?? null;
      } catch (e) {
        throw mapError("find noon report by id", e);
      }
    },

    async listByVesselId(vesselId: string, limit = 50): Promise<NoonReportRow[]> {
      try {
        const client = getClient();
        let query = client
          .from("noon_reports")
          .select()
          .eq("vessel_id", vesselId)
          .order("report_date", { ascending: false });
        if (limit > 0) query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        return (data as NoonReportRow[]) ?? [];
      } catch (e) {
        throw mapError("list noon reports by vessel", e);
      }
    },

    async findLatestByVesselId(vesselId: string): Promise<NoonReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("noon_reports")
          .select()
          .eq("vessel_id", vesselId)
          .order("report_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as NoonReportRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest noon report", e);
      }
    },

    async update(id: string, patch: NoonReportUpdate): Promise<NoonReportRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("noon_reports")
          .update(patch)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as NoonReportRow;
      } catch (e) {
        throw mapError("update noon report", e);
      }
    },
  };
}
