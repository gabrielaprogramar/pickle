import { apiError, apiSuccess, parseQueryNumber } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { buildDefaultSoxApiDeps } from "./_lib";
import type { SoxApiDeps } from "./_lib";

/**
 * GET /api/vessels/[imo]/sox-watch
 *
 * Returns the current Med SOx ECA compliance watch state and the most recent
 * compliance events for a vessel. 404 when the vessel is unknown.
 */
export async function GET(
  req: Request,
  { params }: { params: { imo: string } },
  deps: SoxApiDeps = buildDefaultSoxApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;
    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    const limit = parseQueryNumber(new URL(req.url).searchParams, "limit") ?? 20;
    const watch = await deps.service.getWatch(imo);
    const events = await deps.service.getEvents(imo, limit);

    return apiSuccess({
      vesselId: vessel.id,
      imo,
      watch,
      events,
      eventCount: events.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
