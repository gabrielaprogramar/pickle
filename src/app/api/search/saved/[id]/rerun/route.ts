import { NextRequest } from "next/server";
import { apiError } from "@/app/api/_lib/http";
import { getSearchService } from "../../../_service";

interface RouteContext {
  readonly params: { readonly id: string };
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "user-001";
    const organizationId = searchParams.get("organization_id") ?? "org-001";

    const service = getSearchService();
    const response = await service.rerunSavedSearch(ctx.params.id, userId, organizationId);
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
