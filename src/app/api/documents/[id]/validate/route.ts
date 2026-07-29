import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/helpers";
import { buildValidationService } from "../../helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildValidationService();
    const result = await service.validate(id);

    return apiSuccess(
      {
        report: result.report,
        persisted: result.persisted,
        latencyMs: result.latencyMs,
      },
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("Document not found") || message.includes("Not found")) {
      return apiError(`Document not found: ${id}`, 404, "DOCUMENT_NOT_FOUND");
    }
    if (message.includes("No completed AI extraction")) {
      return apiError(message, 409, "NO_EXTRACTION");
    }
    return apiError(message, 500, "VALIDATION_FAILED");
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const service = buildValidationService();
    const latest = await service.getLatestValidation(id);

    if (!latest) {
      return apiSuccess(null, 200);
    }

    return apiSuccess(latest, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return apiError(message, 500, "GET_VALIDATION_FAILED");
  }
}
