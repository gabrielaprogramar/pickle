/**
 * types.ts — storage client interface and upload result types
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Defines the contract every storage implementation must satisfy. Both the real
 * Supabase Storage client and the in-memory mock conform to this interface.
 * Callers (the document service) program against StorageClient, never the
 * concrete implementation.
 *
 * HOW IT FITS
 * The document upload pipeline calls storageClient.upload() to persist the raw
 * file bytes, then stores the returned storagePath in the documents table row.
 * Download and signed-URL generation are consumed by the API download route.
 */

import type { Readable } from "node:stream";

/** Result returned after a successful upload. */
export interface StorageUploadResult {
  /** The canonical storage path (bucket/key) where the file was persisted. */
  readonly storagePath: string;
  /** MIME type of the stored object. */
  readonly contentType: string;
  /** Size in bytes, when available. */
  readonly size: number | null;
}

/** Result returned when generating a signed download URL. */
export interface StorageSignedUrlResult {
  /** Pre-signed URL valid for a limited time window. */
  readonly url: string;
  /** ISO-8601 timestamp when the URL expires. */
  readonly expiresAt: string;
}

/** Options controlling an upload operation. */
export interface StorageUploadOptions {
  /** MIME type of the file being uploaded. Defaults to "application/octet-stream". */
  readonly contentType?: string;
  /** Optional metadata dict attached to the stored object. */
  readonly metadata?: Record<string, string>;
}

/**
 * The storage client interface. Both supabase-storage.ts and mock-storage.ts
 * implement this contract. The document service and API routes consume it.
 */
export interface StorageClient {
  /**
   * Upload a file to the configured bucket.
   * @param bucket  - The bucket name (e.g. "documents").
   * @param key     - The object key within the bucket (e.g. "vessel-123/file.pdf").
   * @param body    - The file contents as a Buffer or readable stream.
   * @param options - Optional content type and metadata overrides.
   * @returns The canonical storage path and metadata.
   */
  upload(
    bucket: string,
    key: string,
    body: Buffer | Readable,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult>;

  /**
   * Generate a time-limited signed URL for downloading an object.
   * @param bucket      - The bucket name.
   * @param key         - The object key.
   * @param expiresInMs - URL validity duration in milliseconds (default 1 hour).
   */
  createSignedUrl(
    bucket: string,
    key: string,
    expiresInMs?: number,
  ): Promise<StorageSignedUrlResult>;

  /**
   * Remove an object from storage. Idempotent — returns true even if absent.
   * @param bucket - The bucket name.
   * @param key    - The object key.
   */
  remove(bucket: string, key: string): Promise<boolean>;

  /**
   * Check whether an object exists in storage.
   * @param bucket - The bucket name.
   * @param key    - The object key.
   */
  exists(bucket: string, key: string): Promise<boolean>;
}
