import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/app/api/_lib/http";
import { getSearchService } from "../_service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id") ?? "org-001";

    const service = getSearchService();
    const audit = service.getAuditLog().filter((a) => a.organizationId === organizationId);
    return apiSuccess({ audit });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
