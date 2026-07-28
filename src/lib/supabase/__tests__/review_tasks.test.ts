/**
 * review_tasks.test.ts — unit tests for the ReviewTaskRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the review task repository against the in-memory fake:
 *   1. insert — write a review task
 *   2. findById — return a task when it exists
 *   3. listByDocumentId — filter by document
 *   4. listByAssignee — filter by assignee
 *   5. listByStatus — filter by status
 *   6. assign — assign a task to a user
 *   7. complete — complete a task with a note
 *   8. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/review_tasks.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createReviewTaskRepository } from "../repositories/review_tasks";
import { RepositoryUpstreamError } from "../errors";
import type { ReviewTaskRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";

function makeTaskRow(
  overrides: Partial<ReviewTaskRow> = {},
): ReviewTaskRow {
  return {
    id: overrides.id ?? "task-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    assigned_to: overrides.assigned_to ?? null,
    status: overrides.status ?? "pending",
    priority: overrides.priority ?? "normal",
    due_at: overrides.due_at ?? null,
    completed_at: overrides.completed_at ?? null,
    review_note: overrides.review_note ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReviewTaskRepository — insert", () => {
  it("inserts a review task with defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.insert({ document_id: DOC_ID });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.status).toBe("pending");
    expect(row.priority).toBe("normal");
    expect(row.id).toBeTruthy();
  });

  it("inserts with explicit priority", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      priority: "urgent",
    });

    expect(row.priority).toBe("urgent");
  });
});

describe("ReviewTaskRepository — findById", () => {
  it("returns the task when it exists", async () => {
    const existing = makeTaskRow();
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [existing] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.findById("task-uuid-001");

    expect(row).toBeTruthy();
    expect(row!.status).toBe("pending");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("ReviewTaskRepository — listByDocumentId", () => {
  it("returns tasks for a specific document", async () => {
    const t1 = makeTaskRow({ id: "t1" });
    const t2 = makeTaskRow({ id: "t2" });
    const other = makeTaskRow({ id: "t3", document_id: "other-doc" });
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [t1, t2, other] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
  });
});

describe("ReviewTaskRepository — listByAssignee", () => {
  it("returns tasks assigned to a user", async () => {
    const assigned = makeTaskRow({ id: "t1", assigned_to: "reviewer@co.com" });
    const unassigned = makeTaskRow({ id: "t2", assigned_to: null });
    const other = makeTaskRow({ id: "t3", assigned_to: "other@co.com" });
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [assigned, unassigned, other] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const rows = await repo.listByAssignee("reviewer@co.com");

    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe("t1");
  });
});

describe("ReviewTaskRepository — listByStatus", () => {
  it("returns tasks filtered by status", async () => {
    const pending = makeTaskRow({ id: "t1", status: "pending" });
    const completed = makeTaskRow({ id: "t2", status: "completed" });
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [pending, completed] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const rows = await repo.listByStatus("pending");

    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("pending");
  });
});

describe("ReviewTaskRepository — assign", () => {
  it("assigns a task and sets status to in_progress", async () => {
    const existing = makeTaskRow();
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [existing] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.assign("task-uuid-001", "reviewer@co.com");

    expect(row.assigned_to).toBe("reviewer@co.com");
    expect(row.status).toBe("in_progress");
  });
});

describe("ReviewTaskRepository — complete", () => {
  it("completes a task with a note", async () => {
    const existing = makeTaskRow({ status: "in_progress" });
    const fake = createFakeSupabaseClient({
      tables: { review_tasks: [existing] },
    });
    const repo = createReviewTaskRepository({ client: fake });

    const row = await repo.complete("task-uuid-001", "Looks good, approved.");

    expect(row.status).toBe("completed");
    expect(row.review_note).toBe("Looks good, approved.");
    expect(row.completed_at).toBeTruthy();
  });
});

describe("ReviewTaskRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createReviewTaskRepository({ client: fake });

    await expect(async () =>
      repo.insert({ document_id: DOC_ID }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
