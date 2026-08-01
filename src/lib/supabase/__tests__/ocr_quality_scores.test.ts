/**
 * ocr_quality_scores.test.ts — unit tests for the OcrQualityScoreRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the OCR quality score repository against the in-memory fake:
 *   1. insert — write a quality score
 *   2. findById — return a score when it exists
 *   3. listByDocumentId — filter by document
 *   4. findLatestByDocumentId — newest first
 *   5. listByLevel — filter by quality level
 *   6. error mapping
 *
 * Run via: npx tsx src/lib/supabase/__tests__/ocr_quality_scores.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOcrQualityScoreRepository } from "../repositories/ocr_quality_scores";
import { RepositoryUpstreamError } from "../errors";
import type { OcrQualityScoreRow } from "../types";

const NOW = "2026-08-01T00:00:00.000Z";
const OCR_RESULT_ID = "ocr-uuid-001";
const DOC_ID = "doc-uuid-001";

function makeScoreRow(overrides: Partial<OcrQualityScoreRow> = {}): OcrQualityScoreRow {
  return {
    id: overrides.id ?? "quality-uuid-001",
    ocr_result_id: overrides.ocr_result_id ?? OCR_RESULT_ID,
    document_id: overrides.document_id ?? DOC_ID,
    detected_family: overrides.detected_family ?? "BDN",
    overall_quality_score: overrides.overall_quality_score ?? 0.99,
    level: overrides.level ?? "HIGH",
    page_quality: overrides.page_quality ?? 1,
    text_coverage: overrides.text_coverage ?? 1,
    field_coverage: overrides.field_coverage ?? 1,
    confidence_score: overrides.confidence_score ?? 0.95,
    confidence_distribution: overrides.confidence_distribution ?? { HIGH: 60, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
    issues: overrides.issues ?? [],
    missing_mandatory_fields: overrides.missing_mandatory_fields ?? [],
    created_at: overrides.created_at ?? NOW,
  };
}

describe("OcrQualityScoreRepository — insert", () => {
  it("inserts a quality score with defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });

    const row = await repo.insert({
      ocr_result_id: OCR_RESULT_ID,
      document_id: DOC_ID,
      detected_family: "BDN",
      overall_quality_score: 0.99,
      level: "HIGH",
      page_quality: 1,
      text_coverage: 1,
      field_coverage: 1,
      confidence_score: 0.95,
      confidence_distribution: { HIGH: 60, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
      issues: [],
      missing_mandatory_fields: [],
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.level).toBe("HIGH");
    expect(row.id).toBeTruthy();
  });

  it("inserts and finds back by id", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });
    const row = await repo.insert({
      ocr_result_id: OCR_RESULT_ID,
      document_id: DOC_ID,
      detected_family: "CERTIFICATE",
      overall_quality_score: 0.77,
      level: "MEDIUM",
      page_quality: 0.9,
      text_coverage: 0.8,
      field_coverage: 0.7,
      confidence_score: 0.7,
      confidence_distribution: { HIGH: 20, MEDIUM: 30, LOW: 10, VERY_LOW: 0 },
      issues: [{ type: "blur", detected: true, severity: "error" }],
      missing_mandatory_fields: ["validUntil"],
    });

    const found = await repo.findById(row.id);
    expect(found?.overall_quality_score).toBe(0.77);
    expect(found?.level).toBe("MEDIUM");
    expect(found?.missing_mandatory_fields).toEqual(["validUntil"]);
  });

  it("returns null for a missing id", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });
    const found = await repo.findById("missing-uuid");
    expect(found).toBeNull();
  });

  it("lists scores by document id", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });
    await repo.insert(makeScoreRow({ id: "q1", document_id: "doc-a" }));
    await repo.insert(makeScoreRow({ id: "q2", document_id: "doc-b" }));

    const rows = await repo.listByDocumentId("doc-a");
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("q1");
  });

  it("returns the latest score for a document", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });
    await repo.insert(makeScoreRow({ id: "q-old", created_at: "2026-01-01T00:00:00.000Z" }));
    await repo.insert(makeScoreRow({ id: "q-new", created_at: "2026-06-01T00:00:00.000Z" }));

    const latest = await repo.findLatestByDocumentId(DOC_ID);
    expect(latest?.id).toBe("q-new");
  });

  it("lists scores by quality level", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOcrQualityScoreRepository({ client: fake });
    await repo.insert(makeScoreRow({ id: "q-high", level: "HIGH" }));
    await repo.insert(makeScoreRow({ id: "q-low", level: "VERY_LOW" }));

    const low = await repo.listByLevel("VERY_LOW");
    expect(low.length).toBe(1);
    expect(low[0]?.id).toBe("q-low");
  });

  it("maps upstream errors", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "42P01", message: "relation does not exist" },
    });
    const repo = createOcrQualityScoreRepository({ client: fake });
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
