/**
 * sox-eca/service.ts — orchestration for the SOx ECA compliance watch
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Pure evaluation lives in engine.ts; this service wires the I/O:
 *   zone ← environmental_zones (MED_SOX_ECA)
 *   position ← ais_positions (latest fix)
 *   evidence ← fuel_deliveries (BDN-derived, optional review enrichment)
 *   out ← evaluateSox → sox_compliance_events (append-only) + sox_watch_state
 *   notifications ← sox-eca notifications (only for new, non-duplicate events)
 */

import { evaluateSox } from "./engine";
import { evidenceFromFuelDelivery } from "./evidence";
import { toEnvironmentalZone } from "./zone";
import { buildSoxNotification } from "./notifications";
import { MED_SOX_ECA_CODE, SOX_PARAMETER_SET } from "./parameters";
import { SOX_ECA_VERSION } from "./types";
import type {
  SoxComplianceEvent,
  SoxComplianceEventInsert,
  SoxEvaluationInput,
  SoxEvaluationResult,
  SoxEventType,
  SoxEvidenceSource,
  SoxWatchState,
  SoxWatchStateInsert,
} from "./types";
import type { EnvironmentalZone } from "@/lib/geo";
import type { NotificationEvent } from "@/lib/notifications";

export interface SoxComplianceRepository {
  findLatestEvent(vesselId: string): Promise<SoxComplianceEvent | null>;
  findEventsByVesselId(vesselId: string, limit?: number): Promise<SoxComplianceEvent[]>;
  insertEvent(input: SoxComplianceEventInsert): Promise<SoxComplianceEvent>;
  findWatchState(vesselId: string): Promise<SoxWatchState | null>;
  upsertWatchState(input: SoxWatchStateInsert): Promise<SoxWatchState>;
}

interface ZoneRowLike {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly geometry_type: string;
  readonly geometry_coordinates: unknown;
  readonly description: string | null;
  readonly regulation_reference: string | null;
  readonly geometry_version: string;
  readonly jurisdiction: string | null;
  readonly effective_from: string;
  readonly effective_until: string | null;
  readonly is_active: boolean;
}

interface AisPositionLike {
  readonly id: string;
  readonly vessel_id: string;
  readonly ts: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface FuelDeliveryLike {
  readonly id: string;
  readonly document_id: string | null;
  readonly ocr_result_id: string | null;
  readonly ai_extraction_id: string | null;
  readonly delivery_date: string;
  readonly delivery_port: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly sulphur_content_pct: number | null;
  readonly status: string;
}

export interface SoxServiceDeps {
  readonly soxRepo: SoxComplianceRepository;
  readonly vesselRepo: { findByImo(imo: string): Promise<{ id: string; name: string } | null> };
  readonly zoneRepo?: { findByCode(code: string): Promise<ZoneRowLike | null> };
  readonly aisRepo?: { findLatestByVesselId(vesselId: string): Promise<AisPositionLike | null> };
  readonly fuelRepo?: { findByVesselId(vesselId: string): Promise<FuelDeliveryLike[]> };
  readonly notify?: { dispatch(event: NotificationEvent): Promise<unknown> };
  /** Optional per-delivery enrichment (document review state / AI confidence). */
  readonly enrichEvidence?: (delivery: FuelDeliveryLike) => {
    readonly review_state?: string | null;
    readonly ai_confidence?: number | null;
  };
}

export interface EvaluateOptions {
  readonly now?: string;
  readonly position?: SoxEvaluationInput["position"];
  readonly zone?: EnvironmentalZone | null;
  readonly deliveries?: ReadonlyArray<SoxEvidenceSource>;
  readonly trustedFuelInUse?: SoxEvaluationInput["trustedFuelInUse"];
  /** Persist events/watch state (default true). */
  readonly persist?: boolean;
}

export interface EvaluateOutcome {
  readonly evaluation: SoxEvaluationResult;
  readonly event: SoxComplianceEvent | null;
  readonly watchState: SoxWatchState | null;
  readonly wasDuplicated: boolean;
  readonly dispatchedNotifications: number;
}

export class SoxComplianceService {
  constructor(private readonly deps: SoxServiceDeps) {}

  async getWatch(imo: string): Promise<SoxWatchState | null> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return null;
    return this.deps.soxRepo.findWatchState(vessel.id);
  }

  async getEvents(imo: string, limit = 50): Promise<SoxComplianceEvent[]> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return [];
    return this.deps.soxRepo.findEventsByVesselId(vessel.id, limit);
  }

  async evaluate(imo: string, opts: EvaluateOptions = {}): Promise<EvaluateOutcome> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      throw new Error(`Vessel not found for IMO ${imo}`);
    }

    const persist = opts.persist ?? true;
    const now = opts.now ?? new Date().toISOString();

    let zone: EnvironmentalZone | null = null;
    if (opts.zone !== undefined) {
      zone = opts.zone;
    } else if (this.deps.zoneRepo) {
      const row = await this.deps.zoneRepo.findByCode(MED_SOX_ECA_CODE);
      zone = row ? toEnvironmentalZone(row) : null;
    }

    let position: SoxEvaluationInput["position"] = null;
    if (opts.position !== undefined) {
      position = opts.position;
    } else if (this.deps.aisRepo) {
      const fix = await this.deps.aisRepo.findLatestByVesselId(vessel.id);
      position = fix ? { id: fix.id, ts: fix.ts, lat: fix.latitude, lng: fix.longitude } : null;
    }

    let deliveries: ReadonlyArray<SoxEvidenceSource> = opts.deliveries ?? [];
    if (opts.deliveries === undefined && this.deps.fuelRepo) {
      const rows = await this.deps.fuelRepo.findByVesselId(vessel.id);
      deliveries = rows.map((row) => {
        const enrichment = this.deps.enrichEvidence?.(row) ?? null;
        return evidenceFromFuelDelivery(row, enrichment);
      });
    }

    const previousWatch = await this.deps.soxRepo.findWatchState(vessel.id);

    const evaluation = evaluateSox({
      vessel: { vesselId: vessel.id, imo, name: vessel.name },
      position,
      previousZoneState: previousWatch?.zone_state ?? null,
      zone,
      deliveries,
      now,
      trustedFuelInUse: opts.trustedFuelInUse,
    });

    if (!persist) {
      return {
        evaluation,
        event: null,
        watchState: previousWatch,
        wasDuplicated: false,
        dispatchedNotifications: 0,
      };
    }

    // ── Persistence ────────────────────────────────────────────────────────
    const latestEvent = await this.deps.soxRepo.findLatestEvent(vessel.id);
    const isTransition = evaluation.zoneState === "ENTRY" || evaluation.zoneState === "EXIT";
    const duplicated =
      !isTransition &&
      latestEvent !== null &&
      latestEvent.dedup_key !== null &&
      latestEvent.dedup_key === evaluation.dedupKey;

    if (duplicated) {
      return {
        evaluation,
        event: null,
        watchState: previousWatch,
        wasDuplicated: true,
        dispatchedNotifications: 0,
      };
    }

    const eventType = this.resolveEventType(evaluation, latestEvent);
    const eventInput: SoxComplianceEventInsert = {
      vessel_id: vessel.id,
      imo,
      event_ts: now,
      event_type: eventType,
      zone_state: evaluation.zoneState,
      watch_status: evaluation.watchStatus,
      severity: evaluation.severity,
      rule_id: evaluation.ruleResults[0]?.rule_id ?? null,
      rule_result: evaluation.ruleResults[0] ?? null,
      evidence_status: evaluation.evidenceStatus,
      inside_eca: evaluation.insideEca,
      eca_effective: evaluation.ecaEffective,
      latitude: position?.lat ?? null,
      longitude: position?.lng ?? null,
      ais_position_id: position?.id ?? null,
      applicable_limit_pct: evaluation.applicableLimitPct,
      sulphur_content_pct: evaluation.sulphurContentPct,
      selected_delivery_id: evaluation.selectedDeliveryId,
      parameter_version: SOX_PARAMETER_SET.version,
      geometry_version: zone?.geometryVersion ?? null,
      calculation_version: SOX_ECA_VERSION,
      details: {
        rule_results: evaluation.ruleResults.map((r) => ({
          rule_id: r.rule_id,
          kind: r.kind,
          severity: r.severity,
          explanation: r.explanation,
        })),
        review_required: evaluation.reviewRequired,
        ambiguous: evaluation.ambiguous,
        vessel_name: vessel.name,
      },
      dedup_key: evaluation.dedupKey,
    };

    const event = await this.deps.soxRepo.insertEvent(eventInput);

    const watchInput: SoxWatchStateInsert = {
      vessel_id: vessel.id,
      imo,
      status: evaluation.watchStatus,
      severity: evaluation.severity,
      inside_eca: evaluation.insideEca,
      eca_effective: evaluation.ecaEffective,
      zone_state: evaluation.zoneState,
      evidence_status: evaluation.evidenceStatus,
      applicable_limit_pct: evaluation.applicableLimitPct,
      sulphur_content_pct: evaluation.sulphurContentPct,
      selected_delivery_id: evaluation.selectedDeliveryId,
      last_entry_ts: this.nextLastEntry(previousWatch, evaluation),
      last_exit_ts: this.nextLastExit(previousWatch, evaluation),
      latest_event_id: event.id,
      parameter_version: SOX_PARAMETER_SET.version,
      geometry_version: zone?.geometryVersion ?? null,
      review_required: evaluation.reviewRequired,
      last_evaluated_at: now,
    };
    const watchState = await this.deps.soxRepo.upsertWatchState(watchInput);

    // ── Notifications (new events only) ────────────────────────────────────
    let dispatchedNotifications = 0;
    if (this.deps.notify) {
      const notification = buildSoxNotification({ evaluation, event });
      if (notification) {
        await this.deps.notify.dispatch(notification);
        dispatchedNotifications = 1;
      }
    }

    return {
      evaluation,
      event,
      watchState,
      wasDuplicated: false,
      dispatchedNotifications,
    };
  }

  private resolveEventType(
    evaluation: SoxEvaluationResult,
    latestEvent: SoxComplianceEvent | null,
  ): SoxEventType {
    if (evaluation.zoneState === "ENTRY") return "ENTRY";
    if (evaluation.zoneState === "EXIT") return "EXIT";
    if (evaluation.zoneState === "WITHIN") {
      if (
        latestEvent === null ||
        latestEvent.watch_status !== evaluation.watchStatus ||
        latestEvent.severity !== evaluation.severity
      ) {
        return "WATCH_CHANGE";
      }
      return "WITHIN";
    }
    return "EVALUATION";
  }

  private nextLastEntry(
    previous: SoxWatchState | null,
    evaluation: SoxEvaluationResult,
  ): string | null {
    if (evaluation.zoneState === "ENTRY") return evaluation.evaluatedAt;
    return previous?.last_entry_ts ?? null;
  }

  private nextLastExit(
    previous: SoxWatchState | null,
    evaluation: SoxEvaluationResult,
  ): string | null {
    if (evaluation.zoneState === "EXIT") return evaluation.evaluatedAt;
    return previous?.last_exit_ts ?? null;
  }
}
