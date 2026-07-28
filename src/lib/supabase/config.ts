/**
 * config.ts — environment-driven configuration for the Supabase layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Centralizes the two Supabase secrets (project URL + service role key) plus
 * the runtime mode flag, in one validated place. Same pattern as the
 * MarineTraffic module's config: secrets only from env, never hardcoded.
 *
 * THE CREDENTIALS-LATER SEAM
 * Phase 1B follows the exact pattern Phase 1A established: the code is fully
 * production-ready and type-checks, but does NOT require live credentials to
 * compile or to run the repository unit tests (which inject a fake client).
 *
 * `loadConfig()` only throws when:
 *   • useMock === false (you want to connect for real) AND a credential is
 *     missing. That's the one hard gate — running the app without secrets but
 *     demanding a real connection is a misconfiguration.
 *
 * In mock mode (default), missing credentials fall back to placeholders so the
 * module imports cleanly and tests run with zero setup.
 *
 * HOW IT FITS
 * client.ts calls loadConfig() once and builds the Supabase client. The
 * repositories never touch config directly — they receive the typed client.
 */

import { SupabaseConfigError } from "./errors";

export interface SupabaseConfig {
  /**
   * When true, the Supabase client is built with placeholder credentials (it is
   * never used to make real queries in this mode — repositories inject a fake
   * client in tests, or a real one when wired up). Defaults to true so the app
   * boots without secrets.
   */
  readonly useMock: boolean;
  /** Supabase project URL, e.g. https://xxxx.supabase.co. */
  readonly url: string;
  /** Service role key — server-only, bypasses RLS. NEVER expose to the client. */
  readonly serviceRoleKey: string;
  /** Optional schema (defaults to "public"). */
  readonly schema: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

/**
 * Reads + validates Supabase configuration from the process environment.
 * Throws SupabaseConfigError only for live mode without credentials.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig {
  const useMock = parseBoolean(env.SUPABASE_USE_MOCK, true);
  const url = env.SUPABASE_URL?.trim() || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  // Hard gate: live mode needs both credentials.
  if (!useMock && (!url || !serviceRoleKey)) {
    throw new SupabaseConfigError(
      "SUPABASE_USE_MOCK is false but SUPABASE_URL and/or " +
        "SUPABASE_SERVICE_ROLE_KEY are not set. Set both, or keep mock mode on.",
    );
  }

  // Light validation in live mode: Supabase URLs look like https://*.supabase.co.
  if (!useMock && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(url)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[supabase] SUPABASE_URL does not look like a Supabase project URL.",
    );
  }

  return {
    useMock,
    url: url || "https://placeholder.supabase.co",
    serviceRoleKey: serviceRoleKey || "placeholder-service-role-key",
    schema: env.SUPABASE_SCHEMA?.trim() || "public",
  };
}
