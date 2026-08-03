/**
 * repositories/integration_credentials.ts — integration config persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `integration_credentials` table: per-org, per-provider status +
 * "encrypted" config payloads. Phase 4.5 stores the values but never uses them
 * to reach providers (mock-only seam).
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  IntegrationCredentialInsert,
  IntegrationCredentialRow,
} from "../types";

export type IntegrationCredentialUpdate = Partial<IntegrationCredentialInsert>;

export interface IntegrationCredentialRepository {
  insert(input: IntegrationCredentialInsert): Promise<IntegrationCredentialRow>;
  findByOrganizationAndProvider(
    organizationId: string,
    provider: string,
  ): Promise<IntegrationCredentialRow | null>;
  listByOrganizationId(
    organizationId: string,
  ): Promise<IntegrationCredentialRow[]>;
  upsertByOrganizationAndProvider(
    organizationId: string,
    provider: string,
    input: IntegrationCredentialInsert,
  ): Promise<IntegrationCredentialRow>;
  update(
    id: string,
    patch: IntegrationCredentialUpdate,
  ): Promise<IntegrationCredentialRow>;
}

export interface CreateIntegrationCredentialRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createIntegrationCredentialRepository(
  opts: CreateIntegrationCredentialRepositoryOptions = {},
): IntegrationCredentialRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(
      input: IntegrationCredentialInsert,
    ): Promise<IntegrationCredentialRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("integration_credentials")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as IntegrationCredentialRow;
      } catch (e) {
        throw mapError("insert integration credential", e);
      }
    },

    async findByOrganizationAndProvider(
      organizationId: string,
      provider: string,
    ): Promise<IntegrationCredentialRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("integration_credentials")
          .select()
          .eq("organization_id", organizationId)
          .eq("provider", provider)
          .maybeSingle();
        if (error) throw error;
        return (data as IntegrationCredentialRow | null) ?? null;
      } catch (e) {
        throw mapError("find integration credential by org and provider", e);
      }
    },

    async listByOrganizationId(
      organizationId: string,
    ): Promise<IntegrationCredentialRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("integration_credentials")
          .select()
          .eq("organization_id", organizationId)
          .order("provider", { ascending: true });
        if (error) throw error;
        return (data as IntegrationCredentialRow[]) ?? [];
      } catch (e) {
        throw mapError("list integration credentials by org", e);
      }
    },

    async upsertByOrganizationAndProvider(
      organizationId: string,
      provider: string,
      input: IntegrationCredentialInsert,
    ): Promise<IntegrationCredentialRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("integration_credentials")
          .upsert(
            { ...input, organization_id: organizationId, provider },
            { onConflict: "organization_id,provider" },
          )
          .select()
          .single();
        if (error) throw error;
        return data as IntegrationCredentialRow;
      } catch (e) {
        throw mapError("upsert integration credential", e);
      }
    },

    async update(
      id: string,
      patch: IntegrationCredentialUpdate,
    ): Promise<IntegrationCredentialRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("integration_credentials")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as IntegrationCredentialRow;
      } catch (e) {
        throw mapError("update integration credential", e);
      }
    },
  };
}
