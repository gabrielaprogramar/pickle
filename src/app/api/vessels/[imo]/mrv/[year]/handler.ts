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
import { determineApplicability } from "@/lib/regulatory/applicability";
import { refineMrvApplicability } from "@/lib/mrv/applicability";
import { resolveActiveMonitoringPlan } from "@/lib/mrv/monitoring-plan";
import { isKnownFuelType } from "@/lib/fuel-delivery/emission-factors";
import { classifyVoyagePortStatusWithHints } from "@/lib/eu-ets/port-classifier";
import type { MonitoringPlanResolution, MrvMonitoringPlan, MrvReportRow, MrvReportResult, MrvReportInsert, MrvVoyageEntry, MrvLifecycle } from "@/lib/mrv/types";
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

/**
 * PART 4.6 — reconstruct a `MrvReportResult` from the PERSISTED MrvReportRow.
 * Used by GET/export so those endpoints surface the persisted snapshot instead
 * of re-running (and thereby mutating) the pipeline.
 */
function rowToMrvReportResult(row: MrvReportRow): MrvReportResult {
  const reportData = row.report_data ?? {};
  const lifecycle = (reportData["lifecycle"] as MrvLifecycle | null) ?? (row.lifecycle as MrvLifecycle | null) ?? "DRAFT";
  const reportDataChecks = reportData["completeness_checks"] as Array<{
    check_name: string;
    passed: boolean;
    severity: "error" | "warning";
    message: string;
  }> | null;
  const voyageEntries = reportData["voyage_entries"] as ReadonlyArray<MrvVoyageEntry> | null;

  return {
    calculation_version: row.calculation_version,
    parameter_version: row.parameter_version,
    vessel_id: row.vessel_id,
    reporting_year: row.reporting_year,
    status: row.status,
    lifecycle,
    completeness_status: (row.completeness_status as "VALID" | "WARNING" | "BLOCKED") ?? "VALID",
    completeness_checks: reportDataChecks ?? [],
    blocking_issues: (row.blocking_issues as string[]) ?? [],
    warnings: (row.warnings as string[]) ?? [],
    total_voyages: row.total_voyages,
    total_fuel_mt: row.total_fuel_mt,
    total_co2_tonnes: row.total_co2_tonnes,
    total_co2e_tonnes: (reportData["total_co2e_tonnes"] as number | null | undefined) ?? row.total_co2_tonnes,
    total_distance_nm: row.total_distance_nm,
    total_time_at_sea_hours: row.total_time_at_sea_hours,
    fuel_stocktakes: (reportData["fuel_stocktakes"] as MrvReportResult["fuel_stocktakes"]) ?? [],
    monitored_period_start: row.period_start,
    monitored_period_end: row.period_end,
    monitoring_plan_version: row.monitoring_plan_version,
    monitoring_plan_ver: row.monitoring_plan_ver,
    methodology: row.methodology,
    voyage_entries: voyageEntries ?? [],
    version: reportData["version"] as MrvReportResult["version"] | null,
    delivery_ids: (reportData["delivery_ids"] as string[]) ?? [],
    voyage_ids: (reportData["voyage_ids"] as string[]) ?? [],
    report_data: row.report_data,
    generated_at: row.generated_at,
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

    // PART 4.6 — GET returns the ACTUAL persisted MRV report (route → handler →
    // deps → repo → response), NOT the EU ETS record that was previously leaked.
    const report = await deps.mrvReports.findByVesselAndYear(vessel.id, yearNum);
    if (!report) {
      return apiError(
        NOT_FOUND,
        `No MRV report found for IMO ${imo} / ${yearNum}. Generate it first with POST /mrv/${yearNum}.`,
        404,
      );
    }

    return apiSuccess({
      vessel: { id: vessel.id, imo: vessel.imo, name: vessel.name },
      mrv_report: report,
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

  // ── Voyages: distance/time metrics audited only ─────────────────────────
  // PART 4.6 — scope_type uses the SHARED authoritative geographic classifier
  // (EU ETS / FuelEU `port-classifier`), NOT a "both ports exist ⇒ INTRA_EU"
  // dummy. Unknown ports surface as UNKNOWN (never coerced to INTRA_EU).
  const portCalls = await deps.portCalls.findByVesselId(vessel.id);
  const portCountry = (portName: string | null): string | null => {
    if (!portName) return null;
    return portCalls.find((pc) => pc.port_name === portName)?.port_country ?? null;
  };
  const voyages = voyageRows.map((v) => {
    const depCountry = portCountry(v.departure_port_name);
    const arrCountry = portCountry(v.arrival_port_name);
    const status = classifyVoyagePortStatusWithHints(
      v.departure_port_name ?? "",
      v.arrival_port_name ?? "",
      depCountry,
      arrCountry,
    );
    return {
      id: v.id,
      departure_port: v.departure_port_name ?? null,
      arrival_port: v.arrival_port_name ?? null,
      departure_time: v.departure_time ?? null,
      arrival_time: v.arrival_time ?? null,
      distance_nm: v.distance_nm,
      scope_type: status.type === "UNKNOWN" ? "REQUIRES_REVIEW" : status.type,
      unknown_ports: [...status.unknownPorts],
    };
  });

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

  // ── Completeness from REAL data (PART 4.6) — no more hardcoded true/false ─
  // AIS data: real presence of AIS positions for the vessel.
  let hasAisData = false;
  try {
    const ais = await deps.aisPositions.findByVesselImo(vessel.imo, { limit: 1 });
    hasAisData = ais.rows.length > 0;
  } catch {
    hasAisData = false;
  }
  // Unmatched BDNs: deliveries with no reconciliation to a voyage.
  const unmatchedBdns = deliveries.filter(
    (d) => d.reconciled_voyage_id === null || d.reconciled_voyage_id === "",
  ).length;
  // Unresolved validation errors: REVIEW/BLOCKED consumption, unknown fuel, or
  // negative quantity — anything that would under-state/over-state emissions.
  const hasUnresolvedValidationErrors = consumption.some(
    (c) =>
      c.status === "REVIEW" ||
      c.status === "BLOCKED" ||
      !isKnownFuelType(c.fuel_type) ||
      c.quantity_mt < 0,
  );

  const dataset: MrvDatasetInfo = {
    hasVoyages: voyageRows.length > 0,
    hasFuelDeliveries: deliveries.length > 0,
    hasAisData,
    hasBdnCoverage: deliveries.some((d) => d.bdn_reference !== null && d.bdn_reference !== ""),
    hasUnmatchedBdns: unmatchedBdns > 0,
    vesselName: vessel.name,
    vesselImo: vessel.imo,
    monitoringPlanVersion: resolution.status === "RESOLVED"
      ? `v${resolution.plan.version}`
      : overrides.monitoring_plan_version ?? null,
    methodology: overrides.methodology ?? "default",
    hasUnresolvedValidationErrors,
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

    // PART 4.6 — export uses the PERSISTED report (HEAD snapshot), never a fresh
    // pipeline run. This keeps export deterministic and guarantees a blocked /
    // DATA_INCOMPLETE report can never produce a submission-ready file.
    const row = await deps.mrvReports.findByVesselAndYear(vessel.id, yearNum);
    if (!row) {
      return apiError(
        NOT_FOUND,
        `No MRV report found for IMO ${imo} / ${yearNum}. Generate it first with POST /mrv/${yearNum}.`,
        404,
      );
    }
    const reportResult = rowToMrvReportResult(row);

    const service = new MrvReportService(deps.mrvReports, deps.mrvReportVersions, deps.auditLog, deps.organizationId);
    const exportResult = await service.generateExport(reportResult, format);

    // PART 4.6 — persist export metadata (format / hash / timestamp) to the HEAD
    // so a repeated export of the same content is provably identical (same hash).
    // The HEAD upsert preserves the full row (NOT NULL columns), only overlaying
    // the export metadata fields.
    if (statusCodeAllowsExport(reportResult.lifecycle)) {
      await deps.mrvReports.upsert({
        ...rowToMrvReportInsert(row),
        export_format: exportResult.format,
        export_content_hash: exportResult.content_hash,
        export_generated_at: exportResult.generated_at,
        export_file_path: null,
      });
    }

    return apiCreated(exportResult);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

/** PART 4.6 — map a persisted MrvReportRow back to a full MrvReportInsert. */
function rowToMrvReportInsert(row: MrvReportRow): MrvReportInsert {
  return {
    vessel_id: row.vessel_id,
    reporting_year: row.reporting_year,
    status: row.status,
    completeness_status: row.completeness_status,
    completeness_checks: row.completeness_checks as unknown[],
    blocking_issues: row.blocking_issues as unknown[],
    warnings: row.warnings as unknown[],
    checklist_status: row.checklist_status,
    checklist_details: row.checklist_details,
    export_format: row.export_format,
    export_generated_at: row.export_generated_at,
    export_content_hash: row.export_content_hash,
    export_file_path: row.export_file_path,
    report_data: row.report_data,
    total_voyages: row.total_voyages,
    total_fuel_mt: row.total_fuel_mt,
    total_co2_tonnes: row.total_co2_tonnes,
    monitoring_plan_version: row.monitoring_plan_version,
    methodology: row.methodology,
    calculation_version: row.calculation_version,
    parameter_version: row.parameter_version,
    ets_record_id: row.ets_record_id,
    lifecycle: row.lifecycle,
    period_start: row.period_start,
    period_end: row.period_end,
    monitoring_plan_ver: row.monitoring_plan_ver,
    total_distance_nm: row.total_distance_nm,
    total_time_at_sea_hours: row.total_time_at_sea_hours,
  };
}

function statusCodeAllowsExport(lifecycle: MrvLifecycle): boolean {
  return lifecycle !== "DATA_INCOMPLETE" && lifecycle !== "REQUIRES_REVIEW";
}
