/**
 * sox-eca/types.ts — Med SOx ECA / BDN sulphur compliance watch domain types
 * ────────────────────────────────────────────────────────────────────────────
 *
 * MARPOL Annex VI Regulation 14 — Mediterranean Sea SOx ECA (in force 2025-05-01).
 *
 * This module is a *deterministic* compliance watch: bunker delivery note (BDN)
 * sulphur evidence + AIS position + the existing Med SOx ECA geofence, evaluated
 * through fixed rules (SOX-ECA-01..06). Nothing here depends on an LLM.
 */

export const SOX_ECA_VERSION = "1.0.0";

/** Versioned regulatory parameter set — see parameters.ts. */
export const SOX_PARAMETER_VERSION = "2025.1";

export type SoxRuleId =
  | "SOX-ECA-01" // Zone transition detected (entry/exit/within)
  | "SOX-ECA-02" // Bunker evidence conforming vs applicable limit
  | "SOX-ECA-03" // Bunker evidence exceeds applicable limit
  | "SOX-ECA-04" // Inside ECA without usable bunker evidence
  | "SOX-ECA-05" // Conflicting / ambiguous / unreviewed evidence
  | "SOX-ECA-06"; // ECA geometry unavailable — no assertion possible

/** Deterministic evidence classification. */
export type EvidenceStatus =
  | "CONFORMING"
  | "NON_CONFORMING"
  | "INSUFFICIENT_EVIDENCE"
  | "UNKNOWN";

/** Current watch state for a vessel. */
export type WatchStatus =
  | "CLEAR"
  | "WARNING"
  | "NON_CONFORMING"
  | "NO_EVIDENCE"
  | "UNKNOWN";

export type WatchSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

/** Geometric relationship between the vessel and the ECA. */
export type ZoneState = "OUTSIDE" | "ENTRY" | "WITHIN" | "EXIT";

export type SoxEventType =
  | "ENTRY"
  | "EXIT"
  | "WITHIN"
  | "WATCH_CHANGE"
  | "EVALUATION";

export type SoxRuleResultKind =
  | "CONFORMING"
  | "NON_CONFORMING"
  | "NO_EVIDENCE"
  | "REVIEW_REQUIRED"
  | "NOTICE"
  | "NOT_APPLICABLE";

export interface SoxRuleResult {
  readonly rule_id: SoxRuleId;
  readonly kind: SoxRuleResultKind;
  readonly severity: WatchSeverity;
  readonly explanation: string;
  /** Where the inputs came from (e.g. "BDN OCR", "fuel_deliveries", "geo engine"). */
  readonly source: string;
}

/** Provenance chain for a bunker sulphur value. */
export interface SoxEvidenceSource {
  readonly fuel_delivery_id: string;
  readonly document_id: string | null;
  readonly ocr_result_id: string | null;
  readonly ai_extraction_id: string | null;
  readonly delivery_date: string;
  readonly delivery_port: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly sulphur_content_pct: number | null;
  readonly delivery_status: string;
  /** Document review state when known (uploaded/under_review/approved/rejected). */
  readonly review_state: string | null;
  readonly ai_confidence: number | null;
  readonly source: string;
}

/** Deterministic bunker-selection outcome. */
export interface BunkerEvidenceSelection {
  readonly selected: SoxEvidenceSource | null;
  readonly state: "READY" | "NO_EVIDENCE" | "NO_SULPHUR" | "REVIEW_REQUIRED";
  readonly ambiguous: boolean;
  readonly reviewRequired: boolean;
  readonly candidateCount: number;
  readonly usableCount: number;
  readonly reasons: ReadonlyArray<string>;
}

/** Inputs for a single deterministic watch evaluation. */
export interface SoxEvaluationInput {
  readonly vessel: { readonly vesselId: string; readonly imo: string; readonly name: string };
  readonly position: { readonly id: string | null; readonly ts: string; readonly lat: number; readonly lng: number } | null;
  readonly previousZoneState: ZoneState | null;
  readonly zone: import("@/lib/geo").EnvironmentalZone | null;
  readonly deliveries: ReadonlyArray<SoxEvidenceSource>;
  readonly now?: string;
  /**
   * Trusted fuel-in-use evidence (e.g. verified fuel-changeover record). BDN is
   * evidence of *delivered* fuel, not fuel-in-use, so this is the only path that
   * may reach CRITICAL severity. Optional.
   */
  readonly trustedFuelInUse?: {
    readonly sulphurContentPct: number;
    readonly source: string;
  } | null;
}

/** The deterministic rule output. */
export interface SoxEvaluationResult {
  readonly evaluatedAt: string;
  readonly vessel: { readonly vesselId: string; readonly imo: string; readonly name: string };
  readonly insideEca: boolean;
  readonly ecaEffective: boolean;
  readonly geometryAvailable: boolean;
  readonly zoneState: ZoneState;
  readonly evidenceStatus: EvidenceStatus | null;
  readonly reviewRequired: boolean;
  readonly ambiguous: boolean;
  readonly applicableLimitPct: number | null;
  readonly sulphurContentPct: number | null;
  readonly selectedDeliveryId: string | null;
  readonly watchStatus: WatchStatus;
  readonly severity: WatchSeverity;
  readonly ruleResults: ReadonlyArray<SoxRuleResult>;
  /** Stable key used to de-duplicate repeated evaluations. */
  readonly dedupKey: string;
}

/** A compliance event persisted to sox_compliance_events. */
export interface SoxComplianceEvent {
  readonly id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: SoxEventType;
  readonly zone_state: ZoneState;
  readonly watch_status: WatchStatus;
  readonly severity: WatchSeverity;
  readonly rule_id: SoxRuleId | null;
  readonly rule_result: SoxRuleResult | null;
  readonly evidence_status: EvidenceStatus | null;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly ais_position_id: string | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly calculation_version: string;
  readonly details: Record<string, unknown>;
  readonly dedup_key: string | null;
  readonly created_at: string;
}

/** Insert payload for sox_compliance_events (id/created_at server-defaulted). */
export interface SoxComplianceEventInsert {
  readonly vessel_id: string;
  readonly imo: string;
  readonly event_ts: string;
  readonly event_type: SoxEventType;
  readonly zone_state: ZoneState;
  readonly watch_status: WatchStatus;
  readonly severity: WatchSeverity;
  readonly rule_id: SoxRuleId | null;
  readonly rule_result: SoxRuleResult | null;
  readonly evidence_status: EvidenceStatus | null;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly ais_position_id: string | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly calculation_version: string;
  readonly details: Record<string, unknown>;
  readonly dedup_key: string | null;
}

/** Current persisted watch state (sox_watch_state). */
export interface SoxWatchState {
  readonly vessel_id: string;
  readonly imo: string;
  readonly status: WatchStatus;
  readonly severity: WatchSeverity;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly zone_state: ZoneState;
  readonly evidence_status: EvidenceStatus | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly last_entry_ts: string | null;
  readonly last_exit_ts: string | null;
  readonly latest_event_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly review_required: boolean;
  readonly last_evaluated_at: string;
  readonly updated_at: string;
}

export interface SoxWatchStateInsert {
  readonly vessel_id: string;
  readonly imo: string;
  readonly status: WatchStatus;
  readonly severity: WatchSeverity;
  readonly inside_eca: boolean;
  readonly eca_effective: boolean;
  readonly zone_state: ZoneState;
  readonly evidence_status: EvidenceStatus | null;
  readonly applicable_limit_pct: number | null;
  readonly sulphur_content_pct: number | null;
  readonly selected_delivery_id: string | null;
  readonly last_entry_ts: string | null;
  readonly last_exit_ts: string | null;
  readonly latest_event_id: string | null;
  readonly parameter_version: string;
  readonly geometry_version: string | null;
  readonly review_required: boolean;
  readonly last_evaluated_at: string;
}
