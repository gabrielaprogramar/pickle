import type { MrvReportRepository } from "@/lib/supabase/repositories/mrv_reports";
import type {
  MrvReportResult,
  MrvReportInsert,
  MrvVoyageEntry,
  MrvChecklistResult,
  MrvExportResult,
  MrvVerifierPackage,
} from "@/lib/mrv/types";
import { MRV_CALCULATION_VERSION } from "@/lib/mrv/types";
import { ETS_CURRENT_PARAMETER_VERSION } from "@/lib/eu-ets/parameters";
import { runMrvCompletenessCheck, type MrvDatasetInfo, type MrvCompletenessResult } from "@/lib/mrv/completeness";
import { runPreSubmissionChecklist, type MrvPreSubmissionInput } from "@/lib/mrv/checklist";
import { generateXmlExport, generateCsvExport } from "@/lib/mrv/export";
import { buildVerifierPackage, type VerifierPackageInput } from "@/lib/mrv/verifier-package";
import { getFuelEmissionInfo } from "@/lib/fuel-delivery/emission-factors";

export class MrvReportService {
  constructor(private readonly repo: MrvReportRepository) {}

  /**
   * Run completeness check without generating a report.
   */
  async checkCompleteness(input: {
    vessel_id: string;
    reporting_year: number;
    dataset: MrvDatasetInfo;
  }): Promise<MrvCompletenessResult> {
    return runMrvCompletenessCheck(input.dataset);
  }

  /**
   * Generate an annual MRV report.
   */
  async generateReport(input: {
    vessel_id: string;
    reporting_year: number;
    dataset: MrvDatasetInfo;
    deliveries: ReadonlyArray<{
      id: string;
      fuel_type: string;
      quantity_mt: number;
      delivery_date: string;
    }>;
    voyages: ReadonlyArray<{
      id: string;
      departure_port: string;
      arrival_port: string;
      departure_time: string;
      arrival_time: string;
      distance_nm: number | null;
    }>;
    methodology?: string;
    monitoring_plan_version?: string | null;
    ets_record_id?: string | null;
  }): Promise<MrvReportResult> {
    const completeness = runMrvCompletenessCheck(input.dataset);
    if (completeness.status === "BLOCKED") {
      const ts = new Date().toISOString();
      return {
        calculation_version: MRV_CALCULATION_VERSION,
        parameter_version: ETS_CURRENT_PARAMETER_VERSION,
        vessel_id: input.vessel_id,
        reporting_year: input.reporting_year,
        status: "blocked",
        completeness_status: "BLOCKED",
        completeness_checks: completeness.checks,
        blocking_issues: completeness.blocking_issues,
        warnings: completeness.warnings,
        total_voyages: 0,
        total_fuel_mt: 0,
        total_co2_tonnes: 0,
        monitoring_plan_version: input.monitoring_plan_version ?? null,
        methodology: input.methodology ?? "default",
        voyage_entries: [],
        delivery_ids: [],
        voyage_ids: [],
        report_data: {},
        generated_at: ts,
      };
    }

    // Build voyage entries
    const voyageEntries: MrvVoyageEntry[] = [];
    let totalFuelMt = 0;
    let totalCo2 = 0;

    // Simplified: distribute deliveries across voyages
    const perVoyageFuel =
      input.voyages.length > 0
        ? totalDeliveryMt(input.deliveries) / input.voyages.length
        : 0;
    const perVoyageCo2 =
      input.voyages.length > 0
        ? totalDeliveryCo2(input.deliveries) / input.voyages.length
        : 0;

    for (const v of input.voyages) {
      // Find the first delivery's fuel type as representative
      const firstFuel = input.deliveries[0]?.fuel_type ?? "unknown";
      voyageEntries.push({
        voyage_id: v.id,
        departure_port: v.departure_port,
        arrival_port: v.arrival_port,
        departure_date: v.departure_time,
        arrival_date: v.arrival_time,
        distance_nm: v.distance_nm,
        fuel_type: firstFuel,
        fuel_consumption_mt: perVoyageFuel,
        co2_tonnes: perVoyageCo2,
        voyage_type: "MRV",
        data_quality: "reconciled",
      });
      totalFuelMt += perVoyageFuel;
      totalCo2 += perVoyageCo2;
    }

    const ts = new Date().toISOString();
    const reportData: Record<string, unknown> = {
      calculation_version: MRV_CALCULATION_VERSION,
      methodology: input.methodology ?? "default",
      voyage_count: input.voyages.length,
      delivery_count: input.deliveries.length,
    };

    const result: MrvReportResult = {
      calculation_version: MRV_CALCULATION_VERSION,
      parameter_version: ETS_CURRENT_PARAMETER_VERSION,
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,
      status: "draft",
      completeness_status: completeness.status,
      completeness_checks: completeness.checks,
      blocking_issues: completeness.blocking_issues,
      warnings: completeness.warnings,
      total_voyages: input.voyages.length,
      total_fuel_mt: Math.round(totalFuelMt * 10000) / 10000,
      total_co2_tonnes: Math.round(totalCo2 * 10000) / 10000,
      monitoring_plan_version: input.monitoring_plan_version ?? null,
      methodology: input.methodology ?? "default",
      voyage_entries: voyageEntries,
      delivery_ids: input.deliveries.map((d) => d.id),
      voyage_ids: input.voyages.map((v) => v.id),
      report_data: reportData,
      generated_at: ts,
    };

    // Persist
    const insert: MrvReportInsert = {
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,
      status: result.status,
      completeness_status: result.completeness_status,
      completeness_checks: result.completeness_checks as unknown[],
      blocking_issues: result.blocking_issues as unknown[],
      warnings: result.warnings as unknown[],
      report_data: result.report_data,
      total_voyages: result.total_voyages,
      total_fuel_mt: result.total_fuel_mt,
      total_co2_tonnes: result.total_co2_tonnes,
      monitoring_plan_version: result.monitoring_plan_version,
      methodology: result.methodology,
      calculation_version: result.calculation_version,
      parameter_version: result.parameter_version,
      ets_record_id: input.ets_record_id ?? null,
      generated_at: ts,
    };
    await this.repo.upsert(insert);

    return result;
  }

  /**
   * Run pre-submission checklist on a generated report.
   */
  async runChecklist(report: MrvReportResult): Promise<MrvChecklistResult> {
    const input: MrvPreSubmissionInput = {
      completeness_checks: report.completeness_checks,
      hasExportContent: false,
      reportingYear: report.reporting_year,
      vesselName: null,
      vesselImo: null,
      voyageCount: report.total_voyages,
      deliveryCount: report.delivery_ids.length,
      monitoringPlanVersion: report.monitoring_plan_version,
      methodology: report.methodology,
      calculationVersion: report.calculation_version,
    };
    return runPreSubmissionChecklist(input);
  }

  /**
   * Generate export file (XML or CSV).
   */
  async generateExport(
    report: MrvReportResult,
    format: "xml" | "csv" = "xml",
  ): Promise<MrvExportResult> {
    if (format === "csv") return generateCsvExport(report);
    return generateXmlExport(report);
  }

  /**
   * Build verifier data package reference.
   */
  async buildVerifierPackage(input: VerifierPackageInput): Promise<MrvVerifierPackage> {
    return buildVerifierPackage(input);
  }
}

function totalDeliveryMt(
  deliveries: ReadonlyArray<{ quantity_mt: number }>,
): number {
  return deliveries.reduce((s, d) => s + d.quantity_mt, 0);
}

function totalDeliveryCo2(
  deliveries: ReadonlyArray<{ fuel_type: string; quantity_mt: number }>,
): number {
  let total = 0;
  for (const d of deliveries) {
    const info = getFuelEmissionInfo(d.fuel_type);
    if (info) {
      total += d.quantity_mt * 1000 * info.co2_factor / 1000;
    }
  }
  return total;
}
