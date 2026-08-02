import {
  apiCreated,
  apiError,
  apiSuccess,
  parseJsonBody,
  parseQueryNumber,
} from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VALIDATION_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { parseNoonReportExtraction } from "@/lib/noon-report";
import type { NoonReportExtractionInput } from "@/lib/noon-report";
import { buildDefaultNoonApiDeps } from "./_lib";
import type { NoonApiDeps } from "./_lib";

interface CreateBody {
  readonly report?: NoonReportExtractionInput;
  readonly notifyReportReceived?: boolean;
}

/**
 * GET /api/vessels/[imo]/noon
 *
 * Returns the most recent noon report, recent history, and the total history
 * count for a vessel. 404 when the vessel is unknown.
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

    const limit = parseQueryNumber(new URL(req.url).searchParams, "limit") ?? 20;
    const latest = await deps.service.latest(imo);
    const history = await deps.service.history(imo, limit);

    return apiSuccess({
      vesselId: vessel.id,
      imo,
      latest,
      history,
      historyCount: history.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}

/**
 * POST /api/vessels/[imo]/noon
 *
 * Ingests a noon report from an AI extraction payload, parses it into the
 * domain shape, and persists the raw report. Returns the created row.
 * Evaluations are a separate step (POST .../evaluate).
 */
export async function POST(
  req: Request,
  { params }: { params: { imo: string } },
  deps: NoonApiDeps = buildDefaultNoonApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;

    const raw = await parseJsonBody<Partial<CreateBody>>(req);
    if (raw === null || !raw.report) {
      return apiError(
        VALIDATION_ERROR,
        "Request body must include a 'report' extraction object",
        400,
      );
    }

    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    const parsed = parseNoonReportExtraction(raw.report);
    if (parsed.report.imo !== imo && parsed.report.imo !== "") {
      return apiError(
        VALIDATION_ERROR,
        `Report IMO ${parsed.report.imo} does not match vessel IMO ${imo}`,
        400,
      );
    }

    const row = await deps.service.create(imo, parsed.report, {
      notifyReportReceived: raw.notifyReportReceived ?? false,
    });

    return apiCreated({
      vesselId: vessel.id,
      imo,
      report: row,
      missingFields: parsed.missingFields,
      warnings: parsed.warnings,
      dataConfidence: parsed.dataConfidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
