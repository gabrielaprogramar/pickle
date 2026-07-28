/**
 * errors.ts — typed error hierarchy for the storage layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Mirrors the Supabase and MarineTraffic error patterns: callers need to
 * distinguish between configuration problems, upstream storage failures, and
 * programming errors without parsing error messages.
 *
 * HOW IT FITS
 * supabase-storage.ts and mock-storage.ts throw these on failure. The document
 * service catches StorageError subclasses and maps them to user-facing HTTP
 * status codes.
 */

/** Base class for all storage errors. */
export abstract class StorageError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** A required environment variable for storage is missing or malformed. */
export class StorageConfigError extends StorageError {}

/** The upload or download failed due to an upstream storage service error. */
export class StorageUpstreamError extends StorageError {}

/** The requested object was not found in storage. */
export class StorageNotFoundError extends StorageError {}
