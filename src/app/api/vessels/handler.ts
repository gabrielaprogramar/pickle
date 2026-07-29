import { apiSuccess, parseQueryNumber, mapErrorResponse } from "@/app/api/_lib/http";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetVessels(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = {
      limit: parseQueryNumber(searchParams, "limit"),
      offset: parseQueryNumber(searchParams, "offset"),
    };
    const page = await deps.vessels.findAll(pagination);
    return apiSuccess(page);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
