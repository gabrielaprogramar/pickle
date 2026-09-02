/**
 * repositories/regulation_applicability.ts — per-vessel applicability
 * determinations, effective-date aware, with first-class UNKNOWN/REQUIRES_REVIEW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Each vessel × regulation × reporting year has ONE stored, auditable
 * applicability determination (`regulation_applicability` table). The domain
 * determination logic (`@/lib/regulatory/applicability`) computes the outcome;
 * this repository persists it and provides lookups so the engines can consume a
 * single source of truth instead of re-deriving scope.
 *
 * All methods throw RepositoryError subclasses via mapError().
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  RegulationApplicabilityInsert,
  RegulationApplicabilityRow,
} from "../types";
import { mapError } from "../errors";

export interface RegulationApplicabilityRepository {
  /** The stored determination for a vessel/regulation/year, or null. */
  find(
    vesselId: string,
    regulation: string,
    reportingYear: number,
  ): Promise<RegulationApplicabilityRow | null>;
  /** Upsert a determination (one per vessel/regulation/year by unique key). */
  upsert(
    input: RegulationApplicabilityInsert,
  ): Promise<RegulationApplicabilityRow>;
  /** All determinations for a vessel across a year. */
  listByVessel(
    vesselId: string,
    reportingYear: number,
  ): Promise<RegulationApplicabilityRow[]>;
}

export interface CreateRegulationApplicabilityRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createRegulationApplicabilityRepository(
  opts: CreateRegulationApplicabilityRepositoryOptions = {},
): RegulationApplicabilityRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function find(
    vesselId: string,
    regulation: string,
    reportingYear: number,
  ): Promise<RegulationApplicabilityRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulation_applicability")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("regulation", regulation)
        .eq("reporting_year", reportingYear)
        .maybeSingle();
      if (error) throw error;
      return (data as RegulationApplicabilityRow | null) ?? null;
    } catch (e) {
      throw mapError("find regulation applicability", e);
    }
  }

  async function upsert(
    input: RegulationApplicabilityInsert,
  ): Promise<RegulationApplicabilityRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulation_applicability")
        .upsert(input, {
          onConflict: "vessel_id,regulation,reporting_year",
        })
        .select()
        .single();
      if (error) throw error;
      return data as RegulationApplicabilityRow;
    } catch (e) {
      throw mapError("upsert regulation applicability", e);
    }
  }

  async function listByVessel(
    vesselId: string,
    reportingYear: number,
  ): Promise<RegulationApplicabilityRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulation_applicability")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("reporting_year", reportingYear)
        .order("regulation");
      if (error) throw error;
      return (data as RegulationApplicabilityRow[]) ?? [];
    } catch (e) {
      throw mapError("list regulation applicability", e);
    }
  }

  return { find, upsert, listByVessel };
}
