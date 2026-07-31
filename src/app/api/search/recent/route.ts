import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/api/_lib/http";
import { getSearchService } from "../_service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id") ?? "user-001";
    const organizationId = searchParams.get("organization_id") ?? "org-001";
    const limit = Number(searchParams.get("limit")) || 10;

    const service = getSearchService();
    const recent = service.listRecent(userId, organizationId).slice(0, limit);
    return apiSuccess({ recent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
