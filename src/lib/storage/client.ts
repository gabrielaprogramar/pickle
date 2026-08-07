/**
 * client.ts — storage client factory (mock/real seam)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Single entry point for obtaining a StorageClient. Reads the STORAGE_USE_MOCK
 * flag and returns either the in-memory mock or the real Supabase Storage
 * client. Mirrors the pattern in supabase/client.ts.
 *
 * HOW IT FITS
 * The document service calls getStorageClient() and programs against the
 * StorageClient interface. The factory is the only place that knows whether
 * we're in mock or live mode.
 */

import { loadStorageConfig } from "./config";
import { createMockStorageClient } from "./mock-storage";
import { createSupabaseStorageClient } from "./supabase-storage";
import type { StorageClient } from "./types";

// Same rationale as supabase/client.ts: store the singleton on `globalThis` so
// every route-handler module copy shares one storage instance.

declare global {
  // eslint-disable-next-line no-var
  var __poseidonLedgerStorageClient: StorageClient | null | undefined;
}

/**
 * Returns the process-wide storage client, building it on first call.
 * In mock mode, returns an in-memory client. In live mode, creates a
 * Supabase Storage client from the existing Supabase client singleton.
 */
export function getStorageClient(): StorageClient {
  const existing = globalThis.__poseidonLedgerStorageClient ?? null;
  if (existing) return existing;

  const config = loadStorageConfig();

  const client = config.useMock
    ? createMockStorageClient()
    : createLiveStorageClient();

  globalThis.__poseidonLedgerStorageClient = client;
  return client;
}

function createLiveStorageClient(): StorageClient {
  // Lazy-import the Supabase client so the mock path never touches it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSupabaseClient } = require("@/lib/supabase/client") as {
    getSupabaseClient: () => ReturnType<typeof import("@supabase/supabase-js").createClient>;
  };
  return createSupabaseStorageClient(getSupabaseClient());
}

/**
 * Create a fresh storage client (for tests / DI).
 */
export function createStorageClient(): StorageClient {
  const config = loadStorageConfig();
  if (config.useMock) return createMockStorageClient();
  return createLiveStorageClient();
}

/**
 * Test helper: reset the cached singleton.
 */
export function _resetStorageClientForTest(): void {
  globalThis.__poseidonLedgerStorageClient = null;
}
