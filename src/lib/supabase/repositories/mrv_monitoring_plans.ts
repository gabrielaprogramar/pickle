/**
 * repositories/mrv_monitoring_plans.ts — versioned EU MRV monitoring plan
 * persistence (first-class domain model)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 makes the Monitoring Plan a first-class, versioned domain entity
 * (template: Annex I, Implementing Reg. (EU) 2023/2449). Each plan version is a
 * row keyed by (vessel, version); deterministic active-plan resolution happens
 * in `src/lib/mrv/monitoring-plan.ts`. This repository persists and reads
 * versions; it never decides applicability.
 *
 * All methods throw RepositoryError subclasses via mapError().
 */

import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  MrvMonitoringPlanRow,
  MrvMonitoringPlanInsert,
} from "../types";

export interface MrvMonitoringPlanRepository {
  /** A specific plan version for a vessel, or null. */
  findByVersion(vesselId: string, version: number): Promise<MrvMonitoringPlanRow | null>;
  /** All plan versions for a vessel, newest first. */
  listByVessel(vesselId: string): Promise<MrvMonitoringPlanRow[]>;
  /** Insert a new plan version. */
  insert(plan: MrvMonitoringPlanInsert): Promise<MrvMonitoringPlanRow>;
  /** Update a plan version (e.g. status/procedure changes). */
  update(
    id: string,
    changes: Partial<MrvMonitoringPlanInsert>,
  ): Promise<MrvMonitoringPlanRow>;
}

export interface CreateMrvMonitoringPlanRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createMrvMonitoringPlanRepository(
  opts: CreateMrvMonitoringPlanRepositoryOptions = {},
): MrvMonitoringPlanRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findByVersion(vesselId: string, version: number): Promise<MrvMonitoringPlanRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_monitoring_plans")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("version", version)
          .maybeSingle();
        if (error) throw error;
        return (data as MrvMonitoringPlanRow | null) ?? null;
      } catch (e) {
        throw mapError("find monitoring plan by version", e);
      }
    },

    async listByVessel(vesselId: string): Promise<MrvMonitoringPlanRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_monitoring_plans")
          .select("*")
          .eq("vessel_id", vesselId)
          .order("version", { ascending: false });
        if (error) throw error;
        return (data as MrvMonitoringPlanRow[]) ?? [];
      } catch (e) {
        throw mapError("list monitoring plans by vessel", e);
      }
    },

    async insert(plan: MrvMonitoringPlanInsert): Promise<MrvMonitoringPlanRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_monitoring_plans")
          .insert(plan as any)
          .select()
          .single();
        if (error) throw error;
        return data as MrvMonitoringPlanRow;
      } catch (e) {
        throw mapError("insert monitoring plan", e);
      }
    },

    async update(
      id: string,
      changes: Partial<MrvMonitoringPlanInsert>,
    ): Promise<MrvMonitoringPlanRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("mrv_monitoring_plans")
          .update(changes as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as MrvMonitoringPlanRow;
      } catch (e) {
        throw mapError("update monitoring plan", e);
      }
    },
  };
}
