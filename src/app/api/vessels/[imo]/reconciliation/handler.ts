import { apiSuccess, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, NOT_FOUND } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";
import { createReconciliationEngine } from "@/lib/reconciliation/engine";
import { createReconciliationResolution, type ResolveFindingInput, type ReopenFindingInput } from "@/lib/reconciliation/resolution";
import type { VoyageInput, AisPositionInput, PortCallInput, FuelDeliveryInput, NoonReportInput } from "@/lib/reconciliation/reconcilers";
import type { VoyageConsumptionRow, NoonReportRow } from "@/lib/supabase/types";

function mapVoyage(row: { id: string; vessel_id: string; departure_time: string | null; arrival_time: string | null; departure_port_name: string; arrival_port_name: string }): VoyageInput {
  return {
    id: row.id,
    vessel_id: row.vessel_id,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    departure_port: row.departure_port_name,
    arrival_port: row.arrival_port_name,
  };
}

function mapAis(row: { id: string; vessel_id: string; ts: string; latitude: number; longitude: number }): AisPositionInput {
  return { id: row.id, vessel_id: row.vessel_id, timestamp: row.ts, latitude: row.latitude, longitude: row.longitude };
}

function mapPortCall(row: { id: string; vessel_id: string; voyage_id: string | null; port_name: string; port_country: string | null; arr_ts: string | null; dep_ts: string | null }): PortCallInput {
  return { id: row.id, vessel_id: row.vessel_id, voyage_id: row.voyage_id, port: row.port_name, country: row.port_country, arrival_time: row.arr_ts, departure_time: row.dep_ts };
}

function mapFuelDelivery(row: { id: string; vessel_id: string; reconciled_voyage_id: string | null; fuel_type: string; quantity_mt: number; delivery_date: string; delivery_port: string }): FuelDeliveryInput {
  return { id: row.id, vessel_id: row.vessel_id, voyage_id: row.reconciled_voyage_id, fuel_type: row.fuel_type, quantity: row.quantity_mt, delivery_date: row.delivery_date, port: row.delivery_port };
}

function mapNoonReport(row: NoonReportRow): NoonReportInput {
  return { id: row.id, vessel_id: row.vessel_id, report_date: row.report_date, consumption: row.fuel_consumption_tonnes, fuel_type: null, voyage_id: null };
}

export async function handleGetReconciliation(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getUTCFullYear()), 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return apiError(VALIDATION_ERROR, "Invalid reporting year.", 400);
    }

    const voyages = await deps.voyages.findByVesselAndYear(vessel.id, year);
    const aisPage = await deps.aisPositions.findByVesselImo(imo);
    const portCalls = await deps.portCalls.findByVesselId(vessel.id);
    const fuelDeliveries = await deps.fuelDeliveries.findByVesselId(vessel.id);
    const noonReports = await deps.noonReports.listByVesselId(vessel.id);
    const consumption = await deps.voyageConsumption.listByVessel(vessel.id, year);

    const engine = createReconciliationEngine();
    const result = engine.reconcile({
      vessel_id: vessel.id,
      reporting_year: year,
      voyages: voyages.map(mapVoyage),
      ais_positions: aisPage.rows.map(mapAis),
      port_calls: portCalls.map(mapPortCall),
      fuel_deliveries: fuelDeliveries.map(mapFuelDelivery),
      noon_reports: noonReports.map(mapNoonReport),
      canonical_consumption: consumption,
      mrv_snapshot: null,
      ets_snapshot: null,
      fueleu_snapshot: null,
    });

    return apiSuccess(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostResolve(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);

    const body = await parseJsonBody<ResolveFindingInput & { resolution_status?: string }>(request);
    if (!body) return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);

    if (!body.finding_key || !body.resolution_status || !body.resolution_reason) {
      return apiError(VALIDATION_ERROR, "finding_key, resolution_status, and resolution_reason are required.", 400);
    }

    const resolution = createReconciliationResolution({ auditLog: deps.auditLog });
    const result = await resolution.resolveFinding(body.resolution_status as ResolveFindingInput["resolution_status"], {
      finding_key: body.finding_key,
      vessel_id: vessel.id,
      resolution_status: body.resolution_status as ResolveFindingInput["resolution_status"],
      resolution_reason: body.resolution_reason,
      selected_evidence: body.selected_evidence ?? [],
      note: body.note ?? null,
      actor_id: body.actor_id ?? null,
      actor_email: body.actor_email ?? null,
      organization_id: deps.organizationId ?? "",
      correlation_id: body.correlation_id ?? null,
    });

    return apiSuccess(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostReopen(
  request: Request,
  paramsPromise: Promise<{ imo: string }>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo } = await paramsPromise;
    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);

    const body = await parseJsonBody<ReopenFindingInput>(request);
    if (!body) return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);

    if (!body.finding_key || !body.resolution_reason) {
      return apiError(VALIDATION_ERROR, "finding_key and resolution_reason are required.", 400);
    }

    const resolution = createReconciliationResolution({ auditLog: deps.auditLog });
    const result = await resolution.reopenFinding("RESOLVED", {
      finding_key: body.finding_key,
      vessel_id: vessel.id,
      resolution_reason: body.resolution_reason,
      actor_id: body.actor_id ?? null,
      actor_email: body.actor_email ?? null,
      organization_id: deps.organizationId ?? "",
      correlation_id: body.correlation_id ?? null,
    });

    return apiSuccess(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
