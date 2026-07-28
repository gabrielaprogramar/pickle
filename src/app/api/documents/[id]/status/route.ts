/**
 * api/documents/[id]/status/route.ts — GET /api/documents/:id/status
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lightweight status check for polling. Returns only the document status
 * and latest processing job — not the full detail payload.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildDocumentService } from "../../helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const service = buildDocumentService();
    const status = await service.getDocumentStatus(id);

    if (!status) {
      return apiError(`Document not found: ${id}`, 404, "DOCUMENT_NOT_FOUND");
    }

    return apiSuccess(
      {
        documentId: status.document.id,
        status: status.document.status,
        latestJob: status.latestJob
          ? {
              id: status.latestJob.id,
              jobType: status.latestJob.job_type,
              status: status.latestJob.status,
              startedAt: status.latestJob.started_at,
              completedAt: status.latestJob.completed_at,
              errorMessage: status.latestJob.error_message,
            }
          : null,
        ocrResultCount: status.ocrResults.length,
      },
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "GET_STATUS_FAILED");
  }
}
