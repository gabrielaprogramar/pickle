/**
 * processing_jobs.test.ts — unit tests for the ProcessingJobRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the processing job repository against the in-memory fake:
 *   1. insert — write a job, return the row
 *   2. findById — return a job when it exists
 *   3. listByDocumentId — filter by document
 *   4. findLatestByDocumentAndType — newest job of a type for a document
 *   5. updateStatus — transition job status with timestamps
 *   6. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/processing_jobs.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createProcessingJobRepository } from "../repositories/processing_jobs";
import { RepositoryUpstreamError } from "../errors";
import type { ProcessingJobRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";

function makeJobRow(
  overrides: Partial<ProcessingJobRow> = {},
): ProcessingJobRow {
  return {
    id: overrides.id ?? "job-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    document_version_id: overrides.document_version_id ?? null,
    job_type: overrides.job_type ?? "ocr",
    status: overrides.status ?? "pending",
    started_at: overrides.started_at ?? null,
    completed_at: overrides.completed_at ?? null,
    error_message: overrides.error_message ?? null,
    result: overrides.result ?? null,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProcessingJobRepository — insert", () => {
  it("inserts a job with default status", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.insert({ document_id: DOC_ID, job_type: "ocr" });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.job_type).toBe("ocr");
    expect(row.status).toBe("pending");
    expect(row.id).toBeTruthy();
  });
});

describe("ProcessingJobRepository — findById", () => {
  it("returns the job when it exists", async () => {
    const existing = makeJobRow();
    const fake = createFakeSupabaseClient({
      tables: { processing_jobs: [existing] },
    });
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.findById("job-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.job_type).toBe("ocr");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("ProcessingJobRepository — listByDocumentId", () => {
  it("returns jobs for a document", async () => {
    const j1 = makeJobRow({ id: "j1", job_type: "ocr" });
    const j2 = makeJobRow({ id: "j2", job_type: "entity_extraction" });
    const other = makeJobRow({
      id: "j3",
      document_id: "other-doc",
      job_type: "classification",
    });
    const fake = createFakeSupabaseClient({
      tables: { processing_jobs: [j1, j2, other] },
    });
    const repo = createProcessingJobRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
  });
});

describe("ProcessingJobRepository — findLatestByDocumentAndType", () => {
  it("returns the newest job of a given type", async () => {
    const old = makeJobRow({ id: "j-old", job_type: "ocr", created_at: "2026-06-01T00:00:00Z" });
    const recent = makeJobRow({ id: "j-recent", job_type: "ocr", created_at: "2026-07-01T00:00:00Z" });
    const fake = createFakeSupabaseClient({
      tables: { processing_jobs: [old, recent] },
    });
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.findLatestByDocumentAndType(DOC_ID, "ocr");

    expect(row).toBeTruthy();
    expect(row!.id).toBe("j-recent");
  });

  it("returns null when no matching job exists", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.findLatestByDocumentAndType("nonexistent", "ocr");

    expect(row).toBeNull();
  });
});

describe("ProcessingJobRepository — updateStatus", () => {
  it("transitions job status and sets timestamps", async () => {
    const existing = makeJobRow();
    const fake = createFakeSupabaseClient({
      tables: { processing_jobs: [existing] },
    });
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.updateStatus("job-uuid-001", "completed", {
      started_at: "2026-07-01T00:00:01Z",
      completed_at: "2026-07-01T00:01:00Z",
      result: { pages: 5 },
    });

    expect(row.status).toBe("completed");
    expect(row.started_at).toBe("2026-07-01T00:00:01Z");
    expect(row.completed_at).toBe("2026-07-01T00:01:00Z");
    expect(row.result).toEqual({ pages: 5 });
  });

  it("sets error_message on failure", async () => {
    const existing = makeJobRow();
    const fake = createFakeSupabaseClient({
      tables: { processing_jobs: [existing] },
    });
    const repo = createProcessingJobRepository({ client: fake });

    const row = await repo.updateStatus("job-uuid-001", "failed", {
      error_message: "OCR engine unavailable",
    });

    expect(row.status).toBe("failed");
    expect(row.error_message).toBe("OCR engine unavailable");
  });
});

describe("ProcessingJobRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createProcessingJobRepository({ client: fake });

    await expect(async () =>
      repo.insert({ document_id: DOC_ID, job_type: "ocr" }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
