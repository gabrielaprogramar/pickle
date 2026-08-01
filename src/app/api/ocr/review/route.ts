import { apiCreated, apiError, parseJsonBody } from "@/app/api/_lib/http";
import {
  DOCUMENT_NOT_FOUND,
  INTERNAL_ERROR,
  INVALID_JSON,
  VALIDATION_ERROR,
} from "@/app/api/_lib/errors";
import {
  OcrDocumentNotFoundError,
  OCR_REVIEW_REQUIRED,
} from "@/lib/ocr-assistant";
import type {
  OcrQualityRecord,
  OcrReviewSuggestionRecord,
} from "@/lib/ocr-assistant";
import type { ReviewTaskRow } from "@/lib/supabase/types";
import { z } from "zod";
import {
  buildDefaultOcrApiDeps,
  buildMockOcrApiDeps,
  isOcrQualityRecord,
  isOcrSuggestionRecord,
  toQualityScoreInsert,
  toReviewTaskPriority,
  toSuggestionInserts,
} from "../_lib";
import type { OcrApiDeps } from "../_lib";

const bodySchema = z.object({
  documentId: z.string().min(1),
  ocrResultId: z.string().min(1).optional(),
  assignee: z.string().min(1).optional(),
});

/**
 * POST /api/ocr/review
 *
 * Body: { documentId, ocrResultId?, assignee? }
 *
 * Runs the full OCR review pipeline for a scanned document: derive quality,
 * generate repair suggestions, persist both, and — when the deterministic
 * priority is anything above LOW — create a review task carrying the
 * OCR_REVIEW_REQUIRED reason code so a human reviews the scan.
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

    const answer = effective.service.review({ query: "", context: { documentId: body.documentId } });
    const records = answer.records ?? [];
    const qualityRecord = records.find(isOcrQualityRecord) as OcrQualityRecord | undefined;
    const suggestionRecords = records.filter(
      (r): r is OcrReviewSuggestionRecord => isOcrSuggestionRecord(r),
    );

    const priority = answer.priority?.priority ?? "LOW";
    const reviewRequired = priority !== "LOW";

    const persistedQuality = qualityRecord
      ? await effective.qualityRepo.insert(toQualityScoreInsert(qualityRecord))
      : null;

    const suggestionInserts = toSuggestionInserts(suggestionRecords).map((ins) =>
      body.ocrResultId ? { ...ins, ocr_result_id: body.ocrResultId } : ins,
    );
    const persistedSuggestions = await effective.suggestionRepo.insertMany(suggestionInserts);

    let reviewTask: ReviewTaskRow | null = null;
    if (reviewRequired) {
      reviewTask = await effective.reviewTaskRepo.insert({
        document_id: body.documentId,
        assigned_to: body.assignee ?? null,
        status: body.assignee ? "in_progress" : "pending",
        priority: toReviewTaskPriority(priority),
        reason_code: OCR_REVIEW_REQUIRED,
      });
    }

    return apiCreated({
      documentId: body.documentId,
      outcome: {
        priority,
        reviewRequired,
        level: qualityRecord?.level ?? null,
        overallQualityScore: qualityRecord?.overallQualityScore ?? null,
        reasons: answer.priority?.reasons ?? [],
      },
      qualityRecord: persistedQuality,
      suggestions: persistedSuggestions,
      reviewTask,
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
