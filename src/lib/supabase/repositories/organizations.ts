/**
 * repositories/organizations.ts — tenant persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `organizations` table: one row per customer tenant in the SaaS
 * shell. CRUD only — no business rules. The settings service in
 * `src/lib/settings/` owns profile logic.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { OrganizationInsert, OrganizationRow } from "../types";

export type OrganizationUpdate = Partial<OrganizationInsert>;

export interface OrganizationRepository {
  insert(input: OrganizationInsert): Promise<OrganizationRow>;
  findById(id: string): Promise<OrganizationRow | null>;
  listAll(): Promise<OrganizationRow[]>;
  update(id: string, patch: OrganizationUpdate): Promise<OrganizationRow>;
}

export interface CreateOrganizationRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOrganizationRepository(
  opts: CreateOrganizationRepositoryOptions = {},
): OrganizationRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OrganizationInsert): Promise<OrganizationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organizations")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationRow;
      } catch (e) {
        throw mapError("insert organization", e);
      }
    },

    async findById(id: string): Promise<OrganizationRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organizations")
          .select()
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization by id", e);
      }
    },

    async listAll(): Promise<OrganizationRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organizations")
          .select()
          .order("name", { ascending: true });
        if (error) throw error;
        return (data as OrganizationRow[]) ?? [];
      } catch (e) {
        throw mapError("list organizations", e);
      }
    },

    async update(id: string, patch: OrganizationUpdate): Promise<OrganizationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organizations")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationRow;
      } catch (e) {
        throw mapError("update organization", e);
      }
    },
  };
}
