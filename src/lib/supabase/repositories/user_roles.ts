/**
 * repositories/user_roles.ts — role catalog persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `user_roles` table: the deterministic role catalog seeded by
 * migration 0017 and mirrored in `src/lib/roles/`. Read-mostly; callers never
 * insert roles in normal operation.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { UserRoleInsert, UserRoleRow } from "../types";

export interface UserRoleRepository {
  insert(input: UserRoleInsert): Promise<UserRoleRow>;
  findByCode(code: string): Promise<UserRoleRow | null>;
  listAll(): Promise<UserRoleRow[]>;
}

export interface CreateUserRoleRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createUserRoleRepository(
  opts: CreateUserRoleRepositoryOptions = {},
): UserRoleRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: UserRoleInsert): Promise<UserRoleRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("user_roles")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as UserRoleRow;
      } catch (e) {
        throw mapError("insert user role", e);
      }
    },

    async findByCode(code: string): Promise<UserRoleRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("user_roles")
          .select()
          .eq("code", code)
          .maybeSingle();
        if (error) throw error;
        return (data as UserRoleRow | null) ?? null;
      } catch (e) {
        throw mapError("find user role by code", e);
      }
    },

    async listAll(): Promise<UserRoleRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("user_roles")
          .select()
          .order("rank", { ascending: true });
        if (error) throw error;
        return (data as UserRoleRow[]) ?? [];
      } catch (e) {
        throw mapError("list user roles", e);
      }
    },
  };
}
