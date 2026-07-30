import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";

export type ZoneEventRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly zone_id: string;
  readonly event_type: string;
  readonly ais_position_id: string | null;
  readonly detected_at: string;
  readonly entry_ts: string | null;
  readonly exit_ts: string | null;
  readonly duration_minutes: number | null;
  readonly coordinates: unknown;
  readonly details: unknown;
  readonly calculation_version: string;
  readonly created_at: string;
};

export type ZoneEventInsert = {
  readonly vessel_id: string;
  readonly zone_id: string;
  readonly event_type: string;
  readonly ais_position_id?: string | null;
  readonly detected_at: string;
  readonly entry_ts?: string | null;
  readonly exit_ts?: string | null;
  readonly duration_minutes?: number | null;
  readonly coordinates?: unknown;
  readonly details?: unknown;
  readonly calculation_version?: string;
};

export interface ZoneEventRepository {
  findByVesselId(vesselId: string): Promise<ZoneEventRow[]>;
  findByZoneId(zoneId: string): Promise<ZoneEventRow[]>;
  findRecentByVesselId(vesselId: string, limit?: number): Promise<ZoneEventRow[]>;
  insert(input: ZoneEventInsert): Promise<ZoneEventRow>;
  insertBatch(inputs: ZoneEventInsert[]): Promise<ZoneEventRow[]>;
}

export interface CreateZoneEventRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createZoneEventRepository(
  opts: CreateZoneEventRepositoryOptions = {},
): ZoneEventRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findByVesselId(vesselId: string): Promise<ZoneEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("zone_events")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("detected_at", { ascending: false });
      if (error) throw mapError("findByVesselId", error);
      return (data ?? []) as unknown as ZoneEventRow[];
    } catch (e) {
      throw mapError("findByVesselId", e);
    }
  }

  async function findByZoneId(zoneId: string): Promise<ZoneEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("zone_events")
        .select("*")
        .eq("zone_id", zoneId)
        .order("detected_at", { ascending: false });
      if (error) throw mapError("findByZoneId", error);
      return (data ?? []) as unknown as ZoneEventRow[];
    } catch (e) {
      throw mapError("findByZoneId", e);
    }
  }

  async function findRecentByVesselId(
    vesselId: string,
    max: number = 20,
  ): Promise<ZoneEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("zone_events")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("detected_at", { ascending: false })
        .limit(max);
      if (error) throw mapError("findRecentByVesselId", error);
      return (data ?? []) as unknown as ZoneEventRow[];
    } catch (e) {
      throw mapError("findRecentByVesselId", e);
    }
  }

  async function insert(input: ZoneEventInsert): Promise<ZoneEventRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("zone_events")
        .insert(input)
        .select()
        .single();
      if (error) throw mapError("insert", error);
      return data as unknown as ZoneEventRow;
    } catch (e) {
      throw mapError("insert", e);
    }
  }

  async function insertBatch(inputs: ZoneEventInsert[]): Promise<ZoneEventRow[]> {
    if (inputs.length === 0) return [];
    try {
      const client = getClient();
      const { data, error } = await client
        .from("zone_events")
        .insert(inputs)
        .select();
      if (error) throw mapError("insertBatch", error);
      return (data ?? []) as unknown as ZoneEventRow[];
    } catch (e) {
      throw mapError("insertBatch", e);
    }
  }

  return { findByVesselId, findByZoneId, findRecentByVesselId, insert, insertBatch };
}
