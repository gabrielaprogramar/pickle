import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildReviewService } from "../../helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const body = await request.json();
    const { assignee, priority } = body;

    const service = buildReviewService();
    const result = await service.createReviewTask(id, {
      assignee,
      priority,
    });

    return apiSuccess(result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("not found")) {
      return apiError(message, 404, "DOCUMENT_NOT_FOUND");
    }
    return apiError(message, 500, "CREATE_REVIEW_TASK_FAILED");
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildReviewService();
    const tasks = await service.getDocumentReviewTasks(id);

    return apiSuccess(tasks, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "LIST_REVIEW_TASKS_FAILED");
  }
}
