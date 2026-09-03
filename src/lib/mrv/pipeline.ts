/**
 * mrv/pipeline.ts — annual EU MRV report orchestration on the shared backbone
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 ties the reporting/evidence layer together around the SAME shared
 * operational truth as EU ETS and FuelEU:
 *
 *   1. Applicability  – from the SHARED regulatory layer
 *                       (`determineApplicability` + `refineMrvApplicability`),
 *                       NOT a private GT>=threshold in MRV code.
 *   2. Consumption    – from the CANONICAL `voyage_consumption` model via
 *                       `aggregateAnnualMrv` (NO equal-share, NO secondary
 *                       voyage/emissions source).
 *   3. Monitoring plan– deterministic ACTIVE-plan resolution from the versioned
 *                       `mrv_monitoring_plans` domain model; an unresolved /
 *                       unapproved plan halts progress (REQUIRES_REVIEW), never
 *                       a silent guess.
 *   4. Lifecycle      – the explicit `lifecycle.ts` state machine; data gaps
 *                       cannot jump to VERIFIED/EXPORTED without evidence.
 *   5. Metrics        – distance/time are AUDITED only; DATA_INCOMPLETE rows are
 *                       never fabricated (BLOCK rather than misreport).
 *
 * The result carries a full `MrvReportVersion` (the append-only revision). This
 * module is PURE / deterministic given its inputs; persistence is delegated to
 * repositories by the caller so it is unit-testable without a DB.
 */

import {
  aggregateAnnualMrv,
  type MrvAggregationInput,
  type MrvAggregationResult,
} from "./aggregation";
import { runMrvCompletenessCheck, type MrvDatasetInfo } from "./completeness";
import { MRV_CALCULATION_VERSION } from "./types";
import { ETS_CURRENT_PARAMETER_VERSION } from "@/lib/eu-ets/parameters";
import { PORT_CLASSIFIER_VERSION } from "@/lib/eu-ets/port-classifier";
import type {
  MrvLifecycle,
  MrvMonitoringPlan,
  MrvReportResult,
  MonitoringPlanResolution,
  MrvReportVersion,
} from "./types";
import type { ApplicabilityDecision } from "@/lib/regulatory/applicability";

export interface PipelineVoyage {
  readonly id: string;
  readonly departure_port: string | null;
  readonly arrival_port: string | null;
  readonly departure_time: string | null;
  readonly arrival_time: string | null;
  readonly distance_nm: number | null;
  readonly scope_type?: string;
}

export interface PipelineConsumption {
  readonly voyage_id: string | null;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly method: string;
  readonly status: string;
  readonly source_type: string;
  readonly source_record_ids: unknown[];
}

export interface MrvPipelineInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly dataset: MrvDatasetInfo;
  readonly applicability: ApplicabilityDecision;
  readonly monitoringPlanResolution: MonitoringPlanResolution;
  readonly consumption: ReadonlyArray<PipelineConsumption>;
  readonly consumptionByVoyage: ReadonlyMap<
    string,
    ReadonlyArray<{ fuel_type: string; quantity_mt: number; method: string; status: string }>
  >;
  readonly voyages: ReadonlyArray<PipelineVoyage>;
  readonly methodology?: string;
  readonly ets_record_id?: string | null;
}

export interface MrvPipelineOutput {
  readonly result: MrvReportResult;
  readonly aggregation: MrvAggregationResult;
  /** Lifecycle we intended to persist (post state-machine validation). */
  readonly lifecycle: MrvLifecycle;
  readonly version: MrvReportVersion;
}

const lifecycleFor = (
  completenessBlocked: boolean,
  planResolution: MonitoringPlanResolution,
  aggregation: MrvAggregationResult,
): MrvLifecycle => {
  if (completenessBlocked) return "DATA_INCOMPLETE";
  if (aggregation.cross_year_voyages.length > 0) return "REQUIRES_REVIEW";
  if (aggregation.unresolved_consumption_count > 0) return "REQUIRES_REVIEW";
  if (aggregation.missing_distance_voyages.length > 0) return "REQUIRES_REVIEW";
  if (aggregation.missing_time_voyages.length > 0) return "REQUIRES_REVIEW";
  switch (planResolution.status) {
    case "RESOLVED":
      return "VALIDATED";
    case "NOT_APPROVED":
      return "REQUIRES_REVIEW";
    case "REQUIRES_REVIEW":
      return "REQUIRES_REVIEW";
    case "NOT_FOUND":
      return "REQUIRES_REVIEW";
    default:
      return "REQUIRES_REVIEW";
  }
};

/**
 * Build the append-only report version (the delta this run produces). The
 * version is immutable once written; it carries full field provenance.
 *
 * `versionNumber` is supplied by the caller (the service) so revisions are
 * monotonic (1, 2, 3, …) and never collide with `(mrv_report_id, version_number)`.
 * The version also PINs the exact rule / factor / classifier / calculation
 * versions that produced it, so a historical report is reproducible even after
 * later rule changes (see "historical replay" tests).
 */
export function buildReportVersion(
  input: MrvPipelineInput,
  aggregation: MrvAggregationResult,
  resolution: MonitoringPlanResolution,
  versionNumber: number,
  pinned: {
    readonly mrvRuleVersion: number | null;
    readonly mrvRuleEffectiveFrom: string | null;
    readonly mrvRuleEffectiveUntil: string | null;
  },
): MrvReportVersion {
  const fuelByType: Record<string, number> = {};
  for (const s of aggregation.fuel_stocktakes) fuelByType[s.fuel_type] = s.quantity_mt;

  const monitoredStart =
    input.reporting_year + "-01-01";
  const monitoredEnd = input.reporting_year + "-12-31";

  return {
    version_number: versionNumber,
    submission_status: resolution.status === "RESOLVED" ? "DRAFT" : "DRAFT",
    period_start: monitoredStart,
    period_end: monitoredEnd,
    total_fuel_mt: aggregation.total_fuel_mt,
    fuel_by_type: fuelByType,
    co2_tonnes: aggregation.total_co2_tonnes,
    ch4_co2e_tonnes: 0,
    n2o_co2e_tonnes: 0,
    total_co2e_tonnes: aggregation.total_co2e_tonnes ?? aggregation.total_co2_tonnes,
    total_distance_nm: aggregation.total_distance_nm,
    total_time_at_sea_hours: aggregation.total_time_at_sea_hours,
    source_consumption_ids: input.consumption.flatMap((c) =>
      (c.source_record_ids ?? []).filter((s): s is string => typeof s === "string"),
    ),
    source_voyage_ids: input.voyages.map((v) => v.id),
    // PART 4.6 — version pinning: the EXACT registries that produced this
    // version, so it can be replayed deterministically after later rule changes.
    calculation_version: MRV_CALCULATION_VERSION,
    parameter_version: input.applicability.rule_version != null
      ? `EU_MRV_rule_v${pinned.mrvRuleVersion ?? 0}`
      : ETS_CURRENT_PARAMETER_VERSION,
    mrv_rule_version: pinned.mrvRuleVersion,
    mrv_rule_effective_from: pinned.mrvRuleEffectiveFrom,
    mrv_rule_effective_until: pinned.mrvRuleEffectiveUntil,
    geography_version: PORT_CLASSIFIER_VERSION,
  };
}

/**
 * Run the full annual MRV pipeline and produce a deterministic result.
 * `versionNumber` is the monotonic revision number for the new version (the
 * service computes it from the version repo before calling); `pinnedRule`
 * carries the effective EU_MRV rule versions actually applied by the SHARED
 * applicability layer so the produced version is reproducible later.
 */
export function generateAnnualMrvReport(
  input: MrvPipelineInput,
  options: {
    readonly versionNumber: number;
    readonly productEligibility?: { readonly eligible: boolean; readonly reason: string };
  } = { versionNumber: 1 },
  pinnedRule?: {
    readonly mrvRuleVersion: number | null;
    readonly mrvRuleEffectiveFrom: string | null;
    readonly mrvRuleEffectiveUntil: string | null;
  },
): MrvPipelineOutput {
  const aggregationInput: MrvAggregationInput = {
    consumption: input.consumption as MrvAggregationInput["consumption"],
    voyages: input.voyages as MrvAggregationInput["voyages"],
    consumptionByVoyage: input.consumptionByVoyage as MrvAggregationInput["consumptionByVoyage"],
  };
  const aggregation = aggregateAnnualMrv(aggregationInput);

  // Fold distance/time + unresolved-consumption checks into completeness and
  // decide whether this run is fundamentally blocked.
  const mergedDataset: MrvDatasetInfo = {
    ...input.dataset,
    aggregationChecks: [...aggregation.distance_checks, ...aggregation.time_checks],
    unresolvedConsumptionCount: aggregation.unresolved_consumption_count,
    totalConsumptionCount: input.consumption.length,
    nonVerifiedConsumptionCount: aggregation.non_verified_consumption_count,
    missingDistanceVoyages: aggregation.missing_distance_voyages.length,
    missingTimeVoyages: aggregation.missing_time_voyages.length,
    monitoringPlanResolved: input.monitoringPlanResolution.status === "RESOLVED",
  };
  const completeness = runMrvCompletenessCheck(mergedDataset);

  // Lifecycle state machine: a completeness BLOCK is DATA_INCOMPLETE, and a
  // report can only advance toward VALIDATED when nothing blocks it.
  const lifecycle = lifecycleFor(
    completeness.status === "BLOCKED",
    input.monitoringPlanResolution,
    aggregation,
  );

  const version = buildReportVersion(
    input,
    aggregation,
    input.monitoringPlanResolution,
    options.versionNumber,
    {
      mrvRuleVersion: pinnedRule?.mrvRuleVersion ?? null,
      mrvRuleEffectiveFrom: pinnedRule?.mrvRuleEffectiveFrom ?? null,
      mrvRuleEffectiveUntil: pinnedRule?.mrvRuleEffectiveUntil ?? null,
    },
  );
  const plan = input.monitoringPlanResolution.status === "RESOLVED"
    ? input.monitoringPlanResolution.plan
    : null;

  const ts = new Date().toISOString();
  const isBlocked = lifecycle === "DATA_INCOMPLETE";

  const result: MrvReportResult = {
    calculation_version: MRV_CALCULATION_VERSION,
    parameter_version: ETS_CURRENT_PARAMETER_VERSION,
    vessel_id: input.vessel_id,
    reporting_year: input.reporting_year,
    status: isBlocked ? "blocked" : lifecycle === "VALIDATED" ? "validated" : "draft",
    lifecycle,
    completeness_status: completeness.status,
    completeness_checks: completeness.checks,
    blocking_issues: completeness.blocking_issues,
    warnings: completeness.warnings,
    total_voyages: input.voyages.length,
    total_fuel_mt: aggregation.total_fuel_mt,
    total_co2_tonnes: aggregation.total_co2_tonnes,
    total_co2e_tonnes: aggregation.total_co2e_tonnes,
    total_distance_nm: aggregation.total_distance_nm,
    total_time_at_sea_hours: aggregation.total_time_at_sea_hours,
    fuel_stocktakes: aggregation.fuel_stocktakes,
    monitored_period_start: version.period_start,
    monitored_period_end: version.period_end,
    monitoring_plan_version: plan?.effective_from ?? input.dataset.monitoringPlanVersion,
    monitoring_plan_ver: plan?.version ?? null,
    methodology: input.methodology ?? "default",
    voyage_entries: aggregation.voyage_entries,
    version,
    delivery_ids: [],
    voyage_ids: input.voyages.map((v) => v.id),
    report_data: {
      calculation_version: MRV_CALCULATION_VERSION,
      parameter_version: version.parameter_version,
      methodology: input.methodology ?? "default",
      voyage_count: input.voyages.length,
      applicability: input.applicability.applicability,
      monitoring_plan_resolution: input.monitoringPlanResolution.status,
      cross_year_voyages: aggregation.cross_year_voyages,
      unresolved_consumption_rows: aggregation.unresolved_consumption_rows,
      // PART 4.6 — extended evidence snapshot (carried into the version row and
      // the HEAD so the revision keeps its applicability/validation posture).
      non_verified_consumption_count: aggregation.non_verified_consumption_count,
      non_verified_consumption_rows: aggregation.non_verified_consumption_rows,
      unresolved_consumption_count: aggregation.unresolved_consumption_count,
      missing_distance_voyage_ids: aggregation.missing_distance_voyages,
      missing_time_voyage_ids: aggregation.missing_time_voyages,
      mrv_rule_version: version.mrv_rule_version,
      mrv_rule_effective_from: version.mrv_rule_effective_from,
      mrv_rule_effective_until: version.mrv_rule_effective_until,
      geography_classifier_version: version.geography_version,
      schema_validation: {
        status: "SCHEMA_VALIDATION_NOT_PERFORMED",
        detail: "No schema validation is performed at generation time; validation occurs at export.",
      },
      // PART 4.6 — full serializable result snapshot so GET/export can rebuild
      // the report WITHOUT re-running (and thereby mutating) the pipeline.
      version: {
        version_number: version.version_number,
        submission_status: version.submission_status,
        period_start: version.period_start,
        period_end: version.period_end,
        total_fuel_mt: version.total_fuel_mt,
        fuel_by_type: version.fuel_by_type,
        co2_tonnes: version.co2_tonnes,
        ch4_co2e_tonnes: version.ch4_co2e_tonnes,
        n2o_co2e_tonnes: version.n2o_co2e_tonnes,
        total_co2e_tonnes: version.total_co2e_tonnes,
        total_distance_nm: version.total_distance_nm,
        total_time_at_sea_hours: version.total_time_at_sea_hours,
      },
      voyage_entries: aggregation.voyage_entries,
      fuel_stocktakes: aggregation.fuel_stocktakes,
      delivery_ids: [],
      voyage_ids: input.voyages.map((v) => v.id),
      total_co2e_tonnes: aggregation.total_co2e_tonnes ?? aggregation.total_co2_tonnes,
      completeness_checks: completeness.checks,
      lifecycle: lifecycle,
    },
    generated_at: ts,
  };

  return { result, aggregation, lifecycle, version };
}
