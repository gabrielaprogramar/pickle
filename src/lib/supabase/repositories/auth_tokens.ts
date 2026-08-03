/**
 * repositories/auth_tokens.ts — mock session & reset token persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Wraps the `auth_tokens` table: session and password-reset tokens for the
 * mock auth seam. Real Supabase Auth lands in a later phase; this repository
 * keeps the persistence contract stable either way.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { AuthTokenInsert, AuthTokenRow } from "../types";

export interface FindValidTokenOptions {
  readonly now: string;
}

export type AuthTokenUpdate = Partial<AuthTokenInsert>;

export interface AuthTokenRepository {
  insert(input: AuthTokenInsert): Promise<AuthTokenRow>;
  findByToken(token: string): Promise<AuthTokenRow | null>;
  findValidByToken(
    token: string,
    opts: FindValidTokenOptions,
  ): Promise<AuthTokenRow | null>;
  listValidByKind(
    kind: "session" | "password_reset",
    email: string,
    opts: FindValidTokenOptions,
  ): Promise<AuthTokenRow[]>;
  revoke(token: string): Promise<AuthTokenRow | null>;
}

export interface CreateAuthTokenRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAuthTokenRepository(
  opts: CreateAuthTokenRepositoryOptions = {},
): AuthTokenRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: AuthTokenInsert): Promise<AuthTokenRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("auth_tokens")
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data as AuthTokenRow;
      } catch (e) {
        throw mapError("insert auth token", e);
      }
    },

    async findByToken(token: string): Promise<AuthTokenRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("auth_tokens")
          .select()
          .eq("token", token)
          .maybeSingle();
        if (error) throw error;
        return (data as AuthTokenRow | null) ?? null;
      } catch (e) {
        throw mapError("find auth token by token", e);
      }
    },

    async findValidByToken(
      token: string,
      opts: FindValidTokenOptions,
    ): Promise<AuthTokenRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("auth_tokens")
          .select()
          .eq("token", token)
          .is("revoked_at", null)
          .gt("expires_at", opts.now)
          .maybeSingle();
        if (error) throw error;
        return (data as AuthTokenRow | null) ?? null;
      } catch (e) {
        throw mapError("find valid auth token", e);
      }
    },

    async listValidByKind(
      kind: "session" | "password_reset",
      email: string,
      opts: FindValidTokenOptions,
    ): Promise<AuthTokenRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("auth_tokens")
          .select()
          .eq("kind", kind)
          .eq("email", email)
          .is("revoked_at", null)
          .gt("expires_at", opts.now)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data as AuthTokenRow[]) ?? [];
      } catch (e) {
        throw mapError("list valid auth tokens", e);
      }
    },

    async revoke(token: string): Promise<AuthTokenRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("auth_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token", token)
          .select()
          .maybeSingle();
        if (error) throw error;
        return (data as AuthTokenRow | null) ?? null;
      } catch (e) {
        throw mapError("revoke auth token", e);
      }
    },
  };
}
