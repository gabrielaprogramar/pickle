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
import { determineApplicability } from "@/lib/regulatory/applicability";
import { refineMrvApplicability } from "@/lib/mrv/applicability";
import { resolveActiveMonitoringPlan } from "@/lib/mrv/monitoring-plan";
import type { MonitoringPlanResolution, MrvMonitoringPlan } from "@/lib/mrv/types";
import type { MrvMonitoringPlanRow, VoyageConsumptionRow } from "@/lib/supabase/types";
import type { MrvDatasetInfo } from "@/lib/mrv/completeness";
import type { MrvPipelineInput } from "@/lib/mrv/pipeline";

interface RouteParams {
  imo: string;
  year: string;
}

/** Map a monitoring-plan row to the domain MonitoringPlan. */
function toDomainPlan(row: MrvMonitoringPlanRow): MrvMonitoringPlan {
  return {
    id: row.id,
    vessel_id: row.vessel_id,
    version: row.version,
    status: row.status as unknown as MrvMonitoringPlan["status"],
    methodology: row.methodology as unknown as MrvMonitoringPlan["methodology"],
    monitoring_method: row.monitoring_method as unknown as MrvMonitoringPlan["monitoring_method"],
    effective_from: row.effective_from,
    effective_until: row.effective_until,
    emission_factors_snapshot: row.emission_factors_snapshot,
    activity_data_procedures: row.activity_data_procedures,
    data_gap_methods: row.data_gap_methods,
    source_reference: row.source_reference,
    approved_at: row.approved_at,
  };
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

/**
 * Assemble the Part 4 MRV pipeline input from the SHARED data sources:
 * canonical `voyage_consumption`, the shared applicability layer and the
 * versioned monitoring plan domain. Never equal-share, never a second source.
 */
async function assemblePipelineInput(
  deps: ApiDependencies,
  vessel: { id: string; name: string; imo: string; gross_tonnage: number | null; flag: string | null; vessel_type: string | null },
  yearNum: number,
  overrides: { monitoring_plan_version?: string | null; methodology?: string },
): Promise<MrvPipelineInput> {
  const asOf = `${yearNum}-07-01`;
  const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);
  const voyageRows = await deps.voyages.findByVesselAndYear(vessel.id, yearNum);

  // ── Monitoring plan: deterministic ACTIVE-plan resolution ──────────────
  const planRows = await deps.mrvMonitoringPlans.listByVessel(vessel.id);
  const plans = planRows.map(toDomainPlan);
  const resolution: MonitoringPlanResolution = resolveActiveMonitoringPlan(plans, asOf);

  // ── Canonical consumption (voyage_consumption) — the ONLY fuel source ───
  const consumptionRows = await deps.voyageConsumption.listByVessel(vessel.id, yearNum);
  const consumption = consumptionRows.map((c: VoyageConsumptionRow) => ({
    voyage_id: c.voyage_id,
    fuel_type: c.fuel_type,
    quantity_mt: c.quantity_mt,
    method: c.method,
    status: c.status,
    source_type: c.source_type,
    source_record_ids: c.source_record_ids,
  }));
  const consumptionByVoyage = new Map<string, Array<{ fuel_type: string; quantity_mt: number; method: string; status: string }>>();
  for (const c of consumption) {
    if (c.voyage_id === null) continue;
    const list = consumptionByVoyage.get(c.voyage_id) ?? [];
    list.push({ fuel_type: c.fuel_type, quantity_mt: c.quantity_mt, method: c.method, status: c.status });
    consumptionByVoyage.set(c.voyage_id, list);
  }

  // ── Voyages (distance/time metrics are audited only) ────────────────────
  const voyages = voyageRows.map((v) => ({
    id: v.id,
    departure_port: v.departure_port_name ?? null,
    arrival_port: v.arrival_port_name ?? null,
    departure_time: v.departure_time ?? null,
    arrival_time: v.arrival_time ?? null,
    distance_nm: v.distance_nm,
    scope_type: v.departure_port_name && v.arrival_port_name ? "INTRA_EU" : "REQUIRES_REVIEW",
  }));

  // ── Applicability via the SHARED regulatory layer + EU-engagement refine ─
  const scopeRule = await deps.regulatoryRules.findEffective("EU_MRV", "mrv_scope", asOf);
  const facts = {
    vessel_id: vessel.id,
    imo: vessel.imo,
    gt: vessel.gross_tonnage,
    flag: vessel.flag,
    vesselType: vessel.vessel_type,
    vesselCategory: null,
  };
  const gtDecision = determineApplicability({ rule: scopeRule, facts }, "EU_MRV", asOf);
  const applicability = refineMrvApplicability(gtDecision, voyages);

  const dataset: MrvDatasetInfo = {
    hasVoyages: voyageRows.length > 0,
    hasFuelDeliveries: deliveries.length > 0,
    hasAisData: true,
    hasBdnCoverage: deliveries.some((d) => d.bdn_reference !== null && d.bdn_reference !== ""),
    hasUnmatchedBdns: false,
    vesselName: vessel.name,
    vesselImo: vessel.imo,
    monitoringPlanVersion: resolution.status === "RESOLVED"
      ? `v${resolution.plan.version}`
      : overrides.monitoring_plan_version ?? null,
    methodology: overrides.methodology ?? "default",
    hasUnresolvedValidationErrors: false,
    deliveryCount: deliveries.length,
    voyageCount: voyageRows.length,
    monitoringPlanResolved: resolution.status === "RESOLVED",
  };

  return {
    vessel_id: vessel.id,
    reporting_year: yearNum,
    dataset,
    applicability,
    monitoringPlanResolution: resolution,
    consumption,
    consumptionByVoyage,
    voyages,
    methodology: overrides.methodology ?? "default",
    ets_record_id: null,
  };
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

    const service = new MrvReportService(deps.mrvReports, deps.mrvReportVersions, deps.auditLog, deps.organizationId);
    const input = await assemblePipelineInput(deps, vessel, yearNum, {
      monitoring_plan_version: body.monitoring_plan_version ?? null,
      methodology: body.methodology ?? "default",
    });
    const result = await service.generateReport(input);

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

    const service = new MrvReportService(deps.mrvReports, deps.mrvReportVersions, deps.auditLog, deps.organizationId);
    const input = await assemblePipelineInput(deps, vessel, yearNum, {});
    const reportResult = await service.generateReport(input);

    const exportResult = await service.generateExport(reportResult, format);

    return apiCreated(exportResult);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
