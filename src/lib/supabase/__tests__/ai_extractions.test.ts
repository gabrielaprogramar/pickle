/**
 * ai_extractions.test.ts — unit tests for the AiExtractionRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the AI extraction repository against the in-memory fake:
 *   1. insert — create an extraction
 *   2. findById — return an extraction when it exists
 *   3. listByDocumentId — list extractions ordered by created_at DESC
 *   4. findLatestByDocumentId — returns the most recent extraction
 *   5. findLatestCompletedByDocumentId — returns latest completed only
 *   6. updateStatus — updates status and error_message
 *   7. error mapping — wraps transient errors as RepositoryUpstreamError
 *
 * Run via: npx tsx src/lib/supabase/__tests__/ai_extractions.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createAiExtractionRepository } from "../repositories/ai_extractions";
import { RepositoryUpstreamError } from "../errors";
import type { AiExtractionRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";
const OCR_ID = "ocr-uuid-001";

function makeExtractionRow(
  overrides: Partial<AiExtractionRow> = {},
): AiExtractionRow {
  return {
    id: overrides.id ?? "ext-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    ocr_result_id: overrides.ocr_result_id ?? OCR_ID,
    status: overrides.status ?? "completed",
    confidence: overrides.confidence ?? 0.95,
    summary: overrides.summary ?? "Test extraction summary",
    document_type: overrides.document_type ?? "imo_dcs",
    fields: overrides.fields ?? { imoNumber: "9876543", fuelType: "VLSFO" },
    warnings: overrides.warnings ?? [],
    missing_fields: overrides.missing_fields ?? [],
    provider: overrides.provider ?? "mock",
    model: overrides.model ?? "mock",
    prompt_tokens: overrides.prompt_tokens ?? 850,
    completion_tokens: overrides.completion_tokens ?? 420,
    total_tokens: overrides.total_tokens ?? 1270,
    latency_ms: overrides.latency_ms ?? 1500,
    error_message: overrides.error_message ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AiExtractionRepository — insert", () => {
  it("inserts an extraction and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      ocr_result_id: OCR_ID,
      document_type: "imo_dcs",
      status: "completed",
      confidence: 0.96,
      summary: "BDN extraction complete",
      fields: { imoNumber: "9876543", fuelType: "VLSFO" },
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.ocr_result_id).toBe(OCR_ID);
    expect(row.document_type).toBe("imo_dcs");
    expect(row.status).toBe("completed");
    expect(row.confidence).toBe(0.96);
    expect(row.id).toBeTruthy();
  });

  it("defaults status to pending when not provided", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      document_type: "imo_dcs",
    });

    expect(row.status).toBe("pending");
    expect(row.confidence).toBeNull();
    expect(row.summary).toBeNull();
  });

  it("defaults empty arrays and objects when not provided", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      document_type: "report",
    });

    expect(row.fields).toEqual({});
    expect(row.warnings).toEqual([]);
    expect(row.missing_fields).toEqual([]);
  });
});

describe("AiExtractionRepository — findById", () => {
  it("returns the extraction when it exists", async () => {
    const existing = makeExtractionRow({ id: "ext-001" });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [existing] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findById("ext-001");

    expect(row).toBeTruthy();
    expect(row!.id).toBe("ext-001");
    expect(row!.document_id).toBe(DOC_ID);
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("AiExtractionRepository — listByDocumentId", () => {
  it("returns extractions ordered by created_at DESC", async () => {
    const e1 = makeExtractionRow({
      id: "e1",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    const e2 = makeExtractionRow({
      id: "e2",
      created_at: "2026-07-02T00:00:00.000Z",
    });
    const other = makeExtractionRow({
      id: "e3",
      document_id: "other-doc",
      created_at: "2026-07-03T00:00:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [e1, e2, other] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
    // Fake client returns in reverse insertion order (DESC by created_at)
    expect(rows[0]!.created_at >= rows[1]!.created_at).toBe(true);
  });

  it("returns empty array when no extractions exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const rows = await repo.listByDocumentId("nonexistent-doc");

    expect(rows.length).toBe(0);
  });
});

describe("AiExtractionRepository — findLatestByDocumentId", () => {
  it("returns the most recent extraction", async () => {
    const e1 = makeExtractionRow({
      id: "e1",
      status: "completed",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    const e2 = makeExtractionRow({
      id: "e2",
      status: "failed",
      created_at: "2026-07-02T00:00:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [e1, e2] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findLatestByDocumentId(DOC_ID);

    expect(row).toBeTruthy();
    expect(row!.id).toBe("e2");
    expect(row!.status).toBe("failed");
  });

  it("returns null when no extractions exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findLatestByDocumentId("nonexistent-doc");

    expect(row).toBeNull();
  });
});

describe("AiExtractionRepository — findLatestCompletedByDocumentId", () => {
  it("returns the latest completed extraction", async () => {
    const e1 = makeExtractionRow({
      id: "e1",
      status: "completed",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    const e2 = makeExtractionRow({
      id: "e2",
      status: "completed",
      created_at: "2026-07-02T00:00:00.000Z",
    });
    const e3 = makeExtractionRow({
      id: "e3",
      status: "failed",
      created_at: "2026-07-03T00:00:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [e1, e2, e3] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findLatestCompletedByDocumentId(DOC_ID);

    expect(row).toBeTruthy();
    expect(row!.id).toBe("e2");
    expect(row!.status).toBe("completed");
  });

  it("returns null when no completed extractions exist", async () => {
    const e1 = makeExtractionRow({ id: "e1", status: "failed" });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [e1] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findLatestCompletedByDocumentId(DOC_ID);

    expect(row).toBeNull();
  });

  it("returns null when no extractions exist at all", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.findLatestCompletedByDocumentId("nonexistent-doc");

    expect(row).toBeNull();
  });
});

describe("AiExtractionRepository — updateStatus", () => {
  it("updates the status of an extraction", async () => {
    const existing = makeExtractionRow({
      id: "ext-001",
      status: "pending",
    });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [existing] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.updateStatus("ext-001", "completed");

    expect(row.id).toBe("ext-001");
    expect(row.status).toBe("completed");
  });

  it("updates status to failed with error message", async () => {
    const existing = makeExtractionRow({
      id: "ext-001",
      status: "pending",
    });
    const fake = createFakeSupabaseClient({
      tables: { ai_extractions: [existing] },
    });
    const repo = createAiExtractionRepository({ client: fake });

    const row = await repo.updateStatus("ext-001", "failed", {
      error_message: "OpenAI API timeout",
    });

    expect(row.status).toBe("failed");
    expect(row.error_message).toBe("OpenAI API timeout");
  });
});

describe("AiExtractionRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createAiExtractionRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        document_id: DOC_ID,
        document_type: "imo_dcs",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
