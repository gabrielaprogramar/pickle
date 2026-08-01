import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import {
  INTERNAL_ERROR,
  INVALID_JSON,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/app/api/_lib/errors";
import { z } from "zod";
import { buildDefaultOcrApiDeps, buildMockOcrApiDeps } from "../../_lib";
import type { OcrApiDeps } from "../../_lib";

const bodySchema = z.object({
  status: z.enum(["accepted", "rejected", "resolved"]),
});

/**
 * PATCH /api/ocr/suggestions/[id]
 *
 * Body: { status: "accepted" | "rejected" | "resolved" }
 *
 * Transitions a persisted OCR repair suggestion as the human reviewer decides.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
  deps: OcrApiDeps = buildDefaultOcrApiDeps(),
): Promise<Response> {
  try {
    const { id } = params;

    const raw = await parseJsonBody<unknown>(req);
    if (raw === null) {
      return apiError(INVALID_JSON, "Request body must be valid JSON", 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(VALIDATION_ERROR, `Invalid body: ${parsed.error.message}`, 400);
    }

    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";
    const effective = mock ? buildMockOcrApiDeps() : deps;

    const existing = await effective.suggestionRepo.findById(id);
    if (!existing) {
      return apiError(NOT_FOUND, `Suggestion not found: ${id}`, 404);
    }

    const updated = await effective.suggestionRepo.updateStatus(id, parsed.data.status);
    return apiSuccess({ suggestion: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
