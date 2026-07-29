import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildReviewService } from "@/app/api/documents/helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildReviewService();
    const detail = await service.getReviewTask(id);

    if (!detail) {
      return apiError(`Review task not found: ${id}`, 404, "TASK_NOT_FOUND");
    }

    return apiSuccess(detail, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "GET_REVIEW_TASK_FAILED");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const body = await request.json();
    const { action, reviewer, fieldName, newValue, comment, reason, assignee } = body;

    if (!reviewer && action !== "assign") {
      return apiError("Missing required field: reviewer", 400, "MISSING_REVIEWER");
    }

    const service = buildReviewService();

    switch (action) {
      case "approve": {
        if (!fieldName) {
          const result = await service.submitDecision(id, "approved", reviewer, comment);
          return apiSuccess(result, 200);
        }
        await service.approveField(id, fieldName, reviewer, comment);
        return apiSuccess({ approved: true, fieldName }, 200);
      }

      case "reject": {
        if (!fieldName) {
          const result = await service.submitDecision(id, "rejected", reviewer, comment);
          return apiSuccess(result, 200);
        }
        await service.rejectField(id, fieldName, reviewer, reason ?? comment ?? "Rejected");
        return apiSuccess({ rejected: true, fieldName }, 200);
      }

      case "needs_changes": {
        const result = await service.submitDecision(id, "needs_changes", reviewer, comment);
        return apiSuccess(result, 200);
      }

      case "escalate": {
        const result = await service.submitDecision(id, "escalated", reviewer, comment);
        return apiSuccess(result, 200);
      }

      case "edit_field": {
        if (!fieldName) {
          return apiError("Missing required field: fieldName", 400, "MISSING_FIELD");
        }
        if (newValue === undefined) {
          return apiError("Missing required field: newValue", 400, "MISSING_VALUE");
        }
        await service.editField(id, fieldName, newValue, reviewer, comment);
        return apiSuccess({ edited: true, fieldName, newValue }, 200);
      }

      case "field_uncertain": {
        if (!fieldName) {
          return apiError("Missing required field: fieldName", 400, "MISSING_FIELD");
        }
        await service.markFieldUncertain(id, fieldName, reviewer, comment);
        return apiSuccess({ uncertain: true, fieldName }, 200);
      }

      case "comment": {
        if (!comment) {
          return apiError("Missing required field: comment", 400, "MISSING_COMMENT");
        }
        await service.addComment(id, reviewer, comment);
        return apiSuccess({ comment: true }, 200);
      }

      case "assign": {
        if (!assignee) {
          return apiError("Missing required field: assignee", 400, "MISSING_ASSIGNEE");
        }
        const result = await service.assignReviewer(id, assignee);
        return apiSuccess(result, 200);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400, "UNKNOWN_ACTION");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("Invalid status transition")) {
      return apiError(message, 409, "INVALID_TRANSITION");
    }
    if (message.includes("not found")) {
      return apiError(message, 404, "NOT_FOUND");
    }
    return apiError(message, 500, "REVIEW_ACTION_FAILED");
  }
}
