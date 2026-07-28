/**
 * config.ts — environment-driven configuration for the storage layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Follows the same mock/real seam pattern as supabase/config.ts and
 * marinetraffic/config.ts. The storage module defaults to mock mode so the
 * app boots and tests run without Supabase Storage credentials.
 *
 * HOW IT FITS
 * client.ts calls loadStorageConfig() and selects the appropriate storage
 * implementation (mock or real) based on the useMock flag.
 */

import { StorageConfigError } from "./errors";

export interface StorageConfig {
  /** When true, use the in-memory mock storage. Default: true. */
  readonly useMock: boolean;
  /** The Supabase Storage bucket name for documents. Default: "documents". */
  readonly bucket: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

/**
 * Reads and validates storage configuration from the process environment.
 * Only throws in live mode when the bucket name is not configured.
 */
export function loadStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig {
  const useMock = parseBoolean(env.STORAGE_USE_MOCK, true);
  const bucket = env.STORAGE_BUCKET?.trim() || "documents";

  if (!useMock && !bucket) {
    throw new StorageConfigError(
      "STORAGE_USE_MOCK is false but STORAGE_BUCKET is not set.",
    );
  }

  return { useMock, bucket };
}
