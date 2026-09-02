/**
 * repositories/voyage_consumption.ts — canonical per-voyage fuel consumption
 * persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Persists the single canonical per-voyage fuel consumption model. One row per
 * (vessel, voyage, fuel) is enforced by a partial unique index, so a later
 * better-method attribution replaces the earlier one in place. Consumption is
 * NEVER derived by equal-share fallback — see `@/lib/regulatory/consumption`.
 *
 * All methods throw RepositoryError subclasses via mapError().
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { VoyageConsumptionInsert, VoyageConsumptionRow } from "../types";
import { mapError } from "../errors";

export interface VoyageConsumptionRepository {
  /** Upsert a consumption record keyed by (vessel, voyage, fuel). */
  upsert(input: VoyageConsumptionInsert): Promise<VoyageConsumptionRow>;
  findByVoyageAndFuel(
    vesselId: string,
    voyageId: string,
    fuelType: string,
  ): Promise<VoyageConsumptionRow | null>;
  /** All consumption for a vessel in a reporting year, oldest first. */
  listByVessel(vesselId: string, reportingYear: number): Promise<VoyageConsumptionRow[]>;
}

export interface CreateVoyageConsumptionRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createVoyageConsumptionRepository(
  opts: CreateVoyageConsumptionRepositoryOptions = {},
): VoyageConsumptionRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async upsert(input: VoyageConsumptionInsert): Promise<VoyageConsumptionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("voyage_consumption")
          .upsert(input, { onConflict: "vessel_id,voyage_id,fuel_type" })
          .select()
          .single();
        if (error) throw error;
        return data as VoyageConsumptionRow;
      } catch (e) {
        throw mapError("upsert voyage consumption", e);
      }
    },

    async findByVoyageAndFuel(
      vesselId: string,
      voyageId: string,
      fuelType: string,
    ): Promise<VoyageConsumptionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("voyage_consumption")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("voyage_id", voyageId)
          .eq("fuel_type", fuelType)
          .maybeSingle();
        if (error) throw error;
        return (data as VoyageConsumptionRow | null) ?? null;
      } catch (e) {
        throw mapError("find voyage consumption", e);
      }
    },

    async listByVessel(
      vesselId: string,
      reportingYear: number,
    ): Promise<VoyageConsumptionRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("voyage_consumption")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", reportingYear)
          .order("created_at");
        if (error) throw error;
        return (data as VoyageConsumptionRow[]) ?? [];
      } catch (e) {
        throw mapError("list voyage consumption", e);
      }
    },
  };
}
