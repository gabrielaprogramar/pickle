import { createDefaultDeps } from "@/app/api/_lib/deps";
import { apiSuccess, apiError, parseQueryNumber, mapErrorResponse } from "@/app/api/_lib/http";
import { FuelDeliveryInsertSchema } from "@/lib/supabase/schemas";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";
import { INVALID_JSON, VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import type { FuelDeliveryRow } from "@/lib/supabase/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const deps = createDefaultDeps();
    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const documentId = searchParams.get("documentId");
    const voyageId = searchParams.get("voyageId");

    let deliveries: FuelDeliveryRow[];
    if (vesselId) {
      deliveries = await deps.fuelDeliveries.findByVesselId(vesselId);
    } else if (documentId) {
      deliveries = await deps.fuelDeliveries.findByDocumentId(documentId);
    } else if (voyageId) {
      deliveries = await deps.fuelDeliveries.findByVoyageId(voyageId);
    } else {
      deliveries = await deps.fuelDeliveries.listAll();
    }

    const limit = parseQueryNumber(searchParams, "limit") ?? 50;
    const offset = parseQueryNumber(searchParams, "offset") ?? 0;
    const paginated = deliveries.slice(offset, offset + limit);

    return apiSuccess(paginated, 200);
  } catch (e) {
    return mapErrorResponse(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const deps = createDefaultDeps();
    const body = await request.json().catch(() => null);

    if (!body) {
      return apiError(INVALID_JSON, "Invalid JSON body", 400);
    }

    const parsed = FuelDeliveryInsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Validation error",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const delivery = await deps.fuelDeliveries.insert(parsed.data);
    return apiSuccess(delivery, 201);
  } catch (e) {
    return mapErrorResponse(e);
  }
}
