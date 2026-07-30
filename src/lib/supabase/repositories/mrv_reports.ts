import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { MrvReportRow, MrvReportInsert } from "@/lib/mrv/types";

export interface MrvReportRepository {
  findByVesselAndYear(vesselId: string, year: number): Promise<MrvReportRow | null>;
  upsert(record: MrvReportInsert): Promise<MrvReportRow>;
  listByVessel(vesselId: string): Promise<ReadonlyArray<MrvReportRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateMrvReportRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createMrvReportRepository(
  opts: CreateMrvReportRepositoryOptions = {},
): MrvReportRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findByVesselAndYear(vesselId: string, year: number): Promise<MrvReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_reports")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", year)
          .maybeSingle();

        if (error) throw error;
        return data as MrvReportRow | null;
      } catch (e) {
        throw mapError("find MRV report by vessel and year", e);
      }
    },

    async upsert(record: MrvReportInsert): Promise<MrvReportRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_reports")
          .upsert(record, {
            onConflict: "vessel_id, reporting_year",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) throw error;
        return data as MrvReportRow;
      } catch (e) {
        throw mapError("upsert MRV report", e);
      }
    },

    async listByVessel(vesselId: string): Promise<ReadonlyArray<MrvReportRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_reports")
          .select("*")
          .eq("vessel_id", vesselId)
          .order("reporting_year", { ascending: false });

        if (error) throw error;
        return (data ?? []) as MrvReportRow[];
      } catch (e) {
        throw mapError("list MRV reports by vessel", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("mrv_reports")
          .delete()
          .eq("id", id);

        if (error) throw error;
      } catch (e) {
        throw mapError("delete MRV report", e);
      }
    },
  };
}
