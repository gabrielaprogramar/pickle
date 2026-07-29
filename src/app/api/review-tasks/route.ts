import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildReviewService } from "@/app/api/documents/helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const assignee = searchParams.get("assignee") ?? undefined;
    const vesselId = searchParams.get("vesselId") ?? undefined;
    const documentType = searchParams.get("documentType") ?? undefined;

    const service = buildReviewService();
    const tasks = await service.listReviewTasks({
      status,
      assignee,
      vesselId,
      documentType,
    });

    return apiSuccess(tasks, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "LIST_REVIEW_TASKS_FAILED");
  }
}
