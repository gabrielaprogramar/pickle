/**
 * api/documents/[id]/extract/route.ts — POST /api/documents/:id/extract
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Triggers AI extraction on a document's OCR results. Returns the structured
 * extraction result.
 *
 * POST:
 *   Body: { ocrResultId?: string } (optional, defaults to latest OCR result)
 *   Returns the extraction result with fields, summary, confidence, warnings.
 *
 * GET:
 *   Returns the latest AI extraction for the document.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildAiExtractionService } from "../../helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    let ocrResultId: string | undefined;
    try {
      const body = await request.json();
      ocrResultId = body?.ocrResultId;
    } catch {
      // No body or invalid JSON — use latest OCR result.
    }

    const service = buildAiExtractionService();
    const result = await service.extract(id, ocrResultId);

    return apiSuccess(result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("not found") || message.includes("Not found")) {
      return apiError(`Document not found: ${id}`, 404, "DOCUMENT_NOT_FOUND");
    }
    if (message.includes("No OCR result")) {
      return apiError(message, 409, "NO_OCR_RESULT");
    }
    return apiError(message, 500, "EXTRACTION_FAILED");
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildAiExtractionService();
    const extractions = await service.listExtractions(id);

    return apiSuccess(extractions, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "LIST_EXTRACTIONS_FAILED");
  }
}
