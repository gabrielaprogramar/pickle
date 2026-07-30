import {
  apiSuccess,
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";
import { MrvReportService } from "@/lib/mrv/service";
import { EtsComplianceService } from "@/lib/eu-ets/service";

interface RouteParams {
  imo: string;
  year: string;
}

export async function handleGetMrvReport(
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

    const etsService = new EtsComplianceService(deps.euEtsRecords);
    const etsRecord = await etsService.getRecord(vessel.id, yearNum);

    return apiSuccess({
      vessel: { id: vessel.id, imo: vessel.imo, name: vessel.name },
      eu_ets_record: etsRecord,
    });
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostMrvValidate(
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
      methodology?: string;
      monitoring_plan_version?: string | null;
      parameter_version?: string;
    }>(request);

    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);
    const voyageRows = await deps.voyages.findByVesselAndYear(vessel.id, yearNum);

    const etsService = new EtsComplianceService(deps.euEtsRecords);
    const etsRecord = await etsService.getRecord(vessel.id, yearNum);

    const service = new MrvReportService(deps.mrvReports);
    const result = await service.generateReport({
      vessel_id: vessel.id,
      reporting_year: yearNum,
      dataset: {
        hasVoyages: voyageRows.length > 0,
        hasFuelDeliveries: deliveries.length > 0,
        hasAisData: true,
        hasBdnCoverage: deliveries.some((d) => d.bdn_reference !== null && d.bdn_reference !== ""),
        hasUnmatchedBdns: false,
        vesselName: vessel.name,
        vesselImo: vessel.imo,
        monitoringPlanVersion: body.monitoring_plan_version ?? null,
        methodology: body.methodology ?? "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: deliveries.length,
        voyageCount: voyageRows.length,
      },
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
        departure_time: v.departure_time ?? "",
        arrival_time: v.arrival_time ?? "",
        distance_nm: v.distance_nm,
      })),
      methodology: body.methodology ?? "default",
      monitoring_plan_version: body.monitoring_plan_version ?? null,
      ets_record_id: etsRecord ? null : null,
    });

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostMrvExport(
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
      format?: "xml" | "csv";
    }>(request);

    const format = body?.format === "csv" ? "csv" : "xml";

    const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);
    const voyageRows = await deps.voyages.findByVesselAndYear(vessel.id, yearNum);

    const service = new MrvReportService(deps.mrvReports);

    const reportResult = await service.generateReport({
      vessel_id: vessel.id,
      reporting_year: yearNum,
      dataset: {
        hasVoyages: voyageRows.length > 0,
        hasFuelDeliveries: deliveries.length > 0,
        hasAisData: true,
        hasBdnCoverage: deliveries.some((d) => d.bdn_reference !== null && d.bdn_reference !== ""),
        hasUnmatchedBdns: false,
        vesselName: vessel.name,
        vesselImo: vessel.imo,
        monitoringPlanVersion: null,
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: deliveries.length,
        voyageCount: voyageRows.length,
      },
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
        departure_time: v.departure_time ?? "",
        arrival_time: v.arrival_time ?? "",
        distance_nm: v.distance_nm,
      })),
    });

    const exportResult = await service.generateExport(reportResult, format);

    return apiCreated(exportResult);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
