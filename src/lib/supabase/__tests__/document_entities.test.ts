/**
 * document_entities.test.ts — unit tests for the DocumentEntityRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the document entity repository against the in-memory fake:
 *   1. insert — write an entity
 *   2. insertBatch — write multiple entities
 *   3. findById — return an entity when it exists
 *   4. listByDocumentId — filter by document
 *   5. listByDocumentAndType — filter by document + entity type
 *   6. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/document_entities.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createDocumentEntityRepository } from "../repositories/document_entities";
import { RepositoryUpstreamError } from "../errors";
import type { DocumentEntityRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";

function makeEntityRow(
  overrides: Partial<DocumentEntityRow> = {},
): DocumentEntityRow {
  return {
    id: overrides.id ?? "ent-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    ocr_result_id: overrides.ocr_result_id ?? null,
    entity_type: overrides.entity_type ?? "imo_number",
    entity_value: overrides.entity_value ?? "9074729",
    confidence: overrides.confidence ?? 0.98,
    start_offset: overrides.start_offset ?? null,
    end_offset: overrides.end_offset ?? null,
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DocumentEntityRepository — insert", () => {
  it("inserts an entity and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentEntityRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      entity_type: "imo_number",
      entity_value: "9074729",
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.entity_type).toBe("imo_number");
    expect(row.entity_value).toBe("9074729");
    expect(row.id).toBeTruthy();
  });
});

describe("DocumentEntityRepository — insertBatch", () => {
  it("inserts multiple entities", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentEntityRepository({ client: fake });

    const rows = await repo.insertBatch([
      { document_id: DOC_ID, entity_type: "imo_number", entity_value: "9074729" },
      { document_id: DOC_ID, entity_type: "vessel_name", entity_value: "Aurelia" },
    ]);

    expect(rows.length).toBe(2);
    expect(rows[0]!.entity_type).toBe("imo_number");
    expect(rows[1]!.entity_type).toBe("vessel_name");
  });

  it("returns empty array for empty input", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentEntityRepository({ client: fake });

    const rows = await repo.insertBatch([]);

    expect(rows.length).toBe(0);
  });
});

describe("DocumentEntityRepository — findById", () => {
  it("returns the entity when it exists", async () => {
    const existing = makeEntityRow();
    const fake = createFakeSupabaseClient({
      tables: { document_entities: [existing] },
    });
    const repo = createDocumentEntityRepository({ client: fake });

    const row = await repo.findById("ent-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.entity_type).toBe("imo_number");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createDocumentEntityRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("DocumentEntityRepository — listByDocumentId", () => {
  it("returns all entities for a document", async () => {
    const e1 = makeEntityRow({ id: "e1", entity_type: "imo_number" });
    const e2 = makeEntityRow({ id: "e2", entity_type: "vessel_name" });
    const other = makeEntityRow({
      id: "e3",
      document_id: "other-doc",
    });
    const fake = createFakeSupabaseClient({
      tables: { document_entities: [e1, e2, other] },
    });
    const repo = createDocumentEntityRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
  });
});

describe("DocumentEntityRepository — listByDocumentAndType", () => {
  it("returns entities of a specific type for a document", async () => {
    const imo = makeEntityRow({ id: "e1", entity_type: "imo_number" });
    const name = makeEntityRow({ id: "e2", entity_type: "vessel_name" });
    const fake = createFakeSupabaseClient({
      tables: { document_entities: [imo, name] },
    });
    const repo = createDocumentEntityRepository({ client: fake });

    const rows = await repo.listByDocumentAndType(DOC_ID, "imo_number");

    expect(rows.length).toBe(1);
    expect(rows[0]!.entity_type).toBe("imo_number");
  });
});

describe("DocumentEntityRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createDocumentEntityRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        document_id: DOC_ID,
        entity_type: "imo_number",
        entity_value: "9074729",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
