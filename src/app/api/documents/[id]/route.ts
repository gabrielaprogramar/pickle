/**
 * api/documents/[id]/route.ts — GET /api/documents/:id (detail)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns full document details including versions, jobs, and OCR results.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildDocumentService } from "../helpers";

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

    return apiSuccess(status, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "GET_DOCUMENT_FAILED");
  }
}
