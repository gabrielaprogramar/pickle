import {
  apiSuccess,
  apiCreated,
  apiError,
  parseJsonBody,
  parseQueryNumber,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { IMO_MISMATCH, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import {
  voyageInsertSchema,
  zodIssuesToDetails,
} from "@/app/api/_lib/schemas";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetVoyages(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const { searchParams } = new URL(request.url);
    const pagination = {
      limit: parseQueryNumber(searchParams, "limit"),
      offset: parseQueryNumber(searchParams, "offset"),
    };
    const page = await deps.voyages.findByImo(imo, pagination);
    return apiSuccess(page);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostVoyage(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;

    const body = await parseJsonBody(request);
    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const parsed = voyageInsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid voyage payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    if (parsed.data.vessel.imo !== imo) {
      return apiError(
        IMO_MISMATCH,
        `Path IMO (${imo}) does not match body IMO (${parsed.data.vessel.imo}).`,
        400,
      );
    }

    const voyageRow = await deps.voyages.insertFromDomain(parsed.data);
    return apiCreated(voyageRow);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
