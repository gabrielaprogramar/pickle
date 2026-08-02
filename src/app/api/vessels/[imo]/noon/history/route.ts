import { apiError, apiSuccess, parseQueryNumber } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { buildDefaultNoonApiDeps } from "../_lib";
import type { NoonApiDeps } from "../_lib";

/**
 * GET /api/vessels/[imo]/noon/history
 *
 * Returns the noon report history (ordered report_date descending) for a
 * vessel. 404 when the vessel is unknown.
 */
export async function GET(
  req: Request,
  { params }: { params: { imo: string } },
  deps: NoonApiDeps = buildDefaultNoonApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;
    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    const limit = parseQueryNumber(new URL(req.url).searchParams, "limit") ?? 50;
    const history = await deps.service.history(imo, limit);

    return apiSuccess({
      vesselId: vessel.id,
      imo,
      history,
      count: history.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
