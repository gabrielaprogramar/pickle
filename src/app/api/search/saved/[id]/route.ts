import { NextRequest } from "next/server";
import { apiSuccess, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getSearchService } from "../../_service";

interface RouteContext {
  readonly params: { readonly id: string };
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError(VALIDATION_ERROR, "Request body is required", 400);
    }
    const newName = typeof body.name === "string" ? body.name.trim() : "";
    if (!newName) {
      return apiError(VALIDATION_ERROR, "name is required", 400);
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "user-001";
    const organizationId = searchParams.get("organization_id") ?? "org-001";

    const service = getSearchService();
    const updated = service.renameSavedSearch(ctx.params.id, newName, userId, organizationId);
    if (!updated) {
      return apiError("NOT_FOUND", "Saved search not found", 404);
    }
    return apiSuccess({ savedSearch: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "user-001";
    const organizationId = searchParams.get("organization_id") ?? "org-001";

    const service = getSearchService();
    const removed = service.deleteSavedSearch(ctx.params.id, userId, organizationId);
    if (!removed) {
      return apiError("NOT_FOUND", "Saved search not found", 404);
    }
    return apiSuccess({ removed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
