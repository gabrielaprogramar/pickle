/**
 * repositories/voyages.ts — voyage persistence + vessel resolution
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the canonical write path for an ingested voyage. Inserting a voyage
 * is a TWO-step operation:
 *
 *   1. Resolve the vessel: upsert the vessel row to get its internal UUID.
 *      (voyages.vessel_id is a FK — the vessel must exist first.)
 *   2. Map the domain Voyage → VoyageInsert and write the row.
 *
 * Centralizing both steps here means the caller (the API route / orchestration
 * layer in a later phase) hands over a domain Voyage and gets back a VoyageRow,
 * with the FK resolution handled internally. No caller ever needs to know about
 * vessel_id.
 *
 * HOW IT FITS
 * Depends on the vessels repository for the FK resolution. The mapping from
 * domain Voyage → DB payloads is delegated to mapper.ts (single responsibility).
 * All failures surface as RepositoryError subclasses via mapError().
 *
 * TRANSACTION NOTE
 * Phase 1B does NOT wrap the two writes in a Postgres transaction. Reasoning:
 * the vessel upsert is idempotent (keyed by unique IMO), so a crash between the
 * two steps leaves at most a "dangling" vessel row with no voyage — which is
 * harmless and self-heals on the next ingest. If stronger atomicity is needed
 * later (e.g. batch ingest), a Supabase RPC/transaction wrapper belongs in a
 * future phase, not here.
 */

import type { Voyage } from "@/lib/marinetraffic/types";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import { toVoyageInsert, toVesselInsert } from "../mapper";
import {
  createVesselRepository,
  type VesselRepository,
} from "./vessels";
import type { VoyageRow, Page, PaginationOptions } from "../types";
import { normalizePagination } from "../types";

export interface VoyageRepository {
  /**
   * Persist an ingested domain Voyage. Resolves (upserts) the vessel first,
   * then inserts the voyage row. Returns the stored voyage row.
   */
  insertFromDomain(voyage: Voyage): Promise<VoyageRow>;
  /** Look up the most recent voyage for a vessel (by IMO). Null if none. */
  findLatestByImo(imo: string): Promise<VoyageRow | null>;
  /** List a vessel's voyages newest-first as a paginated Page, resolved by IMO. */
  findByImo(
    imo: string,
    pagination?: Partial<PaginationOptions>,
  ): Promise<Page<VoyageRow>>;
  /** List all voyages for a vessel in a given reporting year. */
  findByVesselAndYear(
    vesselId: string,
    year: number,
  ): Promise<ReadonlyArray<VoyageRow>>;
}

export interface CreateVoyageRepositoryOptions {
  readonly client?: TypedSupabaseClient;
  /** Inject the vessel repository (tests). Defaults to one built from `client`. */
  readonly vesselRepository?: VesselRepository;
}

export function createVoyageRepository(
  opts: CreateVoyageRepositoryOptions = {},
): VoyageRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  // The vessel repo shares the same client so both writes hit the same project.
  const vessels = opts.vesselRepository ?? createVesselRepository({ client: opts.client });

  return {
    async insertFromDomain(voyage: Voyage): Promise<VoyageRow> {
      // Step 1: resolve the vessel UUID. Idempotent — safe to call every ingest.
      const vessel = await vessels.upsertByImo(toVesselInsert(voyage));

      // Step 2: map + insert the voyage row with the resolved FK.
      try {
        const client = getClient();
        const payload = toVoyageInsert(voyage, vessel.id);
        const { data, error } = await client
          .from("voyages")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as VoyageRow;
      } catch (e) {
        throw mapError("insert voyage", e);
      }
    },

    async findLatestByImo(imo: string): Promise<VoyageRow | null> {
      try {
        const client = getClient();
        // Join through vessels to filter by IMO, take the newest by departure.
        const { data, error } = await client
          .from("voyages")
          .select("*, vessels!inner(imo)")
          .eq("vessels.imo", imo)
          .order("departure_time", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as VoyageRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest voyage by IMO", e);
      }
    },

    async findByImo(
      imo: string,
      pagination?: Partial<PaginationOptions>,
    ): Promise<Page<VoyageRow>> {
      const { limit, offset } = normalizePagination(
        pagination?.limit,
        pagination?.offset,
      );
      try {
        const client = getClient();
        const countRes = await client
          .from("voyages")
          .select("*", { count: "exact", head: true })
          .eq("vessels.imo", imo);
        const total =
          typeof countRes.count === "number" ? countRes.count : 0;

        const from = offset;
        const to = offset + limit - 1;
        const { data, error } = await client
          .from("voyages")
          .select("*, vessels!inner(imo)")
          .eq("vessels.imo", imo)
          .order("departure_time", { ascending: false, nullsFirst: false })
          .range(from, to);

        if (error) throw error;
        return {
          rows: (data as VoyageRow[]) ?? [],
          limit,
          offset,
          total,
        };
      } catch (e) {
        throw mapError("find voyages by IMO", e);
      }
    },

    async findByVesselAndYear(
      vesselId: string,
      year: number,
    ): Promise<ReadonlyArray<VoyageRow>> {
      try {
        const client = getClient();
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year + 1}-01-01`;
        const { data, error } = await client
          .from("voyages")
          .select("*")
          .eq("vessel_id", vesselId)
          .gte("departure_time", yearStart)
          .lt("departure_time", yearEnd)
          .order("departure_time", { ascending: false });

        if (error) throw error;
        return (data ?? []) as VoyageRow[];
      } catch (e) {
        throw mapError("find voyages by vessel and year", e);
      }
    },
  };
}
