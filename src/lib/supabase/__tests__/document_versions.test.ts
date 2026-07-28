/**
 * document_versions.test.ts — unit tests for the DocumentVersionRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the document version repository against the in-memory fake:
 *   1. insert — write a version, return the row
 *   2. listByDocumentId — versions ordered by version_number ASC
 *   3. findLatestByDocumentId — returns the highest version
 *   4. findLatestByDocumentId — null when no versions exist
 *   5. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/document_versions.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createDocumentVersionRepository } from "../repositories/document_versions";
import { RepositoryUpstreamError } from "../errors";
import type { DocumentVersionRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";

function makeVersionRow(
  overrides: Partial<DocumentVersionRow> = {},
): DocumentVersionRow {
  return {
    id: overrides.id ?? "ver-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    version_number: overrides.version_number ?? 1,
    filename: overrides.filename ?? "isps_cert.pdf",
    storage_path: overrides.storage_path ?? "documents/v1/isps_cert.pdf",
    file_size: overrides.file_size ?? 204800,
    uploaded_by: overrides.uploaded_by ?? null,
    upload_note: overrides.upload_note ?? null,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DocumentVersionRepository — insert", () => {
  it("inserts a version and returns the row with server defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentVersionRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      version_number: 1,
      filename: "isps_cert.pdf",
      storage_path: "documents/v1/isps_cert.pdf",
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.version_number).toBe(1);
    expect(row.id).toBeTruthy();
    expect(row.uploaded_by).toBeNull();
  });
});

describe("DocumentVersionRepository — listByDocumentId", () => {
  it("returns versions ordered by version_number ASC", async () => {
    const v2 = makeVersionRow({ id: "ver-2", version_number: 2 });
    const v1 = makeVersionRow({ id: "ver-1", version_number: 1 });
    const fake = createFakeSupabaseClient({
      tables: { document_versions: [v2, v1] },
    });
    const repo = createDocumentVersionRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
    expect(rows[0]!.version_number).toBe(1);
    expect(rows[1]!.version_number).toBe(2);
  });
});

describe("DocumentVersionRepository — findLatestByDocumentId", () => {
  it("returns the highest version number", async () => {
    const v1 = makeVersionRow({ id: "ver-1", version_number: 1 });
    const v3 = makeVersionRow({ id: "ver-3", version_number: 3 });
    const v2 = makeVersionRow({ id: "ver-2", version_number: 2 });
    const fake = createFakeSupabaseClient({
      tables: { document_versions: [v1, v3, v2] },
    });
    const repo = createDocumentVersionRepository({ client: fake });

    const row = await repo.findLatestByDocumentId(DOC_ID);

    expect(row).toBeTruthy();
    expect(row!.version_number).toBe(3);
    expect(row!.id).toBe("ver-3");
  });

  it("returns null when no versions exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentVersionRepository({ client: fake });

    const row = await repo.findLatestByDocumentId("nonexistent-doc");

    expect(row).toBeNull();
  });
});

describe("DocumentVersionRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createDocumentVersionRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        document_id: DOC_ID,
        version_number: 1,
        filename: "test.pdf",
        storage_path: "test.pdf",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
