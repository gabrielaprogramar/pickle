import {
  apiSuccess,
  apiError,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetLatestVoyage(
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const voyage = await deps.voyages.findLatestByImo(imo);
    if (!voyage) {
      return apiError(NOT_FOUND, `No voyages found for IMO ${imo}.`, 404);
    }
    return apiSuccess(voyage);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
