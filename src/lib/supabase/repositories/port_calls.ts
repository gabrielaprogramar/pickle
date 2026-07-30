import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";

export type PortCallRow = {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly port_name: string;
  readonly port_id: string | null;
  readonly port_country: string | null;
  readonly port_latitude: number | null;
  readonly port_longitude: number | null;
  readonly arr_ts: string | null;
  readonly dep_ts: string | null;
  readonly is_mock: boolean;
  readonly source: string;
  readonly source_fetched_at: string | null;
  readonly created_at: string;
};

export type PortCallInsert = {
  readonly vessel_id: string;
  readonly voyage_id?: string | null;
  readonly port_name: string;
  readonly port_id?: string | null;
  readonly port_country?: string | null;
  readonly port_latitude?: number | null;
  readonly port_longitude?: number | null;
  readonly arr_ts?: string | null;
  readonly dep_ts?: string | null;
  readonly is_mock?: boolean;
  readonly source?: string;
  readonly source_fetched_at?: string | null;
};

export interface PortCallRepository {
  findByVesselId(vesselId: string): Promise<PortCallRow[]>;
  findByVoyageId(voyageId: string): Promise<PortCallRow[]>;
  findLatestByVesselId(vesselId: string): Promise<PortCallRow | null>;
  insert(input: PortCallInsert): Promise<PortCallRow>;
  insertBatch(inputs: PortCallInsert[]): Promise<PortCallRow[]>;
}

export interface CreatePortCallRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createPortCallRepository(
  opts: CreatePortCallRepositoryOptions = {},
): PortCallRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findByVesselId(vesselId: string): Promise<PortCallRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("port_calls")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("arr_ts", { ascending: false });
      if (error) throw mapError("findByVesselId", error);
      return (data ?? []) as unknown as PortCallRow[];
    } catch (e) {
      throw mapError("findByVesselId", e);
    }
  }

  async function findByVoyageId(voyageId: string): Promise<PortCallRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("port_calls")
        .select("*")
        .eq("voyage_id", voyageId)
        .order("arr_ts", { ascending: false });
      if (error) throw mapError("findByVoyageId", error);
      return (data ?? []) as unknown as PortCallRow[];
    } catch (e) {
      throw mapError("findByVoyageId", e);
    }
  }

  async function findLatestByVesselId(vesselId: string): Promise<PortCallRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("port_calls")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("arr_ts", { ascending: false })
        .limit(1);
      if (error) throw mapError("findLatestByVesselId", error);
      const rows = (data ?? []) as unknown as PortCallRow[];
      return rows.length > 0 ? (rows[0] ?? null) : null;
    } catch (e) {
      throw mapError("findLatestByVesselId", e);
    }
  }

  async function insert(input: PortCallInsert): Promise<PortCallRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("port_calls")
        .insert(input)
        .select()
        .single();
      if (error) throw mapError("insert", error);
      return data as unknown as PortCallRow;
    } catch (e) {
      throw mapError("insert", e);
    }
  }

  async function insertBatch(inputs: PortCallInsert[]): Promise<PortCallRow[]> {
    if (inputs.length === 0) return [];
    try {
      const client = getClient();
      const { data, error } = await client
        .from("port_calls")
        .insert(inputs)
        .select();
      if (error) throw mapError("insertBatch", error);
      return (data ?? []) as unknown as PortCallRow[];
    } catch (e) {
      throw mapError("insertBatch", e);
    }
  }

  return { findByVesselId, findByVoyageId, findLatestByVesselId, insert, insertBatch };
}
