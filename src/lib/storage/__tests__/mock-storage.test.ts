/**
 * mock-storage.test.ts — unit tests for the Mock Storage Client
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the mock storage client:
 *   1. upload — stores a file and returns the storage path
 *   2. exists — returns true after upload
 *   3. exists — returns false for non-existent key
 *   4. createSignedUrl — generates a URL for an uploaded file
 *   5. remove — removes a file and returns true
 *   6. remove — returns false for non-existent file
 *
 * Run via: npx tsx src/lib/storage/__tests__/mock-storage.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockStorageClient } from "../mock-storage";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MockStorageClient — upload", () => {
  it("uploads a buffer and returns the storage path", async () => {
    const client = createMockStorageClient();
    const result = await client.upload(
      "documents",
      "vessel-123/test.pdf",
      Buffer.from("hello world"),
      { contentType: "application/pdf" },
    );

    expect(result.storagePath).toBe("documents/vessel-123/test.pdf");
    expect(result.contentType).toBe("application/pdf");
    expect(result.size).toBe(11);
  });

  it("defaults content type to application/octet-stream", async () => {
    const client = createMockStorageClient();
    const result = await client.upload(
      "documents",
      "test.bin",
      Buffer.from("binary data"),
    );

    expect(result.contentType).toBe("application/octet-stream");
  });
});

describe("MockStorageClient — exists", () => {
  it("returns true for an uploaded file", async () => {
    const client = createMockStorageClient();
    await client.upload("documents", "test.pdf", Buffer.from("data"));

    const result = await client.exists("documents", "test.pdf");
    expect(result).toBe(true);
  });

  it("returns false for a non-existent file", async () => {
    const client = createMockStorageClient();
    const result = await client.exists("documents", "nonexistent.pdf");
    expect(result).toBe(false);
  });
});

describe("MockStorageClient — createSignedUrl", () => {
  it("generates a signed URL for an uploaded file", async () => {
    const client = createMockStorageClient();
    await client.upload("documents", "test.pdf", Buffer.from("data"));

    const result = await client.createSignedUrl("documents", "test.pdf");
    expect(result.url.length).toBeGreaterThan(0);
    expect(result.url.length).toBeGreaterThan(0);
    const hasDomain = result.url.includes("mock-storage.example.com");
    expect(hasDomain).toBe(true);
    // eslint-disable-next-line no-unexpected-multiline
    expect(result.expiresAt.length).toBeGreaterThan(0);
  });
});

describe("MockStorageClient — remove", () => {
  it("removes an uploaded file and returns true", async () => {
    const client = createMockStorageClient();
    await client.upload("documents", "test.pdf", Buffer.from("data"));

    const result = await client.remove("documents", "test.pdf");
    expect(result).toBe(true);

    const exists = await client.exists("documents", "test.pdf");
    expect(exists).toBe(false);
  });

  it("returns false when removing a non-existent file", async () => {
    const client = createMockStorageClient();
    const result = await client.remove("documents", "nonexistent.pdf");
    expect(result).toBe(false);
  });
});

run();
