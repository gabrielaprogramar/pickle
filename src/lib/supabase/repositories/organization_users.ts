/**
 * repositories/organization_users.ts — organization membership persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `organization_users` table: members of a tenant with their role,
 * status, and credentials hash. Emails are unique per organization.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  OrganizationUserInsert,
  OrganizationUserRow,
} from "../types";

export type OrganizationUserUpdate = Partial<OrganizationUserInsert>;

export interface OrganizationUserRepository {
  insert(input: OrganizationUserInsert): Promise<OrganizationUserRow>;
  findById(id: string): Promise<OrganizationUserRow | null>;
  findByEmail(email: string): Promise<OrganizationUserRow | null>;
  findByOrgAndEmail(
    organizationId: string,
    email: string,
  ): Promise<OrganizationUserRow | null>;
  listByOrganizationId(organizationId: string): Promise<OrganizationUserRow[]>;
  update(
    id: string,
    patch: OrganizationUserUpdate,
  ): Promise<OrganizationUserRow>;
}

export interface CreateOrganizationUserRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createOrganizationUserRepository(
  opts: CreateOrganizationUserRepositoryOptions = {},
): OrganizationUserRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: OrganizationUserInsert): Promise<OrganizationUserRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationUserRow;
      } catch (e) {
        throw mapError("insert organization user", e);
      }
    },

    async findById(id: string): Promise<OrganizationUserRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .select()
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationUserRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization user by id", e);
      }
    },

    async findByEmail(email: string): Promise<OrganizationUserRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .select()
          .eq("email", email)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationUserRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization user by email", e);
      }
    },

    async findByOrgAndEmail(
      organizationId: string,
      email: string,
    ): Promise<OrganizationUserRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .select()
          .eq("organization_id", organizationId)
          .eq("email", email)
          .maybeSingle();
        if (error) throw error;
        return (data as OrganizationUserRow | null) ?? null;
      } catch (e) {
        throw mapError("find organization user by org and email", e);
      }
    },

    async listByOrganizationId(
      organizationId: string,
    ): Promise<OrganizationUserRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .select()
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data as OrganizationUserRow[]) ?? [];
      } catch (e) {
        throw mapError("list organization users", e);
      }
    },

    async update(
      id: string,
      patch: OrganizationUserUpdate,
    ): Promise<OrganizationUserRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("organization_users")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as OrganizationUserRow;
      } catch (e) {
        throw mapError("update organization user", e);
      }
    },
  };
}
