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

    const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);
    const voyageRows = await deps.voyages.findByVesselAndYear(vessel.id, yearNum);

    const service = new EtsComplianceService(deps.euEtsRecords);
    const result = await service.calculateAndSave({
      vessel_id: vessel.id,
      reporting_year: yearNum,
      gt: vessel.gross_tonnage ?? null,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        fuel_type: d.fuel_type,
        quantity_mt: d.quantity_mt,
        delivery_date: d.delivery_date,
      })),
      voyages: voyageRows.map((v) => ({
        id: v.id,
        departure_port: v.departure_port_name,
        arrival_port: v.arrival_port_name,
      })),
      parameter_version_override: body.parameter_version,
      eua_price_eur: body.eua_price_eur,
    });

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
