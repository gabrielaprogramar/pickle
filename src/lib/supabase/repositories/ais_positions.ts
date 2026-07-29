/**
 * repositories/ais_positions.ts — AIS fix persistence (write + latest read)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * `ais_positions` is the high-volume time-series table: potentially thousands of
 * fixes per vessel per day. This repository exposes the two operations the
 * ingest + monitoring paths need:
 *
 *   1. insert() — write a single position fix. Plain insert; batching is a
 *      later optimization (the table is indexed to absorb inserts cheaply).
 *
 *   2. insertBatch() — write many fixes in one round-trip. Used when a backfill
 *      or a polling loop delivers multiple fixes at once.
 *
 *   3. findLatestByVesselId() — the dominant read: newest fix for a vessel.
 *      Backed by the (vessel_id, ts DESC) index — an index-only lookup.
 *
 * HOW IT FITS
 * Independent of the voyage flow: a position fix can arrive before any voyage
 * is recorded (the vessel row is the only prerequisite, enforced by FK). Tests
 * inject a fake client; production uses the singleton. All errors mapped.
 *
 * DESIGN NOTE — no upsert here
 * Position rows are append-only by nature (a fix at a given ts is immutable).
 * A unique (vessel_id, ts) constraint would be possible but is intentionally
 * NOT added in Phase 1B to keep insert throughput high; duplicate-suppression
 * is the caller's concern and can be revisited when dedup requirements appear.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  AisPositionInsert,
  AisPositionRow,
  Page,
  PaginationOptions,
} from "../types";
import { normalizePagination } from "../types";
import {
  createVesselRepository,
  type VesselRepository,
} from "./vessels";

export interface AisPositionsRepository {
  /** Insert a single AIS position fix. Returns the stored row. */
  insert(input: AisPositionInsert): Promise<AisPositionRow>;
  /** Insert many fixes in one round-trip. Returns the stored rows. */
  insertBatch(inputs: readonly AisPositionInsert[]): Promise<AisPositionRow[]>;
  /** Newest position for a vessel (by internal vessel UUID). Null if none. */
  findLatestByVesselId(vesselId: string): Promise<AisPositionRow | null>;
  /** List a vessel's AIS fixes newest-first as a paginated Page, resolved by IMO. */
  findByVesselImo(
    imo: string,
    pagination?: Partial<PaginationOptions>,
  ): Promise<Page<AisPositionRow>>;
}

export interface CreateAisPositionsRepositoryOptions {
  readonly client?: TypedSupabaseClient;
  /** Inject the vessel repository (tests). Defaults to one built from `client`. */
  readonly vesselRepository?: VesselRepository;
}

export function createAisPositionsRepository(
  opts: CreateAisPositionsRepositoryOptions = {},
): AisPositionsRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();
  const vessels = opts.vesselRepository ?? createVesselRepository({ client: opts.client });

  return {
    async insert(input: AisPositionInsert): Promise<AisPositionRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ais_positions")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as AisPositionRow;
      } catch (e) {
        throw mapError("insert AIS position", e);
      }
    },

    async insertBatch(
      inputs: readonly AisPositionInsert[],
    ): Promise<AisPositionRow[]> {
      if (inputs.length === 0) return [];
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ais_positions")
          .insert(inputs as AisPositionInsert[])
          .select();

        if (error) throw error;
        return (data as AisPositionRow[]) ?? [];
      } catch (e) {
        throw mapError("insert AIS position batch", e);
      }
    },

    async findLatestByVesselId(vesselId: string): Promise<AisPositionRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("ais_positions")
          .select()
          .eq("vessel_id", vesselId)
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as AisPositionRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest AIS position", e);
      }
    },

    async findByVesselImo(
      imo: string,
      pagination?: Partial<PaginationOptions>,
    ): Promise<Page<AisPositionRow>> {
      const { limit, offset } = normalizePagination(
        pagination?.limit,
        pagination?.offset,
      );
      try {
        const client = getClient();
        const vessel = await vessels.findByImo(imo);
        if (!vessel) {
          return { rows: [], limit, offset, total: 0 };
        }
        const from = offset;
        const to = offset + limit - 1;
        const { data, error } = await client
          .from("ais_positions")
          .select()
          .eq("vessel_id", vessel.id)
          .order("ts", { ascending: false })
          .range(from, to);

        if (error) throw error;
        return {
          rows: (data as AisPositionRow[]) ?? [],
          limit,
          offset,
          total: 0,
        };
      } catch (e) {
        throw mapError("find AIS positions by vessel IMO", e);
      }
    },
  };
}
