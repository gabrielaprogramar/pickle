import {
  apiSuccess,
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";
import { EtsComplianceService } from "@/lib/eu-ets/service";
import { EtsPipelineService } from "@/lib/eu-ets/pipeline";

interface RouteParams {
  imo: string;
  year: string;
}

export async function handleGetEuEtsRecord(
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2024) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2024.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    const service = new EtsComplianceService(deps.euEtsRecords);
    const record = await service.getRecord(vessel.id, yearNum);
    if (!record) {
      return apiError(NOT_FOUND, `No EU ETS record found for IMO ${imo}, year ${year}.`, 404);
    }

    return apiSuccess(record);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostEuEtsCalculate(
  request: Request,
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2024) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2024.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    const body = await parseJsonBody<{
      parameter_version?: string;
      eua_price_eur?: number | null;
    }>(request);

    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    // ── End-to-end pipeline ────────────────────────────────────────────────
    // Produces applicability from the seeded `ets_scope` rule, attributes
    // BDN-evidenced per-(voyage, fuel) consumption, resolves port countries
    // from `port_calls`, reads the contracted coverage rate from the seeded
    // `ets_coverage` rule (never the hardcoded schedule), runs the compliance
    // engine, persists the `eu_ets_record`, and writes an audit trail.
    const pipeline = new EtsPipelineService({
      vessels: deps.vessels,
      voyages: deps.voyages,
      fuelDeliveries: deps.fuelDeliveries,
      noonReports: deps.noonReports,
      portCalls: deps.portCalls,
      regulatoryRules: deps.regulatoryRules,
      regulationApplicability: deps.regulationApplicability,
      voyageConsumption: deps.voyageConsumption,
      euEtsRecords: deps.euEtsRecords,
      auditLog: deps.auditLog,
      organizationId: deps.organizationId,
    });

    const result = await pipeline.run(vessel.id, yearNum);

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
