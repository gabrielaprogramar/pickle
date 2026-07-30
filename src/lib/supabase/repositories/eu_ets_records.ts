import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { EuEtsRecordRow, EuEtsRecordInsert } from "@/lib/eu-ets/types";

export interface EuEtsRecordRepository {
  findByVesselAndYear(vesselId: string, year: number): Promise<EuEtsRecordRow | null>;
  upsert(record: EuEtsRecordInsert): Promise<EuEtsRecordRow>;
  listByVessel(vesselId: string): Promise<ReadonlyArray<EuEtsRecordRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateEuEtsRecordRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createEuEtsRecordRepository(
  opts: CreateEuEtsRecordRepositoryOptions = {},
): EuEtsRecordRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findByVesselAndYear(vesselId: string, year: number): Promise<EuEtsRecordRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("eu_ets_records")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", year)
          .maybeSingle();

        if (error) throw error;
        return data as EuEtsRecordRow | null;
      } catch (e) {
        throw mapError("find EU ETS record by vessel and year", e);
      }
    },

    async upsert(record: EuEtsRecordInsert): Promise<EuEtsRecordRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("eu_ets_records")
          .upsert(record, {
            onConflict: "vessel_id, reporting_year",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) throw error;
        return data as EuEtsRecordRow;
      } catch (e) {
        throw mapError("upsert EU ETS record", e);
      }
    },

    async listByVessel(vesselId: string): Promise<ReadonlyArray<EuEtsRecordRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("eu_ets_records")
          .select("*")
          .eq("vessel_id", vesselId)
          .order("reporting_year", { ascending: false });

        if (error) throw error;
        return (data ?? []) as EuEtsRecordRow[];
      } catch (e) {
        throw mapError("list EU ETS records by vessel", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("eu_ets_records")
          .delete()
          .eq("id", id);

        if (error) throw error;
      } catch (e) {
        throw mapError("delete EU ETS record", e);
      }
    },
  };
}
