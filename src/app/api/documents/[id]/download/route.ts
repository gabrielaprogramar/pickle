/**
 * api/documents/[id]/download/route.ts — GET /api/documents/:id/download
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns a signed URL for downloading the document's latest version.
 * The client can then redirect to the URL or fetch it directly.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildDocumentService } from "../../helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildDocumentService();
    const urlResult = await service.getDownloadUrl(id);

    return apiSuccess(urlResult, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("not found") || message.includes("Not found")) {
      return apiError(`Document not found: ${id}`, 404, "DOCUMENT_NOT_FOUND");
    }
    return apiError(message, 500, "DOWNLOAD_FAILED");
  }
}
