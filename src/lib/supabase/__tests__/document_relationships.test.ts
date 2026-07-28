/**
 * document_relationships.test.ts — unit tests for the DocumentRelationshipRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the document relationship repository against the in-memory fake:
 *   1. insert — create a relationship
 *   2. findById — return a relationship when it exists
 *   3. listBySourceDocumentId — outgoing relationships from a document
 *   4. listByTargetDocumentId — incoming relationships to a document
 *   5. listBySourceAndType — filter by type
 *   6. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/document_relationships.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createDocumentRelationshipRepository } from "../repositories/document_relationships";
import { RepositoryUpstreamError } from "../errors";
import type { DocumentRelationshipRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_OLD = "doc-uuid-old";
const DOC_NEW = "doc-uuid-new";

function makeRelRow(
  overrides: Partial<DocumentRelationshipRow> = {},
): DocumentRelationshipRow {
  return {
    id: overrides.id ?? "rel-uuid-001",
    source_document_id: overrides.source_document_id ?? DOC_NEW,
    target_document_id: overrides.target_document_id ?? DOC_OLD,
    relationship_type: overrides.relationship_type ?? "supersedes",
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DocumentRelationshipRepository — insert", () => {
  it("inserts a relationship and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRelationshipRepository({ client: fake });

    const row = await repo.insert({
      source_document_id: DOC_NEW,
      target_document_id: DOC_OLD,
      relationship_type: "supersedes",
    });

    expect(row.source_document_id).toBe(DOC_NEW);
    expect(row.target_document_id).toBe(DOC_OLD);
    expect(row.relationship_type).toBe("supersedes");
    expect(row.id).toBeTruthy();
  });
});

describe("DocumentRelationshipRepository — findById", () => {
  it("returns the relationship when it exists", async () => {
    const existing = makeRelRow();
    const fake = createFakeSupabaseClient({
      tables: { document_relationships: [existing] },
    });
    const repo = createDocumentRelationshipRepository({ client: fake });

    const row = await repo.findById("rel-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.relationship_type).toBe("supersedes");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentRelationshipRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("DocumentRelationshipRepository — listBySourceDocumentId", () => {
  it("returns outgoing relationships from a document", async () => {
    const r1 = makeRelRow({
      id: "r1",
      source_document_id: DOC_NEW,
      relationship_type: "supersedes",
    });
    const r2 = makeRelRow({
      id: "r2",
      source_document_id: DOC_NEW,
      relationship_type: "references",
    });
    const incoming = makeRelRow({
      id: "r3",
      source_document_id: "other-doc",
    });
    const fake = createFakeSupabaseClient({
      tables: { document_relationships: [r1, r2, incoming] },
    });
    const repo = createDocumentRelationshipRepository({ client: fake });

    const rows = await repo.listBySourceDocumentId(DOC_NEW);

    expect(rows.length).toBe(2);
  });
});

describe("DocumentRelationshipRepository — listByTargetDocumentId", () => {
  it("returns incoming relationships to a document", async () => {
    const incoming = makeRelRow({
      id: "r1",
      target_document_id: DOC_OLD,
    });
    const other = makeRelRow({
      id: "r2",
      target_document_id: "other-doc",
    });
    const fake = createFakeSupabaseClient({
      tables: { document_relationships: [incoming, other] },
    });
    const repo = createDocumentRelationshipRepository({ client: fake });

    const rows = await repo.listByTargetDocumentId(DOC_OLD);

    expect(rows.length).toBe(1);
    expect(rows[0]!.target_document_id).toBe(DOC_OLD);
  });
});

describe("DocumentRelationshipRepository — listBySourceAndType", () => {
  it("returns relationships filtered by type", async () => {
    const supersedes = makeRelRow({
      id: "r1",
      relationship_type: "supersedes",
    });
    const references = makeRelRow({
      id: "r2",
      relationship_type: "references",
    });
    const fake = createFakeSupabaseClient({
      tables: { document_relationships: [supersedes, references] },
    });
    const repo = createDocumentRelationshipRepository({ client: fake });

    const rows = await repo.listBySourceAndType(DOC_NEW, "supersedes");

    expect(rows.length).toBe(1);
    expect(rows[0]!.relationship_type).toBe("supersedes");
  });
});

describe("DocumentRelationshipRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createDocumentRelationshipRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        source_document_id: DOC_NEW,
        target_document_id: DOC_OLD,
        relationship_type: "supersedes",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
