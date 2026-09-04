import type {
  ReconciliationRunResult,
  ReconciliationSummary,
  ReconciliationEdgeInput,
  ReconciliationFindingInput,
  ReconciliationFindingInsert,
  ReconciliationEdgeStatusInsert,
  Severity,
  EdgeStatus,
} from "./types";
import { DEFAULT_TOLERANCE_CONFIG } from "./types";
import {
  reconcileAisVoyage,
  reconcilePortCallVoyage,
  reconcileFuelVoyage,
  reconcileNoonConsumption,
  reconcileBdnConsumption,
  reconcileCrossRegulation,
  type VoyageInput,
  type AisPositionInput,
  type PortCallInput,
  type FuelDeliveryInput,
  type NoonReportInput,
  type RegulatorySnapshot,
  type EdgeReconcilerResult,
} from "./reconcilers";
import { buildFindingKey, buildEdgeKey, keySet } from "./keys";
import { ALL_EDGES, createChainStatusTracker } from "./chain";

export interface ReconciliationInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly voyages: ReadonlyArray<VoyageInput>;
  readonly ais_positions: ReadonlyArray<AisPositionInput>;
  readonly port_calls: ReadonlyArray<PortCallInput>;
  readonly fuel_deliveries: ReadonlyArray<FuelDeliveryInput>;
  readonly noon_reports: ReadonlyArray<NoonReportInput>;
  readonly canonical_consumption: ReadonlyArray<{ readonly id: string; readonly vessel_id: string; readonly voyage_id: string | null; readonly quantity_mt: number; readonly fuel_type: string; readonly status: string }>;
  readonly mrv_snapshot: RegulatorySnapshot | null;
  readonly ets_snapshot: RegulatorySnapshot | null;
  readonly fueleu_snapshot: RegulatorySnapshot | null;
  readonly rule_version?: string | null;
  readonly tolerance_version?: string | null;
  readonly calculation_version?: string | null;
}

export interface ReconciliationEngine {
  reconcile(input: ReconciliationInput): ReconciliationRunResult;
  reconcileVoyage(
    vesselId: string,
    voyage: VoyageInput,
    ais: ReadonlyArray<AisPositionInput>,
    portCalls: ReadonlyArray<PortCallInput>,
    fuelDeliveries: ReadonlyArray<FuelDeliveryInput>,
    noonReports: ReadonlyArray<NoonReportInput>,
    consumption: ReconciliationInput["canonical_consumption"],
    reportingYear: number,
  ): EdgeReconcilerResult;
}

export function createReconciliationEngine(): ReconciliationEngine {
  function reconcileVoyage(
    vesselId: string,
    voyage: VoyageInput,
    ais: ReadonlyArray<AisPositionInput>,
    portCalls: ReadonlyArray<PortCallInput>,
    fuelDeliveries: ReadonlyArray<FuelDeliveryInput>,
    noonReports: ReadonlyArray<NoonReportInput>,
    consumption: ReconciliationInput["canonical_consumption"],
    reportingYear: number,
  ): EdgeReconcilerResult {
    const aisResult = reconcileAisVoyage({ vessel_id: vesselId, voyage, ais_positions: ais, reporting_year: reportingYear });
    const portResult = reconcilePortCallVoyage({ vessel_id: vesselId, voyage, port_calls: portCalls, reporting_year: reportingYear });
    const fuelResult = reconcileFuelVoyage({ vessel_id: vesselId, voyage, fuel_deliveries: fuelDeliveries, reporting_year: reportingYear });
    const noonResult = reconcileNoonConsumption({ vessel_id: vesselId, voyage, noon_reports: noonReports, consumption_rows: consumption as never, reporting_year: reportingYear });
    const bdnResult = reconcileBdnConsumption({ vessel_id: vesselId, voyage, fuel_deliveries: fuelDeliveries, consumption_rows: consumption as never, reporting_year: reportingYear });

    return {
      edges: [...aisResult.edges, ...portResult.edges, ...fuelResult.edges, ...noonResult.edges, ...bdnResult.edges],
      findings: [...aisResult.findings, ...portResult.findings, ...fuelResult.findings, ...noonResult.findings, ...bdnResult.findings],
    };
  }

  function reconcile(input: ReconciliationInput): ReconciliationRunResult {
    const {
      vessel_id, reporting_year, voyages, ais_positions, port_calls,
      fuel_deliveries, noon_reports, canonical_consumption,
      mrv_snapshot, ets_snapshot, fueleu_snapshot,
      rule_version, tolerance_version, calculation_version,
    } = input;

    const allEdges: ReconciliationEdgeInput[] = [];
    const allFindings: ReconciliationFindingInput[] = [];

    for (const voyage of voyages) {
      const result = reconcileVoyage(vessel_id, voyage, ais_positions, port_calls, fuel_deliveries, noon_reports, canonical_consumption, reporting_year);
      allEdges.push(...result.edges);
      allFindings.push(...result.findings);
    }

    if (mrv_snapshot && ets_snapshot && fueleu_snapshot) {
      const crossResult = reconcileCrossRegulation({
        vessel_id,
        reporting_year,
        mrv_snapshot,
        ets_snapshot,
        fueleu_snapshot,
        canonical_consumption: canonical_consumption as never,
      });
      allEdges.push(...crossResult.edges);
      allFindings.push(...crossResult.findings);
    }

    const summary = buildSummary(allFindings, allEdges);

    const stampedFindings = allFindings.map((f) => ({
      ...f,
      rule_version: rule_version ?? f.rule_version,
      tolerance_version: tolerance_version ?? f.tolerance_version,
      calculation_version: calculation_version ?? f.calculation_version,
    }));

    return {
      vessel_id,
      reporting_year,
      run_at: new Date().toISOString(),
      edges: allEdges,
      findings: stampedFindings,
      summary,
    };
  }

  return { reconcile, reconcileVoyage };
}

function buildSummary(
  findings: ReadonlyArray<ReconciliationFindingInput>,
  edges: ReadonlyArray<ReconciliationEdgeInput>,
): ReconciliationSummary {
  const severityBreakdown: Record<Severity, number> = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const statusCounts: Record<string, number> = { MATCH: 0, MINOR_VARIANCE: 0, CONFLICT: 0, MISSING: 0, UNKNOWN: 0, REQUIRES_REVIEW: 0, RESOLVED: 0 };
  const edgeBreakdown: Record<string, Record<EdgeStatus, number>> = {};

  for (const f of findings) {
    severityBreakdown[f.severity]++;
    statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1;
  }

  for (const e of edges) {
    if (!edgeBreakdown[e.edge]) {
      edgeBreakdown[e.edge] = { MATCHED: 0, PARTIAL: 0, CONFLICT: 0, MISSING: 0, UNKNOWN: 0 };
    }
    const bucket = edgeBreakdown[e.edge]!;
    bucket[e.status]++;
  }

  return {
    total_findings: findings.length,
    match_count: statusCounts["MATCH"] ?? 0,
    variance_count: statusCounts["MINOR_VARIANCE"] ?? 0,
    conflict_count: statusCounts["CONFLICT"] ?? 0,
    missing_count: statusCounts["MISSING"] ?? 0,
    unknown_count: statusCounts["UNKNOWN"] ?? 0,
    requires_review_count: statusCounts["REQUIRES_REVIEW"] ?? 0,
    resolved_count: statusCounts["RESOLVED"] ?? 0,
    severity_breakdown: severityBreakdown,
    edge_breakdown: edgeBreakdown,
  };
}

export function toFindingInsert(finding: ReconciliationFindingInput, ruleVersion: string | null, toleranceVersion: string | null, calculationVersion: string | null): ReconciliationFindingInsert {
  return {
    reconciliation_key: finding.reconciliation_key,
    vessel_id: finding.vessel_id,
    voyage_id: finding.voyage_id,
    reporting_year: finding.reporting_year,
    reconciliation_type: finding.reconciliation_type,
    status: finding.status,
    severity: finding.severity,
    expected_value: finding.expected_value,
    observed_value: finding.observed_value,
    difference: finding.difference,
    tolerance: finding.tolerance,
    unit: finding.unit,
    source_record_ids: finding.source_record_ids,
    affected_regulation: finding.affected_regulation,
    explanation: finding.explanation,
    resolution_status: "UNRESOLVED",
    rule_version: ruleVersion ?? finding.rule_version,
    tolerance_version: toleranceVersion ?? finding.tolerance_version,
    calculation_version: calculationVersion ?? finding.calculation_version,
  };
}

export function toEdgeInsert(edge: ReconciliationEdgeInput): ReconciliationEdgeStatusInsert {
  return {
    vessel_id: edge.vessel_id,
    voyage_id: edge.voyage_id,
    reporting_year: edge.reporting_year,
    edge: edge.edge,
    status: edge.status,
    source_record_ids: edge.source_record_ids,
    target_record_ids: edge.target_record_ids,
    explanation: edge.explanation,
  };
}

export function deduplicateFindings(findings: ReadonlyArray<ReconciliationFindingInput>): ReadonlyArray<ReconciliationFindingInput> {
  const seen = new Set<string>();
  const result: ReconciliationFindingInput[] = [];
  for (const f of findings) {
    if (!seen.has(f.reconciliation_key)) {
      seen.add(f.reconciliation_key);
      result.push(f);
    }
  }
  return result;
}

export function mergeWithExisting(
  newFindings: ReadonlyArray<ReconciliationFindingInput>,
  existingKeys: ReadonlySet<string>,
): { readonly created: ReadonlyArray<ReconciliationFindingInput>; readonly skipped: number } {
  const created: ReconciliationFindingInput[] = [];
  let skipped = 0;
  for (const f of newFindings) {
    if (existingKeys.has(f.reconciliation_key)) {
      skipped++;
    } else {
      created.push(f);
    }
  }
  return { created, skipped };
}
