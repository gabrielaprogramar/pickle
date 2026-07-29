/**
 * repositories/vessels.ts — vessel persistence (upsert + lookup by IMO)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The voyage workflow needs a vessel row to exist BEFORE a voyage can be
 * inserted (the voyages.vessel_id FK requires it). This repository handles the
 * two operations the workflow needs:
 *
 *   1. upsertByImo() — insert-or-update a vessel keyed by IMO. Because IMO is
 *      UNIQUE, an arriving vessel we've seen before just refreshes its name /
 *      mmsi rather than creating a duplicate. This is the canonical entry point
 *      before inserting a voyage.
 *
 *   2. findByImo() — look up the internal UUID for a known IMO. Used when we
 *      need the id but don't want to write.
 *
 * HOW IT FITS
 * The voyage repository depends on this: it calls upsertByImo() to resolve a
 * domain Voyage into a vessel_id, then inserts the voyage row. Keeping vessel
 * logic isolated means vessel identity and voyage history are independently
 * testable and swappable.
 *
 * All methods throw RepositoryError subclasses via mapError() — never raw
 * PostgREST errors. Callers branch with `instanceof`.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { VesselInsert, VesselRow, Page, PaginationOptions } from "../types";
import { normalizePagination } from "../types";
import { mapError } from "../errors";

export interface VesselRepository {
  /** Insert or update a vessel keyed by its (unique) IMO. Returns the row. */
  upsertByImo(input: VesselInsert): Promise<VesselRow>;
  /** Look up a vessel by IMO. Returns null when no vessel exists for it. */
  findByImo(imo: string): Promise<VesselRow | null>;
  /** List vessels newest-first as a paginated Page. */
  findAll(pagination?: Partial<PaginationOptions>): Promise<Page<VesselRow>>;
}

export interface CreateVesselRepositoryOptions {
  /** Inject a client (tests). Defaults to the process singleton. */
  readonly client?: TypedSupabaseClient;
}

export function createVesselRepository(
  opts: CreateVesselRepositoryOptions = {},
): VesselRepository {
  // Client is resolved lazily so importing this module in a test that injects
  // a fake never triggers the real singleton.
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async upsertByImo(input: VesselInsert): Promise<VesselRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("vessels")
          .upsert(input, { onConflict: "imo" })
          .select()
          .single();

        if (error) throw error;
        return data as VesselRow;
      } catch (e) {
        throw mapError("upsert vessel", e);
      }
    },

    async findByImo(imo: string): Promise<VesselRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("vessels")
          .select()
          .eq("imo", imo)
          .maybeSingle();

        if (error) throw error;
        return (data as VesselRow | null) ?? null;
      } catch (e) {
        throw mapError("find vessel by IMO", e);
      }
    },

    async findAll(
      pagination?: Partial<PaginationOptions>,
    ): Promise<Page<VesselRow>> {
      const { limit, offset } = normalizePagination(
        pagination?.limit,
        pagination?.offset,
      );
      try {
        const client = getClient();
        const countRes = await client
          .from("vessels")
          .select("*", { count: "exact", head: true });
        const total =
          typeof countRes.count === "number" ? countRes.count : 0;

        const from = offset;
        const to = offset + limit - 1;
        const { data, error } = await client
          .from("vessels")
          .select()
          .order("updated_at", { ascending: false, nullsFirst: false })
          .range(from, to);

        if (error) throw error;
        return {
          rows: (data as VesselRow[]) ?? [],
          limit,
          offset,
          total,
        };
      } catch (e) {
        throw mapError("list vessels", e);
      }
    },
  };
}
