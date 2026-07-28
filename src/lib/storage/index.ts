/**
 * index.ts — public barrel export for the Storage module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One clean import path for the storage layer:
 *
 *   import { getStorageClient, StorageClient } from "@/lib/storage";
 */

// Client factory.
export { getStorageClient, createStorageClient } from "./client";
export type { StorageClient } from "./types";

// Types.
export type {
  StorageUploadResult,
  StorageSignedUrlResult,
  StorageUploadOptions,
} from "./types";

// Errors — callers branch with `instanceof`.
export {
  StorageError,
  StorageConfigError,
  StorageUpstreamError,
  StorageNotFoundError,
} from "./errors";

// Config.
export { loadStorageConfig } from "./config";
export type { StorageConfig } from "./config";

// Mock storage (exported for tests that need to seed data).
export { createMockStorageClient } from "./mock-storage";

// Supabase implementation.
export { createSupabaseStorageClient } from "./supabase-storage";
