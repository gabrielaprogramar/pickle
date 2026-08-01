import { apiError, apiSuccess } from "@/app/api/_lib/http";
import {
  DOCUMENT_NOT_FOUND,
  INTERNAL_ERROR,
  VALIDATION_ERROR,
} from "@/app/api/_lib/errors";
import { OcrDocumentNotFoundError } from "@/lib/ocr-assistant";
import {
  buildDefaultOcrApiDeps,
  buildMockOcrApiDeps,
} from "../_lib";
import type { OcrApiDeps } from "../_lib";

/**
 * GET /api/ocr/quality?documentId=ocr-doc-rotated-bdn
 *
 * Returns the deterministic OCR quality snapshot for a scanned document, plus
 * the most recently persisted quality record when one exists. The engine
 * resolves the document from the OCR mock registry; unknown ids are 404.
 */
export async function GET(
  req: Request,
  deps: OcrApiDeps = buildDefaultOcrApiDeps(),
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    if (!documentId) {
      return apiError(VALIDATION_ERROR, "documentId query parameter is required", 400);
    }
    const mock = url.searchParams.get("mock") === "true";
    const effective = mock ? buildMockOcrApiDeps() : deps;

    const answer = effective.service.quality({ query: "", context: { documentId } });
    const record = await effective.qualityRepo.findLatestByDocumentId(documentId);

    return apiSuccess({
      documentId,
      computed: {
        detectedFamily: answer.classification?.family ?? null,
        level: answer.quality?.level ?? null,
        overallQualityScore: answer.quality?.overallQualityScore ?? null,
        pageQuality: answer.quality?.pageQuality ?? null,
        textCoverage: answer.quality?.textCoverage ?? null,
        fieldCoverage: answer.quality?.fieldCoverage ?? null,
        confidenceScore: answer.quality?.confidenceScore ?? null,
        issues: answer.quality?.issues ?? [],
        missingMandatoryFields: answer.quality?.missingMandatoryFields ?? [],
        priority: answer.priority?.priority ?? null,
        priorityReasons: answer.priority?.reasons ?? [],
      },
      record,
      mock,
    });
  } catch (err) {
    if (err instanceof OcrDocumentNotFoundError) {
      return apiError(DOCUMENT_NOT_FOUND, err.message, 404);
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
