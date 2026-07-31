import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import {
  INTERNAL_ERROR,
  INVALID_JSON,
  VALIDATION_ERROR,
  VESSEL_NOT_FOUND,
} from "@/app/api/_lib/errors";
import { captainReadinessText } from "@/lib/sox-eca";
import {
  createMockSoxScenario,
  isSoxMockScenarioKey,
} from "@/lib/sox-eca";
import { buildDefaultSoxApiDeps } from "../_lib";
import type { SoxApiDeps } from "../_lib";

interface EvaluateBody {
  readonly scenario?: string;
  readonly now?: string;
  readonly persist?: boolean;
}

/**
 * POST /api/vessels/[imo]/sox-watch/evaluate
 *
 * Runs a deterministic SOx ECA evaluation for the vessel and persists the
 * resulting event + watch state (unless `persist: false`). Supports a fixed
 * `scenario` (deterministic mock inputs for demos/tests) or live repository
 * inputs when no scenario is supplied.
 */
export async function POST(
  req: Request,
  { params }: { params: { imo: string } },
  deps: SoxApiDeps = buildDefaultSoxApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;

    const raw = await parseJsonBody<Partial<EvaluateBody>>(req);
    if (raw === null) {
      return apiError(INVALID_JSON, "Request body must be valid JSON", 400);
    }

    const body: EvaluateBody = raw;
    const vessel = await deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    let outcome;
    if (typeof body.scenario === "string" && body.scenario.length > 0) {
      if (!isSoxMockScenarioKey(body.scenario)) {
        return apiError(
          VALIDATION_ERROR,
          `Unknown scenario '${body.scenario}'`,
          400,
        );
      }
      const scenario = createMockSoxScenario(body.scenario);
      outcome = await deps.service.evaluate(imo, {
        now: scenario.input.now,
        position: scenario.input.position,
        zone: scenario.input.zone,
        deliveries: scenario.input.deliveries,
        trustedFuelInUse: scenario.input.trustedFuelInUse,
        persist: body.persist ?? false,
      });
    } else {
      if (typeof body.now !== "undefined" && typeof body.now !== "string") {
        return apiError(
          VALIDATION_ERROR,
          "Field 'now' must be an ISO timestamp string",
          400,
        );
      }
      outcome = await deps.service.evaluate(imo, {
        now: typeof body.now === "string" ? body.now : undefined,
        persist: body.persist ?? true,
      });
    }

    return apiSuccess({
      imo,
      vesselId: outcome.evaluation.vessel.vesselId,
      evaluation: {
        evaluatedAt: outcome.evaluation.evaluatedAt,
        insideEca: outcome.evaluation.insideEca,
        ecaEffective: outcome.evaluation.ecaEffective,
        geometryAvailable: outcome.evaluation.geometryAvailable,
        zoneState: outcome.evaluation.zoneState,
        evidenceStatus: outcome.evaluation.evidenceStatus,
        applicableLimitPct: outcome.evaluation.applicableLimitPct,
        sulphurContentPct: outcome.evaluation.sulphurContentPct,
        selectedDeliveryId: outcome.evaluation.selectedDeliveryId,
        watchStatus: outcome.evaluation.watchStatus,
        severity: outcome.evaluation.severity,
        ruleResults: outcome.evaluation.ruleResults,
        reviewRequired: outcome.evaluation.reviewRequired,
        ambiguous: outcome.evaluation.ambiguous,
      },
      event: outcome.event,
      watchState: outcome.watchState,
      wasDuplicated: outcome.wasDuplicated,
      dispatchedNotifications: outcome.dispatchedNotifications,
      captain: captainReadinessText(outcome.evaluation),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
