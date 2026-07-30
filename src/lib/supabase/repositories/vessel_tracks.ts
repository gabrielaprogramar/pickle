import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";

export type VesselTrackRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly track: unknown;
  readonly point_count: number;
  readonly distance_nm: number | null;
  readonly start_ts: string;
  readonly end_ts: string;
  readonly calculation_version: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type VesselTrackInsert = {
  readonly vessel_id: string;
  readonly voyage_id?: string | null;
  readonly track: unknown;
  readonly point_count: number;
  readonly distance_nm?: number | null;
  readonly start_ts: string;
  readonly end_ts: string;
  readonly calculation_version?: string;
};

export interface VesselTrackRepository {
  findByVesselId(vesselId: string): Promise<VesselTrackRow[]>;
  findByVesselAndVoyage(vesselId: string, voyageId: string): Promise<VesselTrackRow | null>;
  upsert(input: VesselTrackInsert): Promise<VesselTrackRow>;
}

export interface CreateVesselTrackRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createVesselTrackRepository(
  opts: CreateVesselTrackRepositoryOptions = {},
): VesselTrackRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findByVesselId(vesselId: string): Promise<VesselTrackRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("vessel_tracks")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("start_ts", { ascending: false });
      if (error) throw mapError("findByVesselId", error);
      return (data ?? []) as unknown as VesselTrackRow[];
    } catch (e) {
      throw mapError("findByVesselId", e);
    }
  }

  async function findByVesselAndVoyage(
    vesselId: string,
    voyageId: string,
  ): Promise<VesselTrackRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("vessel_tracks")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("voyage_id", voyageId)
        .maybeSingle();
      if (error) throw mapError("findByVesselAndVoyage", error);
      return (data ?? null) as unknown as VesselTrackRow | null;
    } catch (e) {
      throw mapError("findByVesselAndVoyage", e);
    }
  }

  async function upsert(input: VesselTrackInsert): Promise<VesselTrackRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("vessel_tracks")
        .upsert(input, {
          onConflict: "vessel_id, voyage_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();
      if (error) throw mapError("upsert", error);
      return data as unknown as VesselTrackRow;
    } catch (e) {
      throw mapError("upsert", e);
    }
  }

  return { findByVesselId, findByVesselAndVoyage, upsert };
}
