/**
 * mock-storage.ts — in-memory mock storage client for tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The document upload pipeline needs a storage client that works without
 * Supabase credentials. This mock stores uploaded bytes in a Map and returns
 * deterministic results — ideal for unit-testing the document service.
 *
 * HOW IT FITS
 * When STORAGE_USE_MOCK=true (default), the storage client factory creates
 * this mock. The mock is stateless between requests but stateful within a
 * test — a test can upload a file and then verify it exists.
 */

import { Readable } from "node:stream";
import type {
  StorageClient,
  StorageSignedUrlResult,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

/** In-memory store: key → { buffer, contentType }. */
interface StoredObject {
  readonly buffer: Buffer;
  readonly contentType: string;
  readonly metadata: Record<string, string>;
}

/**
 * Creates an in-memory mock storage client.
 * All data lives in process memory and is lost when the process exits.
 */
export function createMockStorageClient(): StorageClient {
  const store = new Map<string, StoredObject>();

  return {
    async upload(
      bucket: string,
      key: string,
      body: Buffer | Readable,
      options?: StorageUploadOptions,
    ): Promise<StorageUploadResult> {
      const buffer = isBuffer(body) ? body : await streamToBuffer(body);
      const contentType = options?.contentType ?? "application/octet-stream";
      const storagePath = `${bucket}/${key}`;

      store.set(storagePath, {
        buffer,
        contentType,
        metadata: options?.metadata ?? {},
      });

      return { storagePath, contentType, size: buffer.length };
    },

    async createSignedUrl(
      bucket: string,
      key: string,
      expiresInMs = 3_600_000,
    ): Promise<StorageSignedUrlResult> {
      const storagePath = `${bucket}/${key}`;
      if (!store.has(storagePath)) {
        throw new Error(`Object not found: ${storagePath}`);
      }
      const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
      const url = `https://mock-storage.example.com/${storagePath}?expires=${expiresAt}`;
      return { url, expiresAt };
    },

    async remove(_bucket: string, key: string): Promise<boolean> {
      const storagePath = `${_bucket}/${key}`;
      return store.delete(storagePath);
    },

    async exists(_bucket: string, key: string): Promise<boolean> {
      const storagePath = `${_bucket}/${key}`;
      return store.has(storagePath);
    },

    /** Test-only: expose the store for assertions. */
    _store: store,
  } as unknown as StorageClient;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isBuffer(value: unknown): value is Buffer {
  return typeof Buffer !== "undefined" && Buffer.isBuffer(value);
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
