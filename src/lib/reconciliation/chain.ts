import type { EdgeStatus, ReconciliationEdgeInput } from "./types";

export const AIS_VOYAGE_EDGE = "AIS→VOYAGE";
export const PORTCALL_VOYAGE_EDGE = "PORTCALL→VOYAGE";
export const FUEL_VOYAGE_EDGE = "FUEL→VOYAGE";
export const NOON_VOYAGE_EDGE = "NOON→VOYAGE";
export const NOON_CONSUMPTION_EDGE = "NOON→CONSUMPTION";
export const BDN_CONSUMPTION_EDGE = "BDN→CONSUMPTION";
export const CONSUMPTION_MRV_EDGE = "CONSUMPTION→MRV";
export const CONSUMPTION_ETS_EDGE = "CONSUMPTION→ETS";
export const CONSUMPTION_FUELEU_EDGE = "CONSUMPTION→FUELEU";

export const ALL_EDGES = [
  AIS_VOYAGE_EDGE,
  PORTCALL_VOYAGE_EDGE,
  FUEL_VOYAGE_EDGE,
  NOON_VOYAGE_EDGE,
  NOON_CONSUMPTION_EDGE,
  BDN_CONSUMPTION_EDGE,
  CONSUMPTION_MRV_EDGE,
  CONSUMPTION_ETS_EDGE,
  CONSUMPTION_FUELEU_EDGE,
] as const;

export type EvidenceChainEdge = (typeof ALL_EDGES)[number];

export interface ChainStatusTracker {
  getEdge(edge: EvidenceChainEdge): EdgeStatus;
  addEdge(input: ReconciliationEdgeInput): void;
  getEdges(): ReadonlyArray<ReconciliationEdgeInput>;
}

export function createChainStatusTracker(): ChainStatusTracker {
  const edgeMap = new Map<string, ReconciliationEdgeInput>();

  function worstStatus(current: EdgeStatus, candidate: EdgeStatus): EdgeStatus {
    const rank: Record<EdgeStatus, number> = {
      MATCHED: 0,
      PARTIAL: 1,
      UNKNOWN: 2,
      MISSING: 3,
      CONFLICT: 4,
    };
    return (rank[candidate] ?? 0) > (rank[current] ?? 0) ? candidate : current;
  }

  return {
    getEdge(edge) {
      const found = edgeMap.get(edge);
      return found?.status ?? "UNKNOWN";
    },
    addEdge(input) {
      const existing = edgeMap.get(input.edge);
      if (!existing) {
        edgeMap.set(input.edge, input);
        return;
      }
      const mergedStatus = worstStatus(existing.status, input.status);
      const mergedSourceIds = [...new Set([...existing.source_record_ids, ...input.source_record_ids])];
      const mergedTargetIds = [...new Set([...existing.target_record_ids, ...input.target_record_ids])];
      edgeMap.set(input.edge, {
        ...existing,
        status: mergedStatus,
        source_record_ids: mergedSourceIds,
        target_record_ids: mergedTargetIds,
        explanation: existing.status === mergedStatus
          ? existing.explanation
          : `${existing.explanation} | ${input.explanation}`,
      });
    },
    getEdges() {
      return [...edgeMap.values()];
    },
  };
}
