import { apiCreated, apiError, parseJsonBody } from "@/app/api/_lib/http";
import {
  DOCUMENT_NOT_FOUND,
  INTERNAL_ERROR,
  INVALID_JSON,
  VALIDATION_ERROR,
} from "@/app/api/_lib/errors";
import { OcrDocumentNotFoundError } from "@/lib/ocr-assistant";
import type { OcrReviewSuggestionRecord } from "@/lib/ocr-assistant";
import { z } from "zod";
import {
  buildDefaultOcrApiDeps,
  buildMockOcrApiDeps,
  isOcrSuggestionRecord,
  toSuggestionInserts,
} from "../_lib";
import type { OcrApiDeps } from "../_lib";

const bodySchema = z.object({
  documentId: z.string().min(1),
  ocrResultId: z.string().min(1).optional(),
});

/**
 * POST /api/ocr/suggestions
 *
 * Body: { documentId, ocrResultId? }
 *
 * Runs the deterministic correction engines for a scanned document and
 * persists the resulting repair suggestions as open review suggestions.
 */
export async function POST(
  req: Request,
  deps: OcrApiDeps = buildDefaultOcrApiDeps(),
): Promise<Response> {
  try {
    const raw = await parseJsonBody<unknown>(req);
    if (raw === null) {
      return apiError(INVALID_JSON, "Request body must be valid JSON", 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(VALIDATION_ERROR, `Invalid body: ${parsed.error.message}`, 400);
    }
    const body = parsed.data;

    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";
    const effective = mock ? buildMockOcrApiDeps() : deps;

    const answer = effective.service.suggestions({ query: "", context: { documentId: body.documentId } });
    const records = (answer.records ?? []).filter(
      (r): r is OcrReviewSuggestionRecord => isOcrSuggestionRecord(r),
    );
    const inserts = toSuggestionInserts(records).map((ins) =>
      body.ocrResultId ? { ...ins, ocr_result_id: body.ocrResultId } : ins,
    );
    const persisted = await effective.suggestionRepo.insertMany(inserts);

    return apiCreated({
      documentId: body.documentId,
      priority: answer.priority?.priority ?? null,
      suggestions: answer.suggestions ?? [],
      records: persisted,
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
