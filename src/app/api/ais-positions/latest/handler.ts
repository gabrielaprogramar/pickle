import {
  apiSuccess,
  apiError,
  requireQueryParam,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { VALIDATION_ERROR, NOT_FOUND } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetLatestAisPosition(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const vesselId = requireQueryParam(searchParams, "vesselId");
    if (!vesselId) {
      return apiError(
        VALIDATION_ERROR,
        "Query parameter 'vesselId' is required.",
        400,
      );
    }

    const position = await deps.aisPositions.findLatestByVesselId(vesselId);
    if (!position) {
      return apiError(
        NOT_FOUND,
        `No AIS positions found for vessel ${vesselId}.`,
        404,
      );
    }
    return apiSuccess(position);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
