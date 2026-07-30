import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createComplianceReportRepository } from "@/lib/supabase/repositories/compliance_reports";
import { apiSuccess, apiError, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = createComplianceReportRepository({ client: getSupabaseClient() });
    const report = await repo.findById(id);

    if (!report) {
      return apiError("REPORT_NOT_FOUND", "Report not found", 404);
    }

    if (!report.content) {
      return apiError("REPORT_NOT_FOUND", "Report content is empty", 404);
    }

    const json = JSON.stringify(report.content, null, 2);
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${report.title.replace(/\s+/g, "_")}.json"`,
      },
    });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
