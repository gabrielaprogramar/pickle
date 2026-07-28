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

let cached: StorageClient | null = null;

/**
 * Returns the process-wide storage client, building it on first call.
 * In mock mode, returns an in-memory client. In live mode, creates a
 * Supabase Storage client from the existing Supabase client singleton.
 */
export function getStorageClient(): StorageClient {
  if (cached) return cached;

  const config = loadStorageConfig();

  if (config.useMock) {
    cached = createMockStorageClient();
  } else {
    // Lazy-import the Supabase client so the mock path never touches it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSupabaseClient } = require("@/lib/supabase/client") as {
      getSupabaseClient: () => ReturnType<typeof import("@supabase/supabase-js").createClient>;
    };
    cached = createSupabaseStorageClient(getSupabaseClient());
  }

  return cached;
}

/**
 * Create a fresh storage client (for tests / DI).
 */
export function createStorageClient(): StorageClient {
  const config = loadStorageConfig();
  if (config.useMock) return createMockStorageClient();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSupabaseClient } = require("@/lib/supabase/client") as {
    getSupabaseClient: () => ReturnType<typeof import("@supabase/supabase-js").createClient>;
  };
  return createSupabaseStorageClient(getSupabaseClient());
}

/**
 * Test helper: reset the cached singleton.
 */
export function _resetStorageClientForTest(): void {
  cached = null;
}
