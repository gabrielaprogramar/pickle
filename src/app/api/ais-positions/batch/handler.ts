import {
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import {
  aisPositionBatchSchema,
  zodIssuesToDetails,
} from "@/app/api/_lib/schemas";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handlePostAisPositionBatch(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const parsed = aisPositionBatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid batch payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const rows = await deps.aisPositions.insertBatch(parsed.data.positions);
    return apiCreated(rows);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
