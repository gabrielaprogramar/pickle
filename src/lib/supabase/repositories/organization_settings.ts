/**
 * repositories/organization_settings.ts — per-org preferences persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `organization_settings` table: one row per organization holding
 * timezone, reporting year, language, appearance, and notification preferences.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  OrganizationSettingsInsert,
  OrganizationSettingsRow,
} from "../types";

export type OrganizationSettingsUpdate = Partial<OrganizationSettingsInsert>;

export interface OrganizationSettingsRepository {
  insert(input: OrganizationSettingsInsert): Promise<OrganizationSettingsRow>;
  findByOrganizationId(organizationId: string): Promise<OrganizationSettingsRow | null>;
  upsertByOrganizationId(
    organizationId: string,
    input: OrganizationSettingsInsert,
  ): Promise<OrganizationSettingsRow>;
  update(
    id: string,
    patch: OrganizationSettingsUpdate,
  ): Promise<OrganizationSettingsRow>;
}

export interface CreateOrganizationSettingsRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOrganizationSettingsRepository(
  opts: CreateOrganizationSettingsRepositoryOptions = {},
): OrganizationSettingsRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OrganizationSettingsInsert): Promise<OrganizationSettingsRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_settings")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationSettingsRow;
      } catch (e) {
        throw mapError("insert organization settings", e);
      }
    },

    async findByOrganizationId(
      organizationId: string,
    ): Promise<OrganizationSettingsRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_settings")
          .select()
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationSettingsRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization settings by org", e);
      }
    },

    async upsertByOrganizationId(
      organizationId: string,
      input: OrganizationSettingsInsert,
    ): Promise<OrganizationSettingsRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_settings")
          .upsert({ ...input, organization_id: organizationId }, { onConflict: "organization_id" })
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationSettingsRow;
      } catch (e) {
        throw mapError("upsert organization settings", e);
      }
    },

    async update(
      id: string,
      patch: OrganizationSettingsUpdate,
    ): Promise<OrganizationSettingsRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_settings")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationSettingsRow;
      } catch (e) {
        throw mapError("update organization settings", e);
      }
    },
  };
}
