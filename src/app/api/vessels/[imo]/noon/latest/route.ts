import { apiError, apiSuccess } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { buildDefaultNoonApiDeps } from "../_lib";
import type { NoonApiDeps } from "../_lib";

/**
 * GET /api/vessels/[imo]/noon/latest
 *
 * Returns the most recent noon report for a vessel. 404 when the vessel is
 * unknown; 200 with `report: null` when the vessel has no reports yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: { imo: string } },
  deps: NoonApiDeps = buildDefaultNoonApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;
    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    const latest = await deps.service.latest(imo);

    return apiSuccess({
      vesselId: vessel.id,
      imo,
      latest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
