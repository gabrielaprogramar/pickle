export type ReconciliationStatus =
  | "MATCH"
  | "MINOR_VARIANCE"
  | "CONFLICT"
  | "MISSING"
  | "UNKNOWN"
  | "REQUIRES_REVIEW"
  | "RESOLVED";

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReconciliationType =
  | "AIS_VOYAGE"
  | "PORTCALL_VOYAGE"
  | "FUEL_VOYAGE"
  | "NOON_VOYAGE"
  | "NOON_CONSUMPTION"
  | "BDN_CONSUMPTION"
  | "BDN_FUEL_TYPE"
  | "MRV_CONSUMPTION"
  | "ETS_CONSUMPTION"
  | "FUELEU_CONSUMPTION"
  | "CROSS_REGULATION"
  | "FUEL_DUPLICATE";

export type EdgeStatus =
  | "MATCHED"
  | "PARTIAL"
  | "CONFLICT"
  | "MISSING"
  | "UNKNOWN";

export type AffectedRegulation = "MRV" | "EU_ETS" | "FUEL_EU" | "ALL";

export type ResolutionStatus =
  | "UNRESOLVED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export interface ReconciliationFinding {
  readonly id: string;
  readonly reconciliation_key: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly reconciliation_type: ReconciliationType;
  readonly status: ReconciliationStatus;
  readonly severity: Severity;
  readonly expected_value: number | null;
  readonly observed_value: number | null;
  readonly difference: number | null;
  readonly tolerance: number | null;
  readonly unit: string | null;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly affected_regulation: AffectedRegulation;
  readonly explanation: string;
  readonly resolution_status: ResolutionStatus;
  readonly resolution_actor: string | null;
  readonly resolution_reason: string | null;
  readonly resolution_at: string | null;
  readonly audit_log_id: string | null;
  readonly rule_version: string | null;
  readonly tolerance_version: string | null;
  readonly calculation_version: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReconciliationFindingInsert {
  readonly reconciliation_key: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly reconciliation_type: ReconciliationType;
  readonly status: ReconciliationStatus;
  readonly severity: Severity;
  readonly expected_value: number | null;
  readonly observed_value: number | null;
  readonly difference: number | null;
  readonly tolerance: number | null;
  readonly unit: string | null;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly affected_regulation: AffectedRegulation;
  readonly explanation: string;
  readonly resolution_status?: ResolutionStatus;
  readonly rule_version?: string | null;
  readonly tolerance_version?: string | null;
  readonly calculation_version?: string | null;
}

export interface ReconciliationEdgeStatus {
  readonly id: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly edge: string;
  readonly status: EdgeStatus;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly target_record_ids: ReadonlyArray<string>;
  readonly explanation: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReconciliationEdgeStatusInsert {
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly edge: string;
  readonly status: EdgeStatus;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly target_record_ids: ReadonlyArray<string>;
  readonly explanation: string;
}

export interface ReconciliationRule {
  readonly id: string;
  readonly rule_type: ReconciliationType;
  readonly rule_key: string;
  readonly tolerance_value: number;
  readonly tolerance_unit: string;
  readonly severity_override: Severity | null;
  readonly enabled: boolean;
  readonly version: number;
  readonly effective_from: string;
  readonly effective_until: string | null;
  readonly created_at: string;
}

export interface ReconciliationRuleInsert {
  readonly rule_type: ReconciliationType;
  readonly rule_key: string;
  readonly tolerance_value: number;
  readonly tolerance_unit: string;
  readonly severity_override?: Severity | null;
  readonly enabled?: boolean;
  readonly version?: number;
  readonly effective_from?: string;
  readonly effective_until?: string | null;
}

export interface ReconciliationEdgeInput {
  readonly edge: string;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly status: EdgeStatus;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly target_record_ids: ReadonlyArray<string>;
  readonly explanation: string;
}

export interface ReconciliationFindingInput {
  readonly reconciliation_key: string;
  readonly reconciliation_type: ReconciliationType;
  readonly vessel_id: string;
  readonly voyage_id: string | null;
  readonly reporting_year: number;
  readonly status: ReconciliationStatus;
  readonly severity: Severity;
  readonly expected_value: number | null;
  readonly observed_value: number | null;
  readonly difference: number | null;
  readonly tolerance: number | null;
  readonly unit: string | null;
  readonly source_record_ids: ReadonlyArray<string>;
  readonly affected_regulation: AffectedRegulation;
  readonly explanation: string;
  readonly rule_version: string | null;
  readonly tolerance_version: string | null;
  readonly calculation_version: string | null;
}

export interface ReconciliationRunResult {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly run_at: string;
  readonly edges: ReadonlyArray<ReconciliationEdgeInput>;
  readonly findings: ReadonlyArray<ReconciliationFindingInput>;
  readonly summary: ReconciliationSummary;
}

export interface ReconciliationSummary {
  readonly total_findings: number;
  readonly match_count: number;
  readonly variance_count: number;
  readonly conflict_count: number;
  readonly missing_count: number;
  readonly unknown_count: number;
  readonly requires_review_count: number;
  readonly resolved_count: number;
  readonly severity_breakdown: Readonly<Record<Severity, number>>;
  readonly edge_breakdown: Readonly<Record<string, Readonly<Record<EdgeStatus, number>>>>;
}

export const DEFAULT_TOLERANCE_CONFIG = {
  CO2_ABSOLUTE_TONNES: 1.0,
  CO2_RELATIVE_PERCENT: 0.05,
  FUEL_ABSOLUTE_MT: 0.5,
  FUEL_RELATIVE_PERCENT: 0.03,
  TIME_ABSOLUTE_HOURS: 2.0,
  DISTANCE_ABSOLUTE_NM: 5.0,
  PORT_MATCH_MIN_CONFIDENCE: 0.8,
} as const;

export type ReconciliationToleranceConfig = typeof DEFAULT_TOLERANCE_CONFIG;
