import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { FuelEuRecordRow, FuelEuRecordInsert } from "@/lib/fueleu/types";

export interface FuelEuRecordRepository {
  findByVesselAndYear(vesselId: string, year: number): Promise<FuelEuRecordRow | null>;
  upsert(record: FuelEuRecordInsert): Promise<FuelEuRecordRow>;
  listByVessel(vesselId: string): Promise<ReadonlyArray<FuelEuRecordRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateFuelEuRecordRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createFuelEuRecordRepository(
  opts: CreateFuelEuRecordRepositoryOptions = {},
): FuelEuRecordRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findByVesselAndYear(vesselId: string, year: number): Promise<FuelEuRecordRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_eu_records")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", year)
          .maybeSingle();

        if (error) throw error;
        return data as FuelEuRecordRow | null;
      } catch (e) {
        throw mapError("find FuelEU record by vessel and year", e);
      }
    },

    async upsert(record: FuelEuRecordInsert): Promise<FuelEuRecordRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_eu_records")
          .upsert(record, {
            onConflict: "vessel_id, reporting_year",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) throw error;
        return data as FuelEuRecordRow;
      } catch (e) {
        throw mapError("upsert FuelEU record", e);
      }
    },

    async listByVessel(vesselId: string): Promise<ReadonlyArray<FuelEuRecordRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_eu_records")
          .select("*")
          .eq("vessel_id", vesselId)
          .order("reporting_year", { ascending: false });

        if (error) throw error;
        return (data ?? []) as FuelEuRecordRow[];
      } catch (e) {
        throw mapError("list FuelEU records by vessel", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("fuel_eu_records")
          .delete()
          .eq("id", id);

        if (error) throw error;
      } catch (e) {
        throw mapError("delete FuelEU record", e);
      }
    },
  };
}
