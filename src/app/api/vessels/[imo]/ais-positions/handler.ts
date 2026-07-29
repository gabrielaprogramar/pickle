import {
  apiSuccess,
  parseQueryNumber,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetAisPositions(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const { searchParams } = new URL(request.url);
    const pagination = {
      limit: parseQueryNumber(searchParams, "limit"),
      offset: parseQueryNumber(searchParams, "offset"),
    };
    const page = await deps.aisPositions.findByVesselImo(imo, pagination);
    return apiSuccess(page);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
