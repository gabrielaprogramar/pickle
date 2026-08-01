/**
 * ocr_review_suggestions.test.ts — unit tests for the OcrReviewSuggestionRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the OCR repair suggestion repository against the in-memory fake:
 *   1. insert / insertMany — write suggestion rows
 *   2. findById — return a suggestion when it exists
 *   3. listByDocumentId — filter by document
 *   4. listByStatus — filter by workflow state
 *   5. updateStatus — accept/reject a suggestion
 *   6. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/ocr_review_suggestions.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOcrReviewSuggestionRepository } from "../repositories/ocr_review_suggestions";
import { RepositoryUpstreamError } from "../errors";
import type { OcrReviewSuggestionRow } from "../types";

const OCR_RESULT_ID = "ocr-uuid-001";
const DOC_ID = "doc-uuid-001";

function makeSuggestion(
  overrides: Partial<OcrReviewSuggestionRow> = {},
): OcrReviewSuggestionRow {
  return {
    id: overrides.id ?? "sug-uuid-001",
    ocr_result_id: overrides.ocr_result_id ?? OCR_RESULT_ID,
    document_id: overrides.document_id ?? DOC_ID,
    field_key: overrides.field_key ?? "imoNumber",
    kind: overrides.kind ?? "IMO_CHECKSUM",
    original_value: overrides.original_value ?? "9321481",
    suggested_value: overrides.suggested_value ?? "9321483",
    confidence: overrides.confidence ?? 0.85,
    reason: overrides.reason ?? "Check digit mismatch.",
    priority: overrides.priority ?? "MEDIUM",
    status: overrides.status ?? "open",
    created_at: overrides.created_at ?? "2026-08-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-08-01T00:00:00.000Z",
  };
}

describe("OcrReviewSuggestionRepository — insert", () => {
  it("inserts a suggestion with an open default status", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });

    const row = await repo.insert({
      ocr_result_id: OCR_RESULT_ID,
      document_id: DOC_ID,
      field_key: "imoNumber",
      kind: "IMO_CHECKSUM",
      original_value: "9321481",
      suggested_value: "9321483",
      confidence: 0.85,
      reason: "Check digit mismatch.",
      priority: "MEDIUM",
    });

    expect(row.status).toBe("open");
    expect(row.kind).toBe("IMO_CHECKSUM");
    expect(row.id).toBeTruthy();
  });

  it("inserts many suggestions at once", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    const rows = await repo.insertMany([
      makeSuggestion({ id: "s1", kind: "IMO_CHECKSUM" }),
      makeSuggestion({ id: "s2", kind: "DATE_FORMAT" }),
    ]);
    expect(rows.length).toBe(2);
  });

  it("insertMany with an empty input returns an empty array", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    const rows = await repo.insertMany([]);
    expect(rows.length).toBe(0);
  });

  it("returns null for a missing id", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    const found = await repo.findById("missing-uuid");
    expect(found).toBeNull();
  });

  it("lists suggestions by document id", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    await repo.insert(makeSuggestion({ id: "s1", document_id: "doc-a" }));
    await repo.insert(makeSuggestion({ id: "s2", document_id: "doc-b" }));

    const rows = await repo.listByDocumentId("doc-a");
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("s1");
  });

  it("lists suggestions by status", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    await repo.insert(makeSuggestion({ id: "s-open", status: "open" }));
    await repo.insert(makeSuggestion({ id: "s-accepted", status: "accepted" }));

    const open = await repo.listByStatus("open");
    expect(open.length).toBe(1);
    expect(open[0]?.id).toBe("s-open");
  });

  it("updates a suggestion status", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    const row = await repo.insert(makeSuggestion({ id: "s1" }));

    const updated = await repo.updateStatus(row.id, "accepted");
    expect(updated.status).toBe("accepted");
  });

  it("maps upstream errors", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "42P01", message: "relation does not exist" },
    });
    const repo = createOcrReviewSuggestionRepository({ client: fake });
    let threw = false;
    let isUpstream = false;
    try {
      await repo.findById("x");
    } catch (err) {
      threw = true;
      isUpstream = err instanceof RepositoryUpstreamError;
    }
    expect(threw).toBe(true);
    expect(isUpstream).toBe(true);
  });
});

run();
