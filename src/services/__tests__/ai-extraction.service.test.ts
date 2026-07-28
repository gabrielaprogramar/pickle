/**
 * ai-extraction.service.test.ts — unit tests for the AI extraction service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the AI extraction service end-to-end using in-memory fakes:
 *   1. extract — completes full extraction pipeline
 *   2. extract — handles missing OCR result gracefully
 *   3. extract — handles missing document gracefully
 *   4. extract — records failed extraction when AI provider throws
 *   5. listExtractions — returns all extractions for a document
 *   6. getLatestExtraction — returns the most recent completed extraction
 *
 * Run via: npx tsx src/services/__tests__/ai-extraction.service.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createMockAiProvider } from "@/lib/ai/mock-provider";
import { createDocumentRepository } from "@/lib/supabase/repositories/documents";
import { createOcrResultRepository } from "@/lib/supabase/repositories/ocr_results";
import { createAiExtractionRepository } from "@/lib/supabase/repositories/ai_extractions";
import { createProcessingLogRepository } from "@/lib/supabase/repositories/processing_logs";
import { createAiExtractionService } from "../ai-extraction.service";
import type { AiProvider, AiExtractionResult } from "@/lib/ai/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DOC_ID = "doc-uuid-001";
const OCR_ID = "ocr-uuid-001";

function buildService(aiOverride?: AiProvider) {
  const fake = createFakeSupabaseClient({
    tables: {
      documents: [
        {
          id: DOC_ID,
          vessel_id: "vessel-001",
          document_type: "imo_dcs",
          status: "ocr_complete",
          title: "BDN June 2026",
          filename: "bdn.pdf",
          mime_type: "application/pdf",
          file_size: 1024,
          storage_path: "documents/bdn.pdf",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      ocr_results: [
        {
          id: OCR_ID,
          document_id: DOC_ID,
          raw_text: "Bunker Delivery Note text...",
          extracted_data: { imoNumber: "9876543" },
          confidence: 0.95,
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      ai_extractions: [],
      processing_logs: [],
    },
  });

  const aiProvider = aiOverride ?? createMockAiProvider();

  return {
    service: createAiExtractionService({
      aiProvider,
      extractionRepo: createAiExtractionRepository({ client: fake }),
      ocrResultRepo: createOcrResultRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
      logRepo: createProcessingLogRepository({ client: fake }),
    }),
    fake,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AiExtractionService — extract", () => {
  it("completes full extraction pipeline for a BDN document", async () => {
    const { service } = buildService();

    const result = await service.extract(DOC_ID);

    expect(result.success).toBe(true);
    expect(result.result.confidence).toBeGreaterThan(0);
    expect(result.result.fields).toBeTruthy();
    expect(Object.keys(result.result.fields).length).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThan(-1);
  });

  it("stores the extraction record in the database", async () => {
    const { service } = buildService();

    const result = await service.extract(DOC_ID);
    const extractions = await service.listExtractions(DOC_ID);

    expect(extractions.length).toBeGreaterThan(0);
    expect(extractions[0]!.status).toBe("completed");
    expect(extractions[0]!.document_id).toBe(DOC_ID);
  });

  it("uses specific OCR result when ocrResultId is provided", async () => {
    const { service } = buildService();

    const result = await service.extract(DOC_ID, OCR_ID);

    expect(result.success).toBe(true);
  });

  it("handles missing document gracefully", async () => {
    const { service } = buildService();

    await expect(async () =>
      service.extract("nonexistent-doc-id"),
    ).toThrow("Document not found");
  });

  it("handles missing OCR result gracefully", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        documents: [
          {
            id: DOC_ID,
            vessel_id: null,
            document_type: "imo_dcs",
            status: "uploaded",
            title: "BDN",
            filename: "bdn.pdf",
            mime_type: "application/pdf",
            file_size: null,
            storage_path: "documents/bdn.pdf",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        ocr_results: [],
        ai_extractions: [],
        processing_logs: [],
      },
    });

    const service = createAiExtractionService({
      aiProvider: createMockAiProvider(),
      extractionRepo: createAiExtractionRepository({ client: fake }),
      ocrResultRepo: createOcrResultRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
      logRepo: createProcessingLogRepository({ client: fake }),
    });

    await expect(async () =>
      service.extract(DOC_ID),
    ).toThrow("No OCR result found");
  });

  it("records failed extraction when AI provider throws", async () => {
    const failingProvider: AiProvider = {
      async extract(): Promise<AiExtractionResult> {
        throw new Error("OpenAI API rate limit exceeded");
      },
    };

    const { service } = buildService(failingProvider);

    const result = await service.extract(DOC_ID);

    expect(result.success).toBe(false);
    expect(result.result.warnings.length).toBeGreaterThan(0);
    expect(result.result.confidence).toBe(0);
  });

  it("persists failed extraction record with error message", async () => {
    const failingProvider: AiProvider = {
      async extract(): Promise<AiExtractionResult> {
        throw new Error("Model overloaded");
      },
    };

    const { service } = buildService(failingProvider);
    await service.extract(DOC_ID);

    const extractions = await service.listExtractions(DOC_ID);
    expect(extractions.length).toBeGreaterThan(0);
    const failed = extractions.find((e) => e.status === "failed");
    expect(failed).toBeTruthy();
    expect(failed!.error_message).toContainString("Model overloaded");
  });
});

describe("AiExtractionService — listExtractions", () => {
  it("returns all extractions for a document", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        documents: [
          {
            id: "doc-list-test",
            vessel_id: null,
            document_type: "imo_dcs",
            status: "ocr_complete",
            title: "BDN List Test",
            filename: "bdn.pdf",
            mime_type: "application/pdf",
            file_size: null,
            storage_path: "documents/bdn.pdf",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        ocr_results: [
          {
            id: "ocr-list-test",
            document_id: "doc-list-test",
            raw_text: "BDN text",
            extracted_data: null,
            confidence: 0.95,
            created_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        ai_extractions: [],
        processing_logs: [],
      },
    });

    const service = createAiExtractionService({
      aiProvider: createMockAiProvider(),
      extractionRepo: createAiExtractionRepository({ client: fake }),
      ocrResultRepo: createOcrResultRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
      logRepo: createProcessingLogRepository({ client: fake }),
    });

    await service.extract("doc-list-test");
    await service.extract("doc-list-test");

    const extractions = await service.listExtractions("doc-list-test");

    expect(extractions.length).toBe(2);
  });

  it("returns empty array for document with no extractions", async () => {
    const { service } = buildService();

    const extractions = await service.listExtractions(DOC_ID);

    expect(extractions.length).toBe(0);
  });
});

describe("AiExtractionService — getLatestExtraction", () => {
  it("returns the latest completed extraction", async () => {
    const { service } = buildService();

    await service.extract(DOC_ID);
    const latest = await service.getLatestExtraction(DOC_ID);

    expect(latest).toBeTruthy();
    expect(latest!.status).toBe("completed");
  });

  it("returns null when no extractions exist", async () => {
    const { service } = buildService();

    const latest = await service.getLatestExtraction(DOC_ID);

    expect(latest).toBeNull();
  });
});

run();
