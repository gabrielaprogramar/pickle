/**
 * routes.test.ts — OCR Intelligence Assistant API routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises GET /api/ocr/quality, POST /api/ocr/review and
 * POST /api/ocr/suggestions against the deterministic OCR engines with the
 * in-memory fake Supabase client (mirrors the sox-watch / certificates
 * route-test DI pattern).
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { OCR_REVIEW_REQUIRED } from "@/lib/ocr-assistant";
import { buildOcrApiDepsForClient } from "../_lib";
import type { OcrApiDeps } from "../_lib";
import { GET as getQuality } from "../quality/route";
import { POST as postReview } from "../review/route";
import { POST as postSuggestions } from "../suggestions/route";
import { PATCH as patchSuggestion } from "../suggestions/[id]/route";

const PERFECT = "ocr-doc-perfect-bdn";
const ROTATED = "ocr-doc-rotated-bdn";
const UNREADABLE = "ocr-doc-unreadable-noon-report";

function buildDeps() {
  const fake = createFakeSupabaseClient();
  const deps: OcrApiDeps = buildOcrApiDepsForClient(fake);
  return { fake, deps };
}

function qualityRequest(documentId: string, query = "") {
  return new Request(`https://example.com/api/ocr/quality?documentId=${documentId}${query}`, {
    method: "GET",
  });
}

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/ocr/quality", () => {
  it("returns the computed snapshot for a known document", async () => {
    const { deps } = buildDeps();
    const response = await getQuality(qualityRequest(PERFECT), deps);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.documentId).toBe(PERFECT);
    expect(body.data.computed.level).toBe("HIGH");
    expect(Math.abs(body.data.computed.overallQualityScore - 0.992) < 0.001).toBe(true);
    expect(body.data.computed.priority).toBe("LOW");
    expect(body.data.record).toBeNull();
  });

  it("returns 400 when documentId is missing", async () => {
    const { deps } = buildDeps();
    const response = await getQuality(
      new Request("https://example.com/api/ocr/quality", { method: "GET" }),
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown document", async () => {
    const { deps } = buildDeps();
    const response = await getQuality(qualityRequest("ocr-doc-does-not-exist"), deps);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns the latest persisted record when one exists", async () => {
    const { deps } = buildDeps();
    await postReview(
      postRequest("https://example.com/api/ocr/review", { documentId: ROTATED }),
      deps,
    );

    const response = await getQuality(qualityRequest(ROTATED), deps);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.record).toBeTruthy();
    expect(body.data.record.document_id).toBe(ROTATED);
    expect(body.data.record.level).toBe("MEDIUM");
    expect(Math.abs(body.data.record.overall_quality_score - 0.769) < 0.001).toBe(true);
  });
});

describe("POST /api/ocr/review", () => {
  it("clears a clean scan for capture without a review task", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", { documentId: PERFECT }),
      deps,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.outcome.priority).toBe("LOW");
    expect(body.data.outcome.reviewRequired).toBe(false);
    expect(body.data.reviewTask).toBeNull();
    expect(body.data.qualityRecord.level).toBe("HIGH");
    expect(body.data.qualityRecord.document_id).toBe(PERFECT);
    expect(body.data.suggestions.length).toBe(0);
  });

  it("routes a repairable scan to review and persists suggestions", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", { documentId: ROTATED }),
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.outcome.reviewRequired).toBe(true);
    expect(body.data.outcome.priority).toBe("MEDIUM");
    expect(body.data.reviewTask).toBeTruthy();
    expect(body.data.reviewTask.priority).toBe("normal");
    expect(body.data.reviewTask.reason_code).toBe(OCR_REVIEW_REQUIRED);
    expect(body.data.reviewTask.status).toBe("pending");
    expect(body.data.qualityRecord.level).toBe("MEDIUM");
    expect(body.data.suggestions.length).toBe(3);
    expect(body.data.suggestions.every((s: { status: string }) => s.status === "open")).toBe(true);
  });

  it("maps a critical scan to an urgent review task", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", { documentId: UNREADABLE }),
      deps,
    );
    const body = await response.json();
    expect(body.data.outcome.priority).toBe("CRITICAL");
    expect(body.data.reviewTask.priority).toBe("urgent");
    expect(body.data.reviewTask.reason_code).toBe(OCR_REVIEW_REQUIRED);
  });

  it("starts an assigned task as in_progress", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", {
        documentId: ROTATED,
        assignee: "officer.1@example.com",
      }),
      deps,
    );
    const body = await response.json();
    expect(body.data.reviewTask.status).toBe("in_progress");
    expect(body.data.reviewTask.assigned_to).toBe("officer.1@example.com");
  });

  it("returns 404 for an unknown document", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", { documentId: "nope" }),
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("rejects invalid JSON", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", "not json"),
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("rejects a missing documentId", async () => {
    const { deps } = buildDeps();
    const response = await postReview(
      postRequest("https://example.com/api/ocr/review", {}),
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/ocr/suggestions", () => {
  it("persists open repair suggestions for a repairable scan", async () => {
    const { deps } = buildDeps();
    const response = await postSuggestions(
      postRequest("https://example.com/api/ocr/suggestions", { documentId: ROTATED }),
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.records.length).toBe(3);
    expect(body.data.records.some((r: { kind: string }) => r.kind === "IMO_CHECKSUM")).toBe(true);
    expect(body.data.records.every((r: { status: string }) => r.status === "open")).toBe(true);
    expect(body.data.priority).toBe("MEDIUM");
  });

  it("persists nothing for a clean scan", async () => {
    const { deps } = buildDeps();
    const response = await postSuggestions(
      postRequest("https://example.com/api/ocr/suggestions", { documentId: PERFECT }),
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.records.length).toBe(0);
    expect(body.data.suggestions.length).toBe(0);
  });

  it("returns 404 for an unknown document", async () => {
    const { deps } = buildDeps();
    const response = await postSuggestions(
      postRequest("https://example.com/api/ocr/suggestions", { documentId: "nope" }),
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("rejects a missing documentId", async () => {
    const { deps } = buildDeps();
    const response = await postSuggestions(
      postRequest("https://example.com/api/ocr/suggestions", {}),
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/ocr/suggestions/[id]", () => {
  it("accepts a suggestion", async () => {
    const { deps } = buildDeps();
    const created = await (
      await postSuggestions(
        postRequest("https://example.com/api/ocr/suggestions", { documentId: ROTATED }),
        deps,
      )
    ).json();

    const suggestionId = created.data.records[0].id;
    const response = await patchSuggestion(
      new Request(`https://example.com/api/ocr/suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      { params: { id: suggestionId } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.suggestion.id).toBe(suggestionId);
    expect(body.data.suggestion.status).toBe("accepted");
  });

  it("rejects an invalid status", async () => {
    const { deps } = buildDeps();
    const created = await (
      await postSuggestions(
        postRequest("https://example.com/api/ocr/suggestions", { documentId: ROTATED }),
        deps,
      )
    ).json();
    const suggestionId = created.data.records[0].id;

    const response = await patchSuggestion(
      new Request(`https://example.com/api/ocr/suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "maybe" }),
      }),
      { params: { id: suggestionId } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown suggestion", async () => {
    const { deps } = buildDeps();
    const response = await patchSuggestion(
      new Request("https://example.com/api/ocr/suggestions/nope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      { params: { id: "nope" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("rejects invalid JSON", async () => {
    const { deps } = buildDeps();
    const response = await patchSuggestion(
      new Request("https://example.com/api/ocr/suggestions/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      { params: { id: "x" } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });
});

run();
