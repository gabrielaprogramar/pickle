/**
 * api/documents/route.ts — GET /api/documents (list) + POST /api/documents (upload)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles listing and uploading documents via the REST API.
 *
 * GET:
 *   Query params: ?vesselId=...&documentType=...&limit=...&offset=...
 *   Returns paginated document list.
 *
 * POST:
 *   Multipart form data: file, title, documentType, vesselId (optional)
 *   Uploads file, creates document, triggers OCR pipeline.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildDocumentService, buildDocumentUploadService } from "./helpers";
import type { DocumentRow } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId") ?? undefined;
    const documentType = searchParams.get("documentType") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
    const offset = Number(searchParams.get("offset") ?? "0");

    const service = buildDocumentService();

    let docs: DocumentRow[];
    if (vesselId) {
      docs = await service.listDocuments({ vesselId });
    } else if (documentType) {
      docs = await service.listDocuments({ documentType });
    } else {
      docs = await service.listDocuments();
    }

    // Apply pagination.
    const paginated = docs.slice(offset, offset + limit);

    return apiSuccess(paginated, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "LIST_DOCUMENTS_FAILED");
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title") as string | null;
    const documentType = formData.get("documentType") as string | null;
    const vesselId = (formData.get("vesselId") as string | null) ?? undefined;

    if (!file || !(file instanceof File)) {
      return apiError("File is required", 400, "MISSING_FILE");
    }
    if (!title || title.trim().length === 0) {
      return apiError("Title is required", 400, "MISSING_TITLE");
    }
    if (!documentType) {
      return apiError("Document type is required", 400, "MISSING_DOCUMENT_TYPE");
    }

    // Validate document type.
    const validTypes = [
      "imo_dcs", "eu_mrv", "certificate", "report",
      "correspondence", "logbook", "other",
    ];
    if (!validTypes.includes(documentType)) {
      return apiError(`Invalid document type: ${documentType}`, 400, "INVALID_DOCUMENT_TYPE");
    }

    // Validate file size (max 50MB).
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return apiError("File too large (max 50MB)", 413, "FILE_TOO_LARGE");
    }

    // Read file buffer.
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const uploadService = buildDocumentUploadService();
    const result = await uploadService.upload({
      fileBuffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      documentType: documentType as DocumentRow["document_type"],
      title: title.trim(),
      vesselId,
    });

    return apiSuccess(result, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "UPLOAD_FAILED");
  }
}
