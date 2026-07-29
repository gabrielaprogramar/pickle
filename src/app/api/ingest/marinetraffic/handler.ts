import {
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { ingestSchema, zodIssuesToDetails } from "@/app/api/_lib/schemas";
import type { ApiDependencies } from "@/app/api/_lib/deps";

export async function handleIngestMarineTraffic(
  request: Request,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid ingest payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const voyage = await deps.marineTraffic.getVoyageByIMO(parsed.data.imo);
    const voyageRow = await deps.voyages.insertFromDomain(voyage);

    return apiCreated(voyageRow);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
