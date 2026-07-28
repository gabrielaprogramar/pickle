/**
 * processing_logs.test.ts — unit tests for the ProcessingLogRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the processing log repository against the in-memory fake:
 *   1. insert — append a log entry
 *   2. listByJobId — ordered by created_at ASC
 *   3. listByJobAndLevel — filter by severity
 *   4. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/processing_logs.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createProcessingLogRepository } from "../repositories/processing_logs";
import { RepositoryUpstreamError } from "../errors";
import type { ProcessingLogRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const JOB_ID = "job-uuid-001";

function makeLogRow(
  overrides: Partial<ProcessingLogRow> = {},
): ProcessingLogRow {
  return {
    id: overrides.id ?? "log-uuid-001",
    processing_job_id: overrides.processing_job_id ?? JOB_ID,
    level: overrides.level ?? "info",
    message: overrides.message ?? "OCR started",
    details: overrides.details ?? null,
    created_at: overrides.created_at ?? "2026-07-01T00:00:00.000Z",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProcessingLogRepository — insert", () => {
  it("inserts a log entry and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createProcessingLogRepository({ client: fake });

    const row = await repo.insert({
      processing_job_id: JOB_ID,
      level: "info",
      message: "OCR processing started",
    });

    expect(row.processing_job_id).toBe(JOB_ID);
    expect(row.level).toBe("info");
    expect(row.message).toBe("OCR processing started");
    expect(row.id).toBeTruthy();
  });
});

describe("ProcessingLogRepository — listByJobId", () => {
  it("returns logs ordered by created_at ASC", async () => {
    const late = makeLogRow({
      id: "log-2",
      message: "step 2",
      created_at: "2026-07-01T00:00:01.000Z",
    });
    const early = makeLogRow({
      id: "log-1",
      message: "step 1",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    const other = makeLogRow({
      id: "log-3",
      processing_job_id: "other-job",
      message: "other",
    });
    const fake = createFakeSupabaseClient({
      tables: { processing_logs: [late, early, other] },
    });
    const repo = createProcessingLogRepository({ client: fake });

    const rows = await repo.listByJobId(JOB_ID);

    expect(rows.length).toBe(2);
    expect(rows[0]!.message).toBe("step 1");
    expect(rows[1]!.message).toBe("step 2");
  });
});

describe("ProcessingLogRepository — listByJobAndLevel", () => {
  it("returns logs filtered by level", async () => {
    const info = makeLogRow({ id: "l1", level: "info" });
    const warn = makeLogRow({ id: "l2", level: "warning" });
    const error = makeLogRow({ id: "l3", level: "error" });
    const fake = createFakeSupabaseClient({
      tables: { processing_logs: [info, warn, error] },
    });
    const repo = createProcessingLogRepository({ client: fake });

    const rows = await repo.listByJobAndLevel(JOB_ID, "warning");

    expect(rows.length).toBe(1);
    expect(rows[0]!.level).toBe("warning");
  });
});

describe("ProcessingLogRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createProcessingLogRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        processing_job_id: JOB_ID,
        level: "info",
        message: "test",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
