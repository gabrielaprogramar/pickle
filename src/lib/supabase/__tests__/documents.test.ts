/**
 * documents.test.ts — unit tests for the DocumentRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the document repository against the in-memory fake:
 *   1. insert — write a document, return the row with server defaults
 *   2. findById — return a document when it exists
 *   3. findById — return null when not found
 *   4. updateStatus — transition document status
 *   5. listByVesselId — filter documents by vessel
 *   6. listByType — filter documents by type
 *   7. error mapping — upstream errors propagate correctly
 *
 * Run via: npx tsx src/lib/supabase/__tests__/documents.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createDocumentRepository } from "../repositories/documents";
import { RepositoryUpstreamError } from "../errors";
import type { DocumentRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";

function makeDocumentRow(
  overrides: Partial<DocumentRow> = {},
): DocumentRow {
  return {
    id: overrides.id ?? "doc-uuid-001",
    vessel_id: overrides.vessel_id ?? null,
    document_type: overrides.document_type ?? "certificate",
    status: overrides.status ?? "uploaded",
    title: overrides.title ?? "ISPS Certificate",
    filename: overrides.filename ?? "isps_cert.pdf",
    mime_type: overrides.mime_type ?? "application/pdf",
    file_size: overrides.file_size ?? 204800,
    storage_path: overrides.storage_path ?? "documents/isps_cert.pdf",
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DocumentRepository — insert", () => {
  it("inserts a new document and returns the row with server defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRepository({ client: fake });

    const row = await repo.insert({
      document_type: "certificate",
      title: "ISPS Certificate",
      filename: "isps_cert.pdf",
      mime_type: "application/pdf",
      storage_path: "documents/isps_cert.pdf",
    });

    expect(row.document_type).toBe("certificate");
    expect(row.title).toBe("ISPS Certificate");
    expect(row.status).toBe("uploaded");
    expect(row.id).toBeTruthy();
    expect(row.vessel_id).toBeNull();
  });

  it("inserts a vessel-specific document", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRepository({ client: fake });

    const row = await repo.insert({
      vessel_id: "vessel-uuid-001",
      document_type: "imo_dcs",
      title: "DCS Report 2026",
      filename: "dcs_2026.csv",
      mime_type: "text/csv",
      storage_path: "documents/dcs_2026.csv",
    });

    expect(row.vessel_id).toBe("vessel-uuid-001");
    expect(row.document_type).toBe("imo_dcs");
  });
});

describe("DocumentRepository — findById", () => {
  it("returns the document when it exists", async () => {
    const existing = makeDocumentRow();
    const fake = createFakeSupabaseClient({
      tables: { documents: [existing] },
    });
    const repo = createDocumentRepository({ client: fake });

    const row = await repo.findById("doc-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.title).toBe("ISPS Certificate");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("DocumentRepository — updateStatus", () => {
  it("transitions document status", async () => {
    const existing = makeDocumentRow();
    const fake = createFakeSupabaseClient({
      tables: { documents: [existing] },
    });
    const repo = createDocumentRepository({ client: fake });

    const row = await repo.updateStatus("doc-uuid-001", "processing");

    expect(row.status).toBe("processing");
    expect(row.id).toBe("doc-uuid-001");
  });
});

describe("DocumentRepository — listByVesselId", () => {
  it("returns documents for a specific vessel", async () => {
    const doc1 = makeDocumentRow({
      id: "doc-1",
      vessel_id: "vessel-uuid-001",
      title: "First",
    });
    const doc2 = makeDocumentRow({
      id: "doc-2",
      vessel_id: "vessel-uuid-001",
      title: "Second",
    });
    const other = makeDocumentRow({
      id: "doc-3",
      vessel_id: "vessel-uuid-999",
      title: "Other",
    });
    const fake = createFakeSupabaseClient({
      tables: { documents: [doc1, doc2, other] },
    });
    const repo = createDocumentRepository({ client: fake });

    const rows = await repo.listByVesselId("vessel-uuid-001");

    expect(rows.length).toBe(2);
  });

  it("returns empty array when no documents match", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRepository({ client: fake });

    const rows = await repo.listByVesselId("nonexistent-vessel");

    expect(rows.length).toBe(0);
  });
});

describe("DocumentRepository — listByType", () => {
  it("returns documents of a specific type", async () => {
    const cert = makeDocumentRow({ id: "doc-1", document_type: "certificate" });
    const report = makeDocumentRow({ id: "doc-2", document_type: "report" });
    const fake = createFakeSupabaseClient({
      tables: { documents: [cert, report] },
    });
    const repo = createDocumentRepository({ client: fake });

    const rows = await repo.listByType("certificate");

    expect(rows.length).toBe(1);
    expect(rows[0]!.document_type).toBe("certificate");
  });
});

describe("DocumentRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: {
        code: "08006",
        message: "connection failure",
      },
    });
    const repo = createDocumentRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        document_type: "certificate",
        title: "Test",
        filename: "test.pdf",
        mime_type: "application/pdf",
        storage_path: "test.pdf",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
