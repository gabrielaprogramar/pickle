import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createComplianceReportRepository } from "@/lib/supabase/repositories/compliance_reports";
import { apiSuccess, apiError, parseQueryNumber, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseQueryNumber(searchParams, "limit") ?? 50;
    const offset = parseQueryNumber(searchParams, "offset") ?? 0;
    const vesselId = searchParams.get("vessel_id");

    const repo = createComplianceReportRepository({ client: getSupabaseClient() });

    let reports;
    if (vesselId) {
      reports = await repo.listByVessel(vesselId);
    } else {
      reports = await repo.list(limit, offset);
    }

    return apiSuccess({ reports });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
