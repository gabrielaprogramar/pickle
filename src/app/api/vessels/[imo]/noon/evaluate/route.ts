import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VALIDATION_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import type { NoonEvaluateOptions } from "@/lib/noon-report";
import { buildDefaultNoonApiDeps } from "../_lib";
import type { NoonApiDeps } from "../_lib";

interface EvaluateBody {
  readonly reportId?: string;
  readonly now?: string;
  readonly persist?: boolean;
  readonly voyagePlan?: NoonEvaluateOptions["voyagePlan"];
  readonly deliveries?: NoonEvaluateOptions["deliveries"];
}

/**
 * POST /api/vessels/[imo]/noon/evaluate
 *
 * Runs the deterministic noon analysis + validation + correlations on the
 * latest report (or `reportId`) and persists the evaluation output on the
 * report row (unless `persist: false`). Repeated evaluations of unchanged
 * content are de-duplicated (`wasDuplicated: true`).
 */
export async function POST(
  req: Request,
  { params }: { params: { imo: string } },
  deps: NoonApiDeps = buildDefaultNoonApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;

    const raw = await parseJsonBody<Partial<EvaluateBody>>(req);
    if (raw === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON", 400);
    }

    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    if (
      (typeof raw.reportId !== "undefined" && typeof raw.reportId !== "string") ||
      (typeof raw.now !== "undefined" && typeof raw.now !== "string") ||
      (typeof raw.persist !== "undefined" && typeof raw.persist !== "boolean")
    ) {
      return apiError(
        VALIDATION_ERROR,
        "Fields 'reportId'/'now' must be strings and 'persist' must be a boolean",
        400,
      );
    }

    const outcome = await deps.service.evaluate(imo, {
      reportId: raw.reportId,
      now: raw.now,
      voyagePlan: raw.voyagePlan,
      deliveries: raw.deliveries,
      persist: raw.persist ?? true,
    });

    return apiSuccess({
      imo,
      vesselId: vessel.id,
      wasDuplicated: outcome.wasDuplicated,
      dispatchedNotifications: outcome.dispatchedNotifications,
      report: outcome.report,
      domain: outcome.domain,
      analysis: outcome.analysis,
      validator: outcome.validator,
      fuel: outcome.fuel,
      voyage: outcome.voyage,
      fueleu: outcome.fueleu,
      ets: outcome.ets,
      findings: outcome.findings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
