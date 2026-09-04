import type { ReconciliationType, ReconciliationFindingInput, ReconciliationEdgeInput } from "./types";

export function buildFindingKey(
  vesselId: string,
  reconciliationType: ReconciliationType,
  sourceIds: ReadonlyArray<string>,
  reportingYear: number,
): string {
  const sorted = [...sourceIds].sort().join(",");
  return `${vesselId}:${reconciliationType}:${sorted}:${reportingYear}`;
}

export function buildEdgeKey(
  vesselId: string,
  voyageId: string | null,
  edge: string,
  reportingYear: number,
): string {
  const vid = voyageId ?? "no-voyage";
  return `${vesselId}:${vid}:${edge}:${reportingYear}`;
}

export function isFindingIdempotent(
  existingKeys: ReadonlySet<string>,
  finding: ReconciliationFindingInput,
  vesselId: string,
): boolean {
  const key = buildFindingKey(
    vesselId,
    finding.reconciliation_type,
    finding.source_record_ids,
    finding.reporting_year,
  );
  return existingKeys.has(key);
}

export function keySet(findings: ReadonlyArray<{ reconciliation_key: string }>): ReadonlySet<string> {
  return new Set(findings.map((f) => f.reconciliation_key));
}
