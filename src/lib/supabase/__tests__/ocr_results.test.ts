/**
 * ocr_results.test.ts — unit tests for the OcrResultRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the OCR result repository against the in-memory fake:
 *   1. insert — write an OCR result
 *   2. findById — return a result when it exists
 *   3. findByJobId — find result by processing job
 *   4. listByDocumentId — filter by document
 *   5. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/ocr_results.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOcrResultRepository } from "../repositories/ocr_results";
import { RepositoryUpstreamError } from "../errors";
import type { OcrResultRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";
const JOB_ID = "job-uuid-001";

function makeOcrResultRow(
  overrides: Partial<OcrResultRow> = {},
): OcrResultRow {
  return {
    id: overrides.id ?? "ocr-uuid-001",
    processing_job_id: overrides.processing_job_id ?? JOB_ID,
    document_id: overrides.document_id ?? DOC_ID,
    raw_text: overrides.raw_text ?? "Certificate of Registry IMO 9074729",
    extracted_data: overrides.extracted_data ?? null,
    confidence: overrides.confidence ?? 0.95,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OcrResultRepository — insert", () => {
  it("inserts an OCR result and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrResultRepository({ client: fake });

    const row = await repo.insert({
      processing_job_id: JOB_ID,
      document_id: DOC_ID,
      raw_text: "Certificate of Registry",
    });

    expect(row.processing_job_id).toBe(JOB_ID);
    expect(row.document_id).toBe(DOC_ID);
    expect(row.raw_text).toBe("Certificate of Registry");
    expect(row.id).toBeTruthy();
  });
});

describe("OcrResultRepository — findById", () => {
  it("returns the result when it exists", async () => {
    const existing = makeOcrResultRow();
    const fake = createFakeSupabaseClient({
      tables: { ocr_results: [existing] },
    });
    const repo = createOcrResultRepository({ client: fake });

    const row = await repo.findById("ocr-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.raw_text.includes("IMO 9074729")).toBe(true);
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrResultRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("OcrResultRepository — findByJobId", () => {
  it("returns the result for a specific job", async () => {
    const existing = makeOcrResultRow();
    const fake = createFakeSupabaseClient({
      tables: { ocr_results: [existing] },
    });
    const repo = createOcrResultRepository({ client: fake });

    const row = await repo.findByJobId(JOB_ID);

    expect(row).toBeTruthy();
    expect(row!.processing_job_id).toBe(JOB_ID);
  });

  it("returns null when no result exists for the job", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrResultRepository({ client: fake });

    const row = await repo.findByJobId("nonexistent-job");

    expect(row).toBeNull();
  });
});

describe("OcrResultRepository — listByDocumentId", () => {
  it("returns all OCR results for a document", async () => {
    const r1 = makeOcrResultRow({ id: "ocr-1" });
    const r2 = makeOcrResultRow({ id: "ocr-2" });
    const other = makeOcrResultRow({
      id: "ocr-3",
      document_id: "other-doc",
    });
    const fake = createFakeSupabaseClient({
      tables: { ocr_results: [r1, r2, other] },
    });
    const repo = createOcrResultRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
  });
});

describe("OcrResultRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createOcrResultRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        processing_job_id: JOB_ID,
        document_id: DOC_ID,
        raw_text: "test",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
