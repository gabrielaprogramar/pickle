import { NextRequest } from "next/server";
import { apiSuccess, apiCreated, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getSearchService } from "../_service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "user-001";
    const organizationId = searchParams.get("organization_id") ?? "org-001";
    const service = getSearchService();
    const saved = service.listSaved(userId, organizationId);
    return apiSuccess({ saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError(VALIDATION_ERROR, "Request body is required", 400);
    }
    const name = typeof body.name === "string" ? body.name : "";
    const query = typeof body.query === "string" ? body.query : "";
    const userId = typeof body.user_id === "string" ? body.user_id : "user-001";
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "org-001";

    const service = getSearchService();
    const result = service.saveSearch(name, query, userId, organizationId);
    if (!result.saved) {
      return apiError(VALIDATION_ERROR, result.error ?? "Could not save search", 400);
    }
    return apiCreated({ savedSearch: result.savedSearch });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
