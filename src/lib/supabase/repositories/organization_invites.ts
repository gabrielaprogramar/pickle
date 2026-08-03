/**
 * repositories/organization_invites.ts — invitation persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `organization_invites` table: pending/cancelled invitations with
 * token, role, expiry, and resend tracking. The invite workflow lives in
 * `src/lib/settings/`; this file only persists rows.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  OrganizationInviteInsert,
  OrganizationInviteRow,
} from "../types";

export type OrganizationInviteUpdate = Partial<OrganizationInviteInsert>;

export interface OrganizationInviteRepository {
  insert(input: OrganizationInviteInsert): Promise<OrganizationInviteRow>;
  findById(id: string): Promise<OrganizationInviteRow | null>;
  findByToken(token: string): Promise<OrganizationInviteRow | null>;
  listByOrganizationId(organizationId: string): Promise<OrganizationInviteRow[]>;
  listPendingByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationInviteRow[]>;
  update(
    id: string,
    patch: OrganizationInviteUpdate,
  ): Promise<OrganizationInviteRow>;
}

export interface CreateOrganizationInviteRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOrganizationInviteRepository(
  opts: CreateOrganizationInviteRepositoryOptions = {},
): OrganizationInviteRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OrganizationInviteInsert): Promise<OrganizationInviteRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationInviteRow;
      } catch (e) {
        throw mapError("insert organization invite", e);
      }
    },

    async findById(id: string): Promise<OrganizationInviteRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .select()
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationInviteRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization invite by id", e);
      }
    },

    async findByToken(token: string): Promise<OrganizationInviteRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .select()
          .eq("token", token)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationInviteRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization invite by token", e);
      }
    },

    async listByOrganizationId(
      organizationId: string,
    ): Promise<OrganizationInviteRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .select()
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data as OrganizationInviteRow[]) ?? [];
      } catch (e) {
        throw mapError("list organization invites", e);
      }
    },

    async listPendingByOrganizationId(
      organizationId: string,
    ): Promise<OrganizationInviteRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .select()
          .eq("organization_id", organizationId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data as OrganizationInviteRow[]) ?? [];
      } catch (e) {
        throw mapError("list pending organization invites", e);
      }
    },

    async update(
      id: string,
      patch: OrganizationInviteUpdate,
    ): Promise<OrganizationInviteRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_invites")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationInviteRow;
      } catch (e) {
        throw mapError("update organization invite", e);
      }
    },
  };
}
