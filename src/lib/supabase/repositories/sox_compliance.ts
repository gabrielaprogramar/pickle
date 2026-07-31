/**
 * repositories/sox_compliance.ts — SOx ECA compliance watch persistence
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Wraps `sox_compliance_events` (append-only) and `sox_watch_state` (snapshot).
 * Follows the self-contained repository style of zone_events.ts: local row
 * types, injected client, mapped errors.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  SoxComplianceEventInsert as SoxComplianceEventInsertType,
  SoxComplianceEventRow as SoxComplianceEventRowType,
  SoxWatchStateInsert as SoxWatchStateInsertType,
  SoxWatchStateRow as SoxWatchStateRowType,
} from "../types";

export type SoxEventRow = SoxComplianceEventRowType;
export type SoxEventInsert = SoxComplianceEventInsertType;
export type SoxWatchStateRow = SoxWatchStateRowType;
export type SoxWatchStateInsert = SoxWatchStateInsertType;

export interface SoxComplianceRepository {
  findLatestEvent(vesselId: string): Promise<SoxEventRow | null>;
  findEventsByVesselId(vesselId: string, limit?: number): Promise<SoxEventRow[]>;
  insertEvent(input: SoxEventInsert): Promise<SoxEventRow>;
  findWatchState(vesselId: string): Promise<SoxWatchStateRow | null>;
  upsertWatchState(input: SoxWatchStateInsert): Promise<SoxWatchStateRow>;
}

export interface CreateSoxComplianceRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createSoxComplianceRepository(
  opts: CreateSoxComplianceRepositoryOptions = {},
): SoxComplianceRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findLatestEvent(vesselId: string): Promise<SoxEventRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("sox_compliance_events")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("event_ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapError("findLatestEvent", error);
      return (data ?? null) as unknown as SoxEventRow | null;
    } catch (e) {
      throw mapError("findLatestEvent", e);
    }
  }

  async function findEventsByVesselId(
    vesselId: string,
    max: number = 50,
  ): Promise<SoxEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("sox_compliance_events")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("event_ts", { ascending: false })
        .limit(max);
      if (error) throw mapError("findEventsByVesselId", error);
      return (data ?? []) as unknown as SoxEventRow[];
    } catch (e) {
      throw mapError("findEventsByVesselId", e);
    }
  }

  async function insertEvent(input: SoxEventInsert): Promise<SoxEventRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("sox_compliance_events")
        .insert(input)
        .select()
        .single();
      if (error) throw mapError("insertEvent", error);
      return data as unknown as SoxEventRow;
    } catch (e) {
      throw mapError("insertEvent", e);
    }
  }

  async function findWatchState(vesselId: string): Promise<SoxWatchStateRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("sox_watch_state")
        .select("*")
        .eq("vessel_id", vesselId)
        .maybeSingle();
      if (error) throw mapError("findWatchState", error);
      return (data ?? null) as unknown as SoxWatchStateRow | null;
    } catch (e) {
      throw mapError("findWatchState", e);
    }
  }

  async function upsertWatchState(input: SoxWatchStateInsert): Promise<SoxWatchStateRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("sox_watch_state")
        .upsert(input, { onConflict: "vessel_id" })
        .select()
        .single();
      if (error) throw mapError("upsertWatchState", error);
      return data as unknown as SoxWatchStateRow;
    } catch (e) {
      throw mapError("upsertWatchState", e);
    }
  }

  return {
    findLatestEvent,
    findEventsByVesselId,
    insertEvent,
    findWatchState,
    upsertWatchState,
  };
}
