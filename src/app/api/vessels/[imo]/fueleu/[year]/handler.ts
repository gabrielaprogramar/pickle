import {
  apiSuccess,
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";
import { FuelEUComplianceService } from "@/lib/fueleu/service";
import { FuelEuPipelineService } from "@/lib/fueleu/pipeline";

interface RouteParams {
  imo: string;
  year: string;
}

export async function handleGetFuelEuRecord(
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2025) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2025.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    const service = new FuelEUComplianceService(deps.fuelEuRecords);
    const record = await service.getRecord(vessel.id, yearNum);
    if (!record) {
      return apiError(NOT_FOUND, `No FuelEU record found for IMO ${imo}, year ${year}.`, 404);
    }

    return apiSuccess(record);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostFuelEuCalculate(
  request: Request,
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2025) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2025.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    await parseJsonBody<unknown>(request);

    // ── End-to-end pipeline ────────────────────────────────────────────────
    // Produces applicability from the seeded `fueleu_scope` rule, attributes
    // BDN-evidenced per-(voyage, fuel) consumption from the canonical
    // `voyage_consumption` model, resolves authoritative port countries from
    // `port_calls` via the shared EU ETS port classifier, reads baseline/target/
    // penalty from versioned `regulatory_rules`, derives ISCC biofuel evidence
    // from the certificate registry, runs the scope-aware compliance engine,
    // persists the `fuel_eu_record`, and writes an audit trail. No manually
    // assembled inputs — same repo/service dependency pattern as EU ETS.
    const pipeline = new FuelEuPipelineService({
      vessels: deps.vessels,
      voyages: deps.voyages,
      fuelDeliveries: deps.fuelDeliveries,
      noonReports: deps.noonReports,
      portCalls: deps.portCalls,
      regulatoryRules: deps.regulatoryRules,
      regulationApplicability: deps.regulationApplicability,
      voyageConsumption: deps.voyageConsumption,
      fuelEuRecords: deps.fuelEuRecords,
      certificates: deps.certificates,
      auditLog: deps.auditLog,
      organizationId: deps.organizationId,
    });

    const result = await pipeline.run(vessel.id, yearNum);

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
