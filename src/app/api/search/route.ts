import { NextRequest } from "next/server";
import { apiSuccess, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getSearchService } from "./_service";

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError(VALIDATION_ERROR, "Request body is required", 400);
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "org-001";
    const userId = typeof body.user_id === "string" ? body.user_id : "user-001";
    const vesselId = typeof body.vessel_id === "string" ? body.vessel_id : undefined;
    const page = typeof body.page === "number" ? body.page : undefined;
    const pageSize = typeof body.page_size === "number" ? body.page_size : undefined;

    if (!query) {
      return apiError(VALIDATION_ERROR, "query is required", 400);
    }

    const service = getSearchService();
    const response = await service.search({
      query,
      organizationId,
      userId,
      vesselId,
      page,
      pageSize,
    });

    return apiSuccess(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
