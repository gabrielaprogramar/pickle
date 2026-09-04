import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { ReconciliationEdgeInput, ReconciliationFindingInput, Severity, AffectedRegulation, ReconciliationType } from "./types";
import { DEFAULT_TOLERANCE_CONFIG } from "./types";
import { buildFindingKey } from "./keys";
import {
  AIS_VOYAGE_EDGE,
  PORTCALL_VOYAGE_EDGE,
  FUEL_VOYAGE_EDGE,
  NOON_VOYAGE_EDGE,
  NOON_CONSUMPTION_EDGE,
  BDN_CONSUMPTION_EDGE,
  CONSUMPTION_MRV_EDGE,
  CONSUMPTION_ETS_EDGE,
  CONSUMPTION_FUELEU_EDGE,
} from "./chain";

export interface EdgeReconcilerResult {
  readonly edges: ReadonlyArray<ReconciliationEdgeInput>;
  readonly findings: ReadonlyArray<ReconciliationFindingInput>;
}

const AIS_GAP_TOLERANCE_HOURS = 6;

function toIso(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function hoursOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start) / (1000 * 60 * 60);
}

function makeEdge(
  edge: string,
  vesselId: string,
  voyageId: string | null,
  reportingYear: number,
  status: ReconciliationEdgeInput["status"],
  sourceIds: ReadonlyArray<string>,
  targetIds: ReadonlyArray<string>,
  explanation: string,
): ReconciliationEdgeInput {
  return { edge, vessel_id: vesselId, voyage_id: voyageId, reporting_year: reportingYear, status, source_record_ids: sourceIds, target_record_ids: targetIds, explanation };
}

function makeFinding(
  reconciliationType: ReconciliationType,
  vesselId: string,
  voyageId: string | null,
  reportingYear: number,
  status: ReconciliationFindingInput["status"],
  severity: Severity,
  sourceIds: ReadonlyArray<string>,
  affectedRegulation: AffectedRegulation,
  explanation: string,
  expected: number | null,
  observed: number | null,
  tolerance: number | null,
  unit: string | null,
): ReconciliationFindingInput {
  const diff = expected !== null && observed !== null ? observed - expected : null;
  const key = buildFindingKey(vesselId, reconciliationType, sourceIds, reportingYear);
  return {
    reconciliation_key: key,
    reconciliation_type: reconciliationType,
    vessel_id: vesselId,
    voyage_id: voyageId,
    reporting_year: reportingYear,
    status,
    severity,
    expected_value: expected,
    observed_value: observed,
    difference: diff,
    tolerance,
    unit,
    source_record_ids: sourceIds,
    affected_regulation: affectedRegulation,
    explanation,
    rule_version: null,
    tolerance_version: null,
    calculation_version: null,
  };
}

function classifyVariance(
  expected: number,
  observed: number,
  absoluteTolerance: number,
  relativeTolerance: number,
): { status: ReconciliationFindingInput["status"]; severity: Severity } {
  if (Math.abs(observed - expected) <= absoluteTolerance) {
    return { status: "MATCH", severity: "INFO" };
  }
  if (expected !== 0 && Math.abs(observed - expected) / Math.abs(expected) <= relativeTolerance) {
    return { status: "MINOR_VARIANCE", severity: "LOW" };
  }
  if (expected !== 0 && Math.abs(observed - expected) / Math.abs(expected) <= relativeTolerance * 3) {
    return { status: "CONFLICT", severity: "MEDIUM" };
  }
  return { status: "CONFLICT", severity: "HIGH" };
}

export interface VoyageInput {
  readonly id: string;
  readonly vessel_id: string;
  readonly departure_time: string | null;
  readonly arrival_time: string | null;
  readonly departure_port: string | null;
  readonly arrival_port: string | null;
}

export interface AisPositionInput {
  readonly id: string;
  readonly vessel_id: string;
  readonly timestamp: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface PortCallInput {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly port: string | null;
  readonly country: string | null;
  readonly arrival_time: string | null;
  readonly departure_time: string | null;
}

export interface FuelDeliveryInput {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly fuel_type: string | null;
  readonly quantity: number | null;
  readonly delivery_date: string | null;
  readonly port: string | null;
}

export interface NoonReportInput {
  readonly id: string;
  readonly vessel_id: string;
  readonly report_date: string;
  readonly consumption: number | null;
  readonly fuel_type: string | null;
  readonly voyage_id: string | null;
}

export interface RegulatorySnapshot {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly total_consumption_mt: number;
  readonly fuel_by_type: Readonly<Record<string, number>>;
  readonly voyage_ids: ReadonlyArray<string>;
}

export interface ReconcileAisVoyageInput {
  readonly vessel_id: string;
  readonly voyage: VoyageInput;
  readonly ais_positions: ReadonlyArray<AisPositionInput>;
  readonly reporting_year: number;
}

export interface ReconcilePortCallVoyageInput {
  readonly vessel_id: string;
  readonly voyage: VoyageInput;
  readonly port_calls: ReadonlyArray<PortCallInput>;
  readonly reporting_year: number;
}

export interface ReconcileFuelVoyageInput {
  readonly vessel_id: string;
  readonly voyage: VoyageInput;
  readonly fuel_deliveries: ReadonlyArray<FuelDeliveryInput>;
  readonly reporting_year: number;
}

export interface ReconcileNoonConsumptionInput {
  readonly vessel_id: string;
  readonly voyage: VoyageInput;
  readonly noon_reports: ReadonlyArray<NoonReportInput>;
  readonly consumption_rows: ReadonlyArray<VoyageConsumptionRow>;
  readonly reporting_year: number;
}

export interface ReconcileBdnConsumptionInput {
  readonly vessel_id: string;
  readonly voyage: VoyageInput;
  readonly fuel_deliveries: ReadonlyArray<FuelDeliveryInput>;
  readonly consumption_rows: ReadonlyArray<VoyageConsumptionRow>;
  readonly reporting_year: number;
}

export interface ReconcileRegulatoryInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly mrv_snapshot: RegulatorySnapshot;
  readonly ets_snapshot: RegulatorySnapshot;
  readonly fueleu_snapshot: RegulatorySnapshot;
  readonly canonical_consumption: ReadonlyArray<VoyageConsumptionRow>;
}

export function reconcileAisVoyage(input: ReconcileAisVoyageInput): EdgeReconcilerResult {
  const { vessel_id, voyage, ais_positions, reporting_year } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];

  const voyageStart = toIso(voyage.departure_time);
  const voyageEnd = toIso(voyage.arrival_time);

  if (!voyageStart || !voyageEnd) {
    edges.push(makeEdge(AIS_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "UNKNOWN", [], [], "Voyage has no departure/arrival timestamps"));
    return { edges, findings };
  }

  const relevantAis = ais_positions.filter((a) => {
    const t = toIso(a.timestamp);
    if (!t) return false;
    const margin = 24 * 60 * 60 * 1000;
    return t.getTime() >= voyageStart.getTime() - margin && t.getTime() <= voyageEnd.getTime() + margin;
  });

  if (relevantAis.length === 0) {
    edges.push(makeEdge(AIS_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MISSING", [], [], "No AIS positions found near voyage time window"));
    findings.push(makeFinding("AIS_VOYAGE", vessel_id, voyage.id, reporting_year, "MISSING", "MEDIUM", [], "ALL", "Voyage exists but no AIS evidence covers its time window", null, null, null, null));
    return { edges, findings };
  }

  const sourceIds = relevantAis.map((a) => a.id);
  const voyageDuration = hoursBetween(voyageStart, voyageEnd);
  const gapHours: number[] = [];

  const sorted = [...relevantAis].sort((a, b) => {
    const ta = toIso(a.timestamp)?.getTime() ?? 0;
    const tb = toIso(b.timestamp)?.getTime() ?? 0;
    return ta - tb;
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = toIso(sorted[i - 1]!.timestamp);
    const curr = toIso(sorted[i]!.timestamp);
    if (prev && curr) gapHours.push(hoursBetween(prev, curr));
  }

  const maxGap = gapHours.length > 0 ? Math.max(...gapHours) : 0;

  if (maxGap > AIS_GAP_TOLERANCE_HOURS * 3) {
    edges.push(makeEdge(AIS_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "CONFLICT", sourceIds, [voyage.id], `AIS gap of ${maxGap.toFixed(1)}h exceeds ${(AIS_GAP_TOLERANCE_HOURS * 3).toFixed(1)}h threshold`));
    findings.push(makeFinding("AIS_VOYAGE", vessel_id, voyage.id, reporting_year, "CONFLICT", "HIGH", sourceIds, "ALL", `AIS evidence has a gap of ${maxGap.toFixed(1)}h during a ${voyageDuration.toFixed(1)}h voyage`, voyageDuration / Math.max(relevantAis.length, 1), maxGap, AIS_GAP_TOLERANCE_HOURS, "hours"));
  } else if (maxGap > AIS_GAP_TOLERANCE_HOURS) {
    edges.push(makeEdge(AIS_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, [voyage.id], `AIS gap of ${maxGap.toFixed(1)}h exceeds nominal ${AIS_GAP_TOLERANCE_HOURS}h`));
    findings.push(makeFinding("AIS_VOYAGE", vessel_id, voyage.id, reporting_year, "MINOR_VARIANCE", "LOW", sourceIds, "ALL", `AIS coverage partial: gap of ${maxGap.toFixed(1)}h`, voyageDuration / Math.max(relevantAis.length, 1), maxGap, AIS_GAP_TOLERANCE_HOURS, "hours"));
  } else {
    edges.push(makeEdge(AIS_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MATCHED", sourceIds, [voyage.id], `${relevantAis.length} AIS positions cover the voyage; max gap ${maxGap.toFixed(1)}h`));
  }

  return { edges, findings };
}

export function reconcilePortCallVoyage(input: ReconcilePortCallVoyageInput): EdgeReconcilerResult {
  const { vessel_id, voyage, port_calls, reporting_year } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];

  const voyageStart = toIso(voyage.departure_time);
  const voyageEnd = toIso(voyage.arrival_time);
  const relevantCalls = port_calls.filter((pc) => {
    if (pc.voyage_id === voyage.id) return true;
    const arr = toIso(pc.arrival_time);
    const dep = toIso(pc.departure_time);
    if (!arr || !dep || !voyageStart || !voyageEnd) return false;
    return hoursOverlap(voyageStart, voyageEnd, arr, dep) > 0;
  });

  if (relevantCalls.length === 0) {
    edges.push(makeEdge(PORTCALL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MISSING", [], [voyage.id], "No port calls linked to this voyage"));
    findings.push(makeFinding("PORTCALL_VOYAGE", vessel_id, voyage.id, reporting_year, "MISSING", "MEDIUM", [], "ALL", "Voyage has no linked port calls", null, null, null, null));
    return { edges, findings };
  }

  const sourceIds = relevantCalls.map((pc) => pc.id);
  const linkedCalls = relevantCalls.filter((pc) => pc.voyage_id === voyage.id);
  const unlinkedCalls = relevantCalls.filter((pc) => pc.voyage_id !== voyage.id);

  const departurePortMatch = linkedCalls.some((pc) => {
    if (!pc.port || !voyage.departure_port) return false;
    return pc.port.toLowerCase() === voyage.departure_port.toLowerCase();
  });

  const arrivalPortMatch = linkedCalls.some((pc) => {
    if (!pc.port || !voyage.arrival_port) return false;
    return pc.port.toLowerCase() === voyage.arrival_port.toLowerCase();
  });

  if (departurePortMatch && arrivalPortMatch) {
    edges.push(makeEdge(PORTCALL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MATCHED", sourceIds, [voyage.id], `Port calls confirm departure (${voyage.departure_port}) and arrival (${voyage.arrival_port})`));
  } else if (linkedCalls.length > 0) {
    const missing = !departurePortMatch ? "departure" : "arrival";
    edges.push(makeEdge(PORTCALL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, [voyage.id], `Port calls found but ${missing} port does not match voyage record`));
    findings.push(makeFinding("PORTCALL_VOYAGE", vessel_id, voyage.id, reporting_year, "MINOR_VARIANCE", "LOW", sourceIds, "ALL", `Voyage ${missing} port unmatched by port calls`, null, null, null, null));
  } else {
    edges.push(makeEdge(PORTCALL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, [voyage.id], "Port calls exist in time window but none are FK-linked to this voyage"));
    findings.push(makeFinding("PORTCALL_VOYAGE", vessel_id, voyage.id, reporting_year, "REQUIRES_REVIEW", "MEDIUM", sourceIds, "ALL", `${unlinkedCalls.length} port calls overlap this voyage but are not linked via FK`, null, null, null, null));
  }

  return { edges, findings };
}

export function reconcileFuelVoyage(input: ReconcileFuelVoyageInput): EdgeReconcilerResult {
  const { vessel_id, voyage, fuel_deliveries, reporting_year } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];

  const voyageStart = toIso(voyage.departure_time);
  const voyageEnd = toIso(voyage.arrival_time);

  const linked = fuel_deliveries.filter((fd) => fd.voyage_id === voyage.id);
  const overlapping = fuel_deliveries.filter((fd) => {
    if (fd.voyage_id === voyage.id) return false;
    const dd = toIso(fd.delivery_date);
    if (!dd || !voyageStart || !voyageEnd) return false;
    const margin = 7 * 24 * 60 * 60 * 1000;
    return dd.getTime() >= voyageStart.getTime() - margin && dd.getTime() <= voyageEnd.getTime() + margin;
  });

  const allRelevant = [...linked, ...overlapping];
  const sourceIds = allRelevant.map((fd) => fd.id);

  if (linked.length === 0 && overlapping.length === 0) {
    edges.push(makeEdge(FUEL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MISSING", [], [voyage.id], "No fuel deliveries found near this voyage"));
    return { edges, findings };
  }

  const duplicates = allRelevant.filter((fd) => {
    const matchCount = fuel_deliveries.filter(
      (other) => other.id !== fd.id && other.voyage_id === fd.voyage_id && fd.voyage_id !== null,
    ).length;
    return matchCount > 0;
  });

  const crossVoyageDuplicates = overlapping.filter((fd) => {
    if (fd.voyage_id !== null) return false;
    let otherVoyageCount = 0;
    for (const other of fuel_deliveries) {
      if (other.id === fd.id) continue;
      if (other.voyage_id !== null && other.voyage_id !== voyage.id) {
        const od = toIso(other.delivery_date);
        const dd = toIso(fd.delivery_date);
        if (od && dd && Math.abs(od.getTime() - dd.getTime()) < 7 * 24 * 60 * 60 * 1000) {
          otherVoyageCount++;
        }
      }
    }
    return otherVoyageCount > 0;
  });

  const allDuplicates = [...duplicates, ...crossVoyageDuplicates];

  if (allDuplicates.length > 0) {
    const dupIds = allDuplicates.map((d) => d.id);
    edges.push(makeEdge(FUEL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "CONFLICT", sourceIds, [voyage.id], `${allDuplicates.length} fuel deliveries appear duplicated across voyages`));
    findings.push(makeFinding("FUEL_DUPLICATE", vessel_id, voyage.id, reporting_year, "CONFLICT", "HIGH", dupIds, "ALL", `Fuel deliveries ${dupIds.join(", ")} are attributed to multiple voyages`, null, null, null, null));
  } else if (overlapping.length > 0 && linked.length === 0) {
    edges.push(makeEdge(FUEL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, [voyage.id], `${overlapping.length} deliveries overlap ±7d window but none are FK-linked`));
    findings.push(makeFinding("FUEL_VOYAGE", vessel_id, voyage.id, reporting_year, "REQUIRES_REVIEW", "MEDIUM", sourceIds, "ALL", "Fuel deliveries found in window but not linked to voyage", null, null, null, null));
  } else {
    edges.push(makeEdge(FUEL_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MATCHED", sourceIds, [voyage.id], `${linked.length} deliveries FK-linked to voyage`));
  }

  return { edges, findings };
}

export function reconcileNoonConsumption(input: ReconcileNoonConsumptionInput): EdgeReconcilerResult {
  const { vessel_id, voyage, noon_reports, consumption_rows, reporting_year } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];
  const sourceIds = noon_reports.map((nr) => nr.id);

  const voyageStart = toIso(voyage.departure_time);
  const voyageEnd = toIso(voyage.arrival_time);

  const relevantNoon = noon_reports.filter((nr) => {
    const rd = toIso(nr.report_date);
    if (!rd || !voyageStart || !voyageEnd) return false;
    return rd.getTime() >= voyageStart.getTime() - 24 * 60 * 60 * 1000 && rd.getTime() <= voyageEnd.getTime() + 24 * 60 * 60 * 1000;
  });

  if (relevantNoon.length === 0) {
    edges.push(makeEdge(NOON_VOYAGE_EDGE, vessel_id, voyage.id, reporting_year, "MISSING", [], [voyage.id], "No noon reports found near this voyage"));
    findings.push(makeFinding("NOON_VOYAGE", vessel_id, voyage.id, reporting_year, "MISSING", "MEDIUM", [], "ALL", "Voyage exists but no noon reports cover its period", null, null, null, null));
    return { edges, findings };
  }

  const noonWithNulls = relevantNoon.map((nr) => nr.consumption);
  const hasNullNoon = noonWithNulls.some((c) => c === null);
  const noonConsumption: number = noonWithNulls.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  const canonicalForVoyage = consumption_rows.filter((cr) => cr.voyage_id === voyage.id);
  const canonicalConsumption = canonicalForVoyage.reduce((sum, cr) => sum + cr.quantity_mt, 0);

  if (hasNullNoon && canonicalConsumption > 0) {
    edges.push(makeEdge(NOON_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, canonicalForVoyage.map((c) => c.id), "Some noon reports have null consumption — treated as partial evidence"));
    findings.push(makeFinding("NOON_CONSUMPTION", vessel_id, voyage.id, reporting_year, "REQUIRES_REVIEW", "LOW", sourceIds, "ALL", `Noon reports contain null consumption values; canonical is ${canonicalConsumption.toFixed(1)}t`, canonicalConsumption, noonConsumption, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
    return { edges, findings };
  }

  if (canonicalConsumption === 0 && noonConsumption === 0) {
    edges.push(makeEdge(NOON_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, "UNKNOWN", sourceIds, canonicalForVoyage.map((c) => c.id), "Both noon and canonical consumption are zero"));
    return { edges, findings };
  }

  const { status, severity } = classifyVariance(canonicalConsumption, noonConsumption, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, DEFAULT_TOLERANCE_CONFIG.FUEL_RELATIVE_PERCENT);
  const edgeStatus: ReconciliationEdgeInput["status"] = status === "MATCH" ? "MATCHED" : status === "MINOR_VARIANCE" ? "PARTIAL" : "CONFLICT";
  edges.push(makeEdge(NOON_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, edgeStatus, sourceIds, canonicalForVoyage.map((c) => c.id), `Noon: ${noonConsumption.toFixed(1)}t vs canonical: ${canonicalConsumption.toFixed(1)}t`));

  if (status !== "MATCH") {
    findings.push(makeFinding("NOON_CONSUMPTION", vessel_id, voyage.id, reporting_year, status, severity, sourceIds, "ALL", `Noon report consumption (${noonConsumption.toFixed(1)}t) vs canonical consumption (${canonicalConsumption.toFixed(1)}t)`, canonicalConsumption, noonConsumption, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
  }

  return { edges, findings };
}

export function reconcileBdnConsumption(input: ReconcileBdnConsumptionInput): EdgeReconcilerResult {
  const { vessel_id, voyage, fuel_deliveries, consumption_rows, reporting_year } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];

  const linkedDeliveries = fuel_deliveries.filter((fd) => fd.voyage_id === voyage.id);
  const bdnQuantities = linkedDeliveries.map((fd) => fd.quantity);
  const hasNullBdn = bdnQuantities.some((q) => q === null);
  const bdnQuantity: number = bdnQuantities.reduce<number>((sum, q) => sum + (q ?? 0), 0);
  const sourceIds = linkedDeliveries.map((fd) => fd.id);

  const canonicalForVoyage = consumption_rows.filter((cr) => cr.voyage_id === voyage.id);
  const canonicalQuantity = canonicalForVoyage.reduce((sum, cr) => sum + cr.quantity_mt, 0);
  const targetIds = canonicalForVoyage.map((c) => c.id);

  if (hasNullBdn && canonicalQuantity > 0) {
    edges.push(makeEdge(BDN_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, "PARTIAL", sourceIds, targetIds, "Some BDN deliveries have null quantity — treated as partial evidence"));
    findings.push(makeFinding("BDN_CONSUMPTION", vessel_id, voyage.id, reporting_year, "REQUIRES_REVIEW", "MEDIUM", sourceIds, "ALL", `BDN deliveries contain null quantities; canonical is ${canonicalQuantity.toFixed(1)}t`, canonicalQuantity, bdnQuantity, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
    return { edges, findings };
  }

  if (bdnQuantity === 0 && canonicalQuantity === 0) {
    edges.push(makeEdge(BDN_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, "UNKNOWN", sourceIds, targetIds, "Both BDN and canonical consumption are zero"));
    return { edges, findings };
  }

  if (bdnQuantity === 0) {
    edges.push(makeEdge(BDN_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, "MISSING", [], targetIds, "No BDN deliveries linked to this voyage but canonical consumption exists"));
    findings.push(makeFinding("BDN_CONSUMPTION", vessel_id, voyage.id, reporting_year, "MISSING", "HIGH", [], "ALL", `Canonical consumption ${canonicalQuantity.toFixed(1)}t has no linked BDN`, canonicalQuantity, 0, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
    return { edges, findings };
  }

  const { status, severity } = classifyVariance(canonicalQuantity, bdnQuantity, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, DEFAULT_TOLERANCE_CONFIG.FUEL_RELATIVE_PERCENT);
  const edgeStatus: ReconciliationEdgeInput["status"] = status === "MATCH" ? "MATCHED" : status === "MINOR_VARIANCE" ? "PARTIAL" : "CONFLICT";
  edges.push(makeEdge(BDN_CONSUMPTION_EDGE, vessel_id, voyage.id, reporting_year, edgeStatus, sourceIds, targetIds, `BDN: ${bdnQuantity.toFixed(1)}t vs canonical: ${canonicalQuantity.toFixed(1)}t`));

  if (status !== "MATCH") {
    findings.push(makeFinding("BDN_CONSUMPTION", vessel_id, voyage.id, reporting_year, status, severity, sourceIds, "ALL", `BDN delivery quantity (${bdnQuantity.toFixed(1)}t) vs canonical consumption (${canonicalQuantity.toFixed(1)}t)`, canonicalQuantity, bdnQuantity, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
  }

  return { edges, findings };
}

export function reconcileCrossRegulation(input: ReconcileRegulatoryInput): EdgeReconcilerResult {
  const { vessel_id, reporting_year, mrv_snapshot, ets_snapshot, fueleu_snapshot, canonical_consumption } = input;
  const edges: ReconciliationEdgeInput[] = [];
  const findings: ReconciliationFindingInput[] = [];

  const canonicalTotal = canonical_consumption.reduce((sum, c) => sum + c.quantity_mt, 0);

  const snapshots: Array<{ name: string; snapshot: RegulatorySnapshot; edge: string }> = [
    { name: "MRV", snapshot: mrv_snapshot, edge: CONSUMPTION_MRV_EDGE },
    { name: "ETS", snapshot: ets_snapshot, edge: CONSUMPTION_ETS_EDGE },
    { name: "FuelEU", snapshot: fueleu_snapshot, edge: CONSUMPTION_FUELEU_EDGE },
  ];

  for (const { name, snapshot, edge } of snapshots) {
    const fuelDiff = Math.abs(snapshot.total_consumption_mt - canonicalTotal);

    if (fuelDiff <= DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT) {
      edges.push(makeEdge(edge, vessel_id, null, reporting_year, "MATCHED", snapshot.voyage_ids as string[], [], `${name} consumption matches canonical (${snapshot.total_consumption_mt.toFixed(1)}t)`));
    } else {
      const { status, severity } = classifyVariance(canonicalTotal, snapshot.total_consumption_mt, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, DEFAULT_TOLERANCE_CONFIG.FUEL_RELATIVE_PERCENT);
      const edgeStatus: ReconciliationEdgeInput["status"] = status === "MATCH" ? "MATCHED" : status === "MINOR_VARIANCE" ? "PARTIAL" : "CONFLICT";
      edges.push(makeEdge(edge, vessel_id, null, reporting_year, edgeStatus, snapshot.voyage_ids as string[], [], `${name}: ${snapshot.total_consumption_mt.toFixed(1)}t vs canonical: ${canonicalTotal.toFixed(1)}t`));
      findings.push(makeFinding(`${name}_CONSUMPTION` as ReconciliationType, vessel_id, null, reporting_year, status, severity, snapshot.voyage_ids as string[], name as AffectedRegulation, `${name} consumption (${snapshot.total_consumption_mt.toFixed(1)}t) differs from canonical (${canonicalTotal.toFixed(1)}t) by ${fuelDiff.toFixed(1)}t`, canonicalTotal, snapshot.total_consumption_mt, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
    }
  }

  const allMatch = snapshots.every((s) => Math.abs(s.snapshot.total_consumption_mt - canonicalTotal) <= DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT);
  if (allMatch) {
    edges.push(makeEdge("CROSS_REGULATION", vessel_id, null, reporting_year, "MATCHED", [], [], "All three regulatory modules consume the same canonical quantity"));
  } else {
    const divergent = snapshots.filter((s) => Math.abs(s.snapshot.total_consumption_mt - canonicalTotal) > DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT);
    edges.push(makeEdge("CROSS_REGULATION", vessel_id, null, reporting_year, "CONFLICT", [], [], `${divergent.map((d) => d.name).join(", ")} diverge from canonical consumption`));
    findings.push(makeFinding("CROSS_REGULATION", vessel_id, null, reporting_year, "CONFLICT", "HIGH", [], "ALL", `Regulatory modules diverge: ${divergent.map((d) => `${d.name}=${d.snapshot.total_consumption_mt.toFixed(1)}t`).join("; ")} vs canonical=${canonicalTotal.toFixed(1)}t`, canonicalTotal, divergent[0]?.snapshot.total_consumption_mt ?? null, DEFAULT_TOLERANCE_CONFIG.FUEL_ABSOLUTE_MT, "metric_tonnes"));
  }

  return { edges, findings };
}
