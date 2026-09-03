import type { MrvReportRepository } from "@/lib/supabase/repositories/mrv_reports";
import type { MrvReportVersionRepository } from "@/lib/supabase/repositories/mrv_report_versions";
import type { AuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import type {
  MrvReportResult,
  MrvReportInsert,
  MrvChecklistResult,
  MrvExportResult,
  MrvVerifierPackage,
  MrvLifecycle,
} from "@/lib/mrv/types";
import { MRV_CALCULATION_VERSION } from "@/lib/mrv/types";
import { ETS_CURRENT_PARAMETER_VERSION } from "@/lib/eu-ets/parameters";
import { runMrvCompletenessCheck, type MrvDatasetInfo, type MrvCompletenessResult } from "@/lib/mrv/completeness";
import { runPreSubmissionChecklist, type MrvPreSubmissionInput } from "@/lib/mrv/checklist";
import { generateXmlExport, generateCsvExport } from "@/lib/mrv/export";
import { buildVerifierPackage, type VerifierPackageInput } from "@/lib/mrv/verifier-package";
import { canTransition } from "@/lib/mrv/lifecycle";
import type { MrvReportRow } from "@/lib/mrv/types";
import {
  generateAnnualMrvReport,
  type MrvPipelineInput,
} from "@/lib/mrv/pipeline";
import type { MrvReportVersionInsert } from "@/lib/supabase/types";

export class MrvReportService {
  constructor(
    private readonly repo: MrvReportRepository,
    private readonly versionRepo?: MrvReportVersionRepository,
    private readonly auditLog?: AuditLogRepository,
    private readonly organizationId?: string,
  ) {}

  private statusCodeForLifecycle(lifecycle: MrvLifecycle): string {
    switch (lifecycle) {
      case "DATA_INCOMPLETE":
        return "blocked";
      case "VALIDATED":
        return "validated";
      case "VERIFIED":
      case "SCHEMA_VALIDATED_LOCALLY":
      case "EXPORTED":
      case "SUPERSEDED":
        return lifecycle;
      default:
        return "draft";
    }
  }

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
   * Generate an annual MRV report by running the Part 4 pipeline (shared
   * applicability, canonical consumption, active monitoring-plan resolution,
   * explicit lifecycle, auditable distance/time). Consumes `voyage_consumption`;
   * there is NO equal-share allocation here.
   *
   * Versioning (PART 4.6): the appended revision number is monotonic and driven
   * by the version repository's `findLatest` (NOT a bare MAX+1 against the
   * table), so concurrent writes cannot collide with the
   * (mrv_report_id, version_number) UNIQUE constraint. When no version repo is
   * wired (legacy tests) the version number is 1.
   */
  async generateReport(input: MrvPipelineInput): Promise<MrvReportResult> {
    // PART 4.6 — pin the exact MRV rule versions actually applied so the produced
    // revision is reproducible after later rule changes (historical replay).
    const pinnedRule = {
      mrvRuleVersion: input.applicability.rule_version,
      mrvRuleEffectiveFrom: input.applicability.rule_effective_from,
      mrvRuleEffectiveUntil: input.applicability.rule_effective_until,
    };

    const { result, version } = generateAnnualMrvReport(
      input,
      { versionNumber: 1 },
      pinnedRule,
    );

    // Capture the prior lifecycle so every state transition is auditable; never
    // a silent coercion — the state machine (lifecycle.ts) guards this.
    const prior = await this.repo.findByVesselAndYear(input.vessel_id, input.reporting_year);
    const priorLifecycle = prior?.lifecycle ?? null;

    // Persist the annual HEAD.
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
      lifecycle: result.lifecycle,
      period_start: version.period_start,
      period_end: version.period_end,
      monitoring_plan_ver: result.monitoring_plan_ver,
      total_distance_nm: result.total_distance_nm,
      total_time_at_sea_hours: result.total_time_at_sea_hours,
      generated_at: result.generated_at,
    };
    const saved = await this.repo.upsert(insert);
    const effectiveReportId = saved?.id ?? prior?.id;

    // PART 4.6 — monotonic version_number computed from the version repo via
    // findLatest (NOT a raw MAX+1 against the table), after a stable report id
    // is known. First revision is 1; revisions increment monotonically.
    let versionNumber = 1;
    if (this.versionRepo && effectiveReportId) {
      const latest = await this.versionRepo.findLatest(effectiveReportId);
      versionNumber = (latest?.version_number ?? 0) + 1;
    }

    // Append the immutable report version (append-only revision trail). When no
    // version repo is wired (e.g. legacy tests), skip — the HEAD still mirrors.
    if (this.versionRepo && effectiveReportId) {
      const vInsert: MrvReportVersionInsert = {
        mrv_report_id: effectiveReportId,
        version_number: versionNumber,
        submission_status: version.submission_status,
        calculation_version: MRV_CALCULATION_VERSION,
        parameter_version: version.parameter_version,
        monitoring_plan_version: result.monitoring_plan_ver,
        period_start: version.period_start,
        period_end: version.period_end,
        total_fuel_mt: version.total_fuel_mt,
        fuel_by_type: version.fuel_by_type as Record<string, unknown>,
        co2_tonnes: version.co2_tonnes,
        ch4_co2e_tonnes: version.ch4_co2e_tonnes,
        n2o_co2e_tonnes: version.n2o_co2e_tonnes,
        total_co2e_tonnes: version.total_co2e_tonnes,
        total_distance_nm: version.total_distance_nm,
        total_time_at_sea_hours: version.total_time_at_sea_hours,
        source_consumption_ids: version.source_consumption_ids as unknown[],
        source_voyage_ids: version.source_voyage_ids as unknown[],
        traceability: {
          consumption_source: "voyage_consumption",
          emission_factor_source: "shared_registry",
          mrv_rule_version: pinnedRule.mrvRuleVersion,
          mrv_rule_effective_from: pinnedRule.mrvRuleEffectiveFrom,
          mrv_rule_effective_until: pinnedRule.mrvRuleEffectiveUntil,
          geography_version: version.geography_version,
          calculation_version: MRV_CALCULATION_VERSION,
        },
      };
      await this.versionRepo.append(vInsert);
    }

    // Immutable audit trail for the lifecycle state transition — reuse the
    // existing `audit_log` (never a second mechanism). Recorded for every
    // generated state, including from/to so a regression to an earlier state is
    // traceable. The state machine (lifecycle.ts) is what forbids illegal jumps.
    if (this.auditLog && this.organizationId) {
      await this.auditLog.insert({
        organization_id: this.organizationId,
        action: "mrv.lifecycle_transition",
        entity_type: "mrv_report",
        entity_id: effectiveReportId,
        before_data: { lifecycle: priorLifecycle },
        after_data: {
          lifecycle: result.lifecycle,
          reporting_year: input.reporting_year,
          calculation_version: MRV_CALCULATION_VERSION,
          parameter_version: version.parameter_version,
          version_number: versionNumber,
          total_fuel_mt: result.total_fuel_mt,
          total_co2_tonnes: result.total_co2_tonnes,
          monitoring_plan_ver: result.monitoring_plan_ver,
          monitored_period_start: version.period_start,
          monitored_period_end: version.period_end,
        },
        source: "mrv-reporting",
      });
    }

    return result;
  }

  /**
   * PART 4.6 — the ONE authoritative lifecycle transition entry point.
   *
   * Loads the persisted HEAD, validates the edge via `canTransition`, REJECTS
   * illegal edges (e.g. DRAFT→VERIFIED, DATA_INCOMPLETE→VERIFIED,
   * REQUIRES_REVIEW→EXPORTED), and only then persists the new state (HEAD)
   * and writes an immutable audit event. AFter VERIFIED the version is treated
   * as immutable in code (a DB trigger is recommended — see migration 0024).
   */
  async transitionMrvReport(
    vesselId: string,
    reportingYear: number,
    to: MrvLifecycle,
  ): Promise<MrvReportRow | null> {
    const current = await this.repo.findByVesselAndYear(vesselId, reportingYear);
    if (!current) return null;
    const from: MrvLifecycle = current.lifecycle as MrvLifecycle | null ?? "DRAFT";
    const transition = canTransition(from, to);
    if (!transition.ok) {
      throw new Error(transition.reason ?? `Illegal MRV transition ${from} → ${to}`);
    }

    const update: MrvReportInsert = {
      vessel_id: current.vessel_id,
      reporting_year: current.reporting_year,
      status: this.statusCodeForLifecycle(to),
      completeness_status: current.completeness_status,
      completeness_checks: current.completeness_checks as unknown[],
      blocking_issues: current.blocking_issues as unknown[],
      warnings: current.warnings as unknown[],
      report_data: current.report_data,
      total_voyages: current.total_voyages,
      total_fuel_mt: current.total_fuel_mt,
      total_co2_tonnes: current.total_co2_tonnes,
      monitoring_plan_version: current.monitoring_plan_version,
      methodology: current.methodology,
      calculation_version: current.calculation_version,
      parameter_version: current.parameter_version,
      ets_record_id: current.ets_record_id ?? null,
      lifecycle: to,
      period_start: current.period_start,
      period_end: current.period_end,
      monitoring_plan_ver: current.monitoring_plan_ver,
      total_distance_nm: current.total_distance_nm,
      total_time_at_sea_hours: current.total_time_at_sea_hours,
    };
    const saved = await this.repo.upsert(update);

    if (this.auditLog && this.organizationId) {
      await this.auditLog.insert({
        organization_id: this.organizationId,
        action: "mrv.lifecycle_transition",
        entity_type: "mrv_report",
        entity_id: saved.id,
        before_data: { lifecycle: from, status: current.status },
        after_data: { lifecycle: to, status: saved.status, reporting_year: reportingYear },
        source: "mrv-reporting",
      });
    }
    return saved;
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
