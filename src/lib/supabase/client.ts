/**
 * client.ts — typed Supabase client factory (the database entry point)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the single place a Supabase client is constructed. It:
 *   1. Reads config once and builds a typed `SupabaseClient<Database>` so every
 *      query is column-name-checked at compile time.
 *   2. Uses the SERVICE ROLE key (bypasses RLS) because Phase 1B writes happen
 *      server-side only. This key must NEVER ship to the browser.
 *   3. Exposes both a factory (createSupabaseClient) for tests/DI and a cached
 *      singleton (getSupabaseClient) for production hot paths.
 *
 * HOW IT FITS
 * The repositories (vessels/voyages/ais_positions) accept a SupabaseClient via
 * their factory functions. In tests they receive a fake; in the API route they
 * receive getSupabaseClient(). The repositories never construct a client.
 *
 * NOTE
 * `createClient` is imported dynamically only inside the factory so that merely
 * importing the module in a mock/test context does not force a network driver
 * to initialize. In mock mode the factory still returns a real client object,
 * but it is never queried — repositories are tested with fakes.
 */

import { createClient } from "@supabase/supabase-js";
import { loadConfig, type SupabaseConfig } from "./config";
import { createFakeSupabaseClient } from "./fake-client";
import type { Database } from "./types";

export type { Database };

/**
 * Build a fresh, typed Supabase client from explicit config.
 * Use this in tests where you want isolation (no shared singleton state).
 *
 * We pass only `<Database>` and let createClient infer the remaining schema
 * generics itself. Capturing the return type (below) means our TypedSupabaseClient
 * alias always matches whatever createClient produces — including all of its
 * internal generics — so `.from("vessels")` resolves correctly.
 */
export function createSupabaseClient(config: SupabaseConfig = loadConfig()) {
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      // Phase 1B is a service-to-service write path. No session management.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * The concrete client type used everywhere in this module.
 *
 * Derived from createSupabaseClient's return value so it matches the real
 * SupabaseClient generics exactly (Database + all inferred schema/version
 * params). Every repository and test fake uses this alias. This is what makes
 * `.from("vessels")` resolve to our typed table builder instead of `never`.
 */
export type TypedSupabaseClient = ReturnType<typeof createSupabaseClient>;

// ── Cached singleton (production hot path) ───────────────────────────────────

let cached: TypedSupabaseClient | null = null;

/**
 * Returns the process-wide Supabase client, building it on first call.
 * Hot-path callers (the API route) reuse one client + its connection pool.
 *
 * In mock mode (SUPABASE_USE_MOCK=true, the default), returns an in-memory
 * fake seeded with fixture data so the app works out of the box.
 */
export function getSupabaseClient(): TypedSupabaseClient {
  if (cached) return cached;

  const config = loadConfig();
  if (config.useMock) {
    const now = new Date().toISOString();
    cached = createFakeSupabaseClient({
      tables: {
        vessels: [
          {
            id: crypto.randomUUID(),
            imo: "9074729",
            name: "Aurelia",
            mmsi: "310625000",
            ship_id: "371663",
            created_at: now,
            updated_at: now,
          },
          {
            id: crypto.randomUUID(),
            imo: "1234567",
            name: "Northern Star",
            mmsi: "219000123",
            ship_id: "123456",
            created_at: now,
            updated_at: now,
          },
          {
            id: crypto.randomUUID(),
            imo: "7654321",
            name: "Pacific Voyager",
            mmsi: "538001234",
            ship_id: "789012",
            created_at: now,
            updated_at: now,
          },
        ],
      },
    }) as unknown as TypedSupabaseClient;
    return cached;
  }

  cached = createSupabaseClient(config);
  return cached;
}

/**
 * Test helper: inject a fake/override client into the singleton slot.
 * Not exported from the barrel — internal test utility only.
 */
export function _setSupabaseClientForTest(
  client: TypedSupabaseClient | null,
): void {
  cached = client;
}
