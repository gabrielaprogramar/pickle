import {
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import {
  aisPositionSchema,
  zodIssuesToDetails,
} from "@/app/api/_lib/schemas";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handlePostAisPosition(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const parsed = aisPositionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid AIS position payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const row = await deps.aisPositions.insert(parsed.data);
    return apiCreated(row);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
