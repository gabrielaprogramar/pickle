import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createValidationReportRepository } from "../repositories/validation_reports";
import { RepositoryUpstreamError } from "../errors";
import type { ValidationReportRow } from "../types";

const NOW = "2026-07-01T00:00:00.000Z";
const DOC_ID = "doc-uuid-001";
const EXTRACTION_ID = "ext-uuid-001";

function makeReportRow(
  overrides: Partial<ValidationReportRow> = {},
): ValidationReportRow {
  return {
    id: overrides.id ?? "vr-uuid-001",
    document_id: overrides.document_id ?? DOC_ID,
    extraction_id: overrides.extraction_id ?? EXTRACTION_ID,
    status: overrides.status ?? "passed",
    score: overrides.score ?? 95,
    rule_results: overrides.rule_results ?? [{ ruleId: "test", passed: true }],
    passed_count: overrides.passed_count ?? 20,
    failed_count: overrides.failed_count ?? 1,
    error_count: overrides.error_count ?? 0,
    warning_count: overrides.warning_count ?? 1,
    blocking_issues: overrides.blocking_issues ?? [],
    recommended_review: overrides.recommended_review ?? ["1 warning(s) require manual review"],
    ready_for_review: overrides.ready_for_review ?? true,
    validator_version: overrides.validator_version ?? "1.0.0",
    latency_ms: overrides.latency_ms ?? 150,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

describe("ValidationReportRepository — insert", () => {
  it("inserts a validation report and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      extraction_id: EXTRACTION_ID,
      status: "passed",
      score: 100,
      rule_results: [{ ruleId: "structural.required.imoNumber", passed: true }],
      passed_count: 23,
      failed_count: 0,
      ready_for_review: true,
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.extraction_id).toBe(EXTRACTION_ID);
    expect(row.status).toBe("passed");
    expect(row.score).toBe(100);
    expect(row.passed_count).toBe(23);
    expect(row.failed_count).toBe(0);
    expect(row.ready_for_review).toBe(true);
    expect(row.id).toBeTruthy();
  });

  it("defaults fields when not provided", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
    });

    expect(row.status).toBe("pending");
    expect(row.score).toBe(0);
    expect(row.passed_count).toBe(0);
    expect(row.failed_count).toBe(0);
    expect(row.error_count).toBe(0);
    expect(row.warning_count).toBe(0);
    expect(row.ready_for_review).toBe(false);
    expect(row.validator_version).toBe("1.0.0");
    expect(row.blocking_issues).toEqual([]);
    expect(row.recommended_review).toEqual([]);
  });
});

describe("ValidationReportRepository — findById", () => {
  it("returns the report when it exists", async () => {
    const existing = makeReportRow({ id: "vr-001" });
    const fake = createFakeSupabaseClient({
      tables: { validation_reports: [existing] },
    });
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.findById("vr-001");

    expect(row).toBeTruthy();
    expect(row!.id).toBe("vr-001");
    expect(row!.document_id).toBe(DOC_ID);
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");

    expect(row).toBeNull();
  });
});

describe("ValidationReportRepository — listByDocumentId", () => {
  it("returns reports ordered by created_at DESC", async () => {
    const r1 = makeReportRow({ id: "r1", created_at: "2026-07-01T00:00:00.000Z" });
    const r2 = makeReportRow({ id: "r2", created_at: "2026-07-02T00:00:00.000Z" });
    const other = makeReportRow({
      id: "r3",
      document_id: "other-doc",
      created_at: "2026-07-03T00:00:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { validation_reports: [r1, r2, other] },
    });
    const repo = createValidationReportRepository({ client: fake });

    const rows = await repo.listByDocumentId(DOC_ID);

    expect(rows.length).toBe(2);
    expect(rows[0]!.created_at >= rows[1]!.created_at).toBe(true);
  });

  it("returns empty array when no reports exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createValidationReportRepository({ client: fake });

    const rows = await repo.listByDocumentId("nonexistent-doc");

    expect(rows.length).toBe(0);
  });
});

describe("ValidationReportRepository — findLatestByDocumentId", () => {
  it("returns the most recent report", async () => {
    const r1 = makeReportRow({
      id: "r1",
      status: "passed",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    const r2 = makeReportRow({
      id: "r2",
      status: "warning",
      created_at: "2026-07-02T00:00:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { validation_reports: [r1, r2] },
    });
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.findLatestByDocumentId(DOC_ID);

    expect(row).toBeTruthy();
    expect(row!.id).toBe("r2");
    expect(row!.status).toBe("warning");
  });

  it("returns null when no reports exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createValidationReportRepository({ client: fake });

    const row = await repo.findLatestByDocumentId("nonexistent-doc");

    expect(row).toBeNull();
  });
});

describe("ValidationReportRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createValidationReportRepository({ client: fake });

    await expect(async () =>
      repo.insert({ document_id: DOC_ID }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
