/**
 * supabase-storage.ts — Supabase Storage implementation of StorageClient
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Real file persistence using Supabase Storage (S3-compatible). This
 * implementation is used when STORAGE_USE_MOCK=false. It delegates to the
 * Supabase client's built-in storage methods.
 *
 * HOW IT FITS
 * The storage client factory (client.ts) creates this implementation in live
 * mode. The document service calls upload/remove/createSignedUrl on this client
 * without knowing whether it's backed by real Supabase or the mock.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Readable } from "node:stream";
import { StorageUpstreamError } from "./errors";
import type {
  StorageClient,
  StorageSignedUrlResult,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

/**
 * Creates a Supabase-backed storage client.
 * @param supabase - An initialized SupabaseClient with storage access.
 */
export function createSupabaseStorageClient(
  supabase: SupabaseClient,
): StorageClient {
  return {
    async upload(
      bucket: string,
      key: string,
      body: Buffer | Readable,
      options?: StorageUploadOptions,
    ): Promise<StorageUploadResult> {
      try {
        const buffer = isBuffer(body) ? body : await streamToBuffer(body);
        const contentType = options?.contentType ?? "application/octet-stream";

        const { error } = await supabase.storage
          .from(bucket)
          .upload(key, buffer, {
            contentType,
            upsert: false,
            ...(options?.metadata
              ? { metadata: options.metadata }
              : {}),
          });

        if (error) {
          throw new StorageUpstreamError(
            `Storage upload failed: ${error.message}`,
            error,
          );
        }

        return {
          storagePath: `${bucket}/${key}`,
          contentType,
          size: buffer.length,
        };
      } catch (e) {
        if (e instanceof StorageUpstreamError) throw e;
        throw new StorageUpstreamError(
          `Storage upload failed: ${e instanceof Error ? e.message : String(e)}`,
          e,
        );
      }
    },

    async createSignedUrl(
      bucket: string,
      key: string,
      expiresInMs = 3_600_000,
    ): Promise<StorageSignedUrlResult> {
      try {
        const expiresInSec = Math.floor(expiresInMs / 1000);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(key, expiresInSec);

        if (error) {
          throw new StorageUpstreamError(
            `Signed URL creation failed: ${error.message}`,
            error,
          );
        }

        const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
        return { url: data.signedUrl, expiresAt };
      } catch (e) {
        if (e instanceof StorageUpstreamError) throw e;
        throw new StorageUpstreamError(
          `Signed URL creation failed: ${e instanceof Error ? e.message : String(e)}`,
          e,
        );
      }
    },

    async remove(bucket: string, key: string): Promise<boolean> {
      try {
        const { error } = await supabase.storage.from(bucket).remove([key]);
        if (error) {
          throw new StorageUpstreamError(
            `Storage remove failed: ${error.message}`,
            error,
          );
        }
        return true;
      } catch (e) {
        if (e instanceof StorageUpstreamError) throw e;
        throw new StorageUpstreamError(
          `Storage remove failed: ${e instanceof Error ? e.message : String(e)}`,
          e,
        );
      }
    },

    async exists(bucket: string, key: string): Promise<boolean> {
      try {
        const { data, error } = await supabase.storage.from(bucket).list(
          key.split("/").slice(0, -1).join("/") || undefined,
          { search: key.split("/").pop() ?? "" },
        );

        if (error) {
          throw new StorageUpstreamError(
            `Storage exists check failed: ${error.message}`,
            error,
          );
        }

        return (data?.length ?? 0) > 0;
      } catch (e) {
        if (e instanceof StorageUpstreamError) throw e;
        throw new StorageUpstreamError(
          `Storage exists check failed: ${e instanceof Error ? e.message : String(e)}`,
          e,
        );
      }
    },
  };
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
