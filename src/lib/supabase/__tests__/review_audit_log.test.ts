import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createReviewAuditLogRepository } from "../repositories/review_audit_log";
import { RepositoryUpstreamError } from "../errors";
import type { ReviewAuditLogRow } from "../types";

const TASK_ID = "review-task-uuid-001";

function makeAuditRow(overrides: Partial<ReviewAuditLogRow> = {}): ReviewAuditLogRow {
  return {
    id: overrides.id ?? "audit-uuid-001",
    review_task_id: overrides.review_task_id ?? TASK_ID,
    field_name: overrides.field_name ?? null,
    action: overrides.action ?? "assigned",
    previous_value: overrides.previous_value ?? null,
    new_value: overrides.new_value ?? null,
    reviewer: overrides.reviewer ?? "system",
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-07-29T10:00:00.000Z",
  };
}

describe("ReviewAuditLogRepository — insert", () => {
  it("inserts an audit entry and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewAuditLogRepository({ client: fake });

    const row = await repo.insert({
      review_task_id: TASK_ID,
      action: "field_approved",
      field_name: "imoNumber",
      reviewer: "alice@test.io",
    });

    expect(row.review_task_id).toBe(TASK_ID);
    expect(row.action).toBe("field_approved");
    expect(row.field_name).toBe("imoNumber");
    expect(row.reviewer).toBe("alice@test.io");
    expect(row.id).toBeTruthy();
  });

  it("inserts with notes and change tracking", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewAuditLogRepository({ client: fake });

    const row = await repo.insert({
      review_task_id: TASK_ID,
      action: "field_edited",
      field_name: "quantityTonnes",
      previous_value: 1500,
      new_value: 2050,
      reviewer: "bob@test.io",
      notes: "Corrected per physical BDN",
    });

    expect(row.action).toBe("field_edited");
    expect(row.previous_value).toBe(1500);
    expect(row.new_value).toBe(2050);
    expect(row.notes).toBe("Corrected per physical BDN");
  });

  it("defaults optional fields to null", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewAuditLogRepository({ client: fake });

    const row = await repo.insert({
      review_task_id: TASK_ID,
      action: "assigned",
      reviewer: "system",
    });

    expect(row.field_name).toBeNull();
    expect(row.previous_value).toBeNull();
    expect(row.new_value).toBeNull();
    expect(row.notes).toBeNull();
  });
});

describe("ReviewAuditLogRepository — listByReviewTaskId", () => {
  it("returns entries ordered by created_at ASC", async () => {
    const e1 = makeAuditRow({ id: "e1", created_at: "2026-07-29T10:00:00.000Z", action: "assigned" });
    const e2 = makeAuditRow({ id: "e2", created_at: "2026-07-29T10:01:00.000Z", action: "field_approved" });
    const other = makeAuditRow({
      id: "e3",
      review_task_id: "other-task",
      created_at: "2026-07-29T10:02:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { review_audit_log: [e1, e2, other] },
    });
    const repo = createReviewAuditLogRepository({ client: fake });

    const rows = await repo.listByReviewTaskId(TASK_ID);

    expect(rows.length).toBe(2);
    expect(rows[0]!.id).toBe("e1");
    expect(rows[1]!.id).toBe("e2");
  });

  it("returns empty array when no entries exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createReviewAuditLogRepository({ client: fake });

    const rows = await repo.listByReviewTaskId("nonexistent-task");

    expect(rows.length).toBe(0);
  });
});

describe("ReviewAuditLogRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createReviewAuditLogRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        review_task_id: TASK_ID,
        action: "assigned",
        reviewer: "system",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
