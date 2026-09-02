import {
  apiSuccess,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { vesselUpsertSchema, zodIssuesToDetails } from "@/app/api/_lib/schemas";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleGetVessel(
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }
    return apiSuccess(vessel);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePutVessel(
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

    const parsed = vesselUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid vessel payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const input = {
      imo,
      name: parsed.data.name,
      mmsi: parsed.data.mmsi,
      ship_id: parsed.data.ship_id,
      gross_tonnage: parsed.data.gross_tonnage,
      flag: parsed.data.flag,
      vessel_type: parsed.data.vessel_type,
      vessel_category: parsed.data.vessel_category,
    };

    const vessel = await deps.vessels.upsertByImo(input);
    return apiSuccess(vessel);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
