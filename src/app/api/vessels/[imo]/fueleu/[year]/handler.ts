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

    const body = await parseJsonBody<{
      ops_energy_mj?: number;
      parameter_version?: string;
    }>(request);

    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);

    const service = new FuelEUComplianceService(deps.fuelEuRecords);
    const result = await service.calculateAndSave({
      vessel_id: vessel.id,
      reporting_year: yearNum,
      deliveries,
      ops_energy_mj: body.ops_energy_mj,
      parameter_version_override: body.parameter_version,
    });

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
