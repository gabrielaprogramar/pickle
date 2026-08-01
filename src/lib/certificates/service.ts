/**
 * certificates/service.ts — orchestration for the certificate & statutory document registry
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Wires the deterministic domain (status engine + requirements service) to the
 * repository. Pure derivation lives in status-engine.ts / requirements.ts; this
 * layer performs I/O, supersession, review routing, and deterministic event
 * emission (deduplicated via dedup_key).
 */

import type { NotificationEvent } from "@/lib/notifications";
import {
  buildCertificateNotification,
  certificateNotificationTypeForEvent,
} from "./notifications";
import { DEFAULT_CERTIFICATE_THRESHOLDS } from "./types";
import type {
  CertificateEvent,
  CertificateEventInsert,
  CertificateRecord,
  CertificateRecordInsert,
  CertificateSource,
  CertificateStatus,
  CertificateThresholds,
} from "./types";
import { CERTIFICATE_REASON_CODES } from "./types";
import { buildExpiryDedupKey, deriveStatus, severityForEvent } from "./status-engine";
import { placeholderRecordFor, evaluateRequirements } from "./requirements";
import type { VesselCertProfile } from "./requirements";

export interface CertificateRepository {
  findById(id: string): Promise<CertificateRecord | null>;
  findByVesselId(
    vesselId: string,
    opts?: { readonly onlyCurrent?: boolean; readonly status?: string; readonly certificateType?: string },
  ): Promise<CertificateRecord[]>;
  findByVesselAndType(vesselId: string, certificateType: string): Promise<CertificateRecord | null>;
  findExpiringWithinDays(vesselId: string, withinDays: number, now: string): Promise<CertificateRecord[]>;
  findExpired(vesselId: string, now: string): Promise<CertificateRecord[]>;
  insert(input: CertificateRecordInsert): Promise<CertificateRecord>;
  update(id: string, patch: Partial<CertificateRecordInsert>): Promise<CertificateRecord>;
  findEventsByVesselId(vesselId: string, limit?: number): Promise<CertificateEvent[]>;
  findEventsByCertificateId(certificateId: string, limit?: number): Promise<CertificateEvent[]>;
  insertEvent(input: CertificateEventInsert): Promise<CertificateEvent>;
}

export interface CertificateVessel {
  readonly id: string;
  readonly name: string;
  readonly gt?: number | null;
  readonly vesselType?: "commercial" | "private" | "unknown";
  readonly ballastTanks?: boolean | null;
}

export interface CertificateServiceDeps {
  readonly certRepo: CertificateRepository;
  readonly vesselRepo: { findByImo(imo: string): Promise<CertificateVessel | null> };
  readonly notify?: { dispatch(event: NotificationEvent): Promise<unknown> };
  readonly thresholds?: CertificateThresholds;
}

/** A registry record with freshly derived status (response shape). */
export interface CertificateView {
  readonly record: CertificateRecord;
  readonly status: CertificateStatus;
  readonly reasonCode: string | null;
  readonly blocking: boolean;
  readonly reviewRequired: boolean;
  readonly daysUntilExpiry: number | null;
}

export interface RegisterCertificateInput {
  readonly documentId?: string | null;
  readonly certificateType: string;
  readonly certificateNumber?: string | null;
  readonly issuingAuthority?: string | null;
  readonly classSociety?: string | null;
  readonly issueDate?: string | null;
  readonly expiryDate?: string | null;
  readonly source: CertificateSource;
  readonly confidence?: number | null;
  readonly notes?: string | null;
  /** IMO read off the evidence document (document_entities 'imo_number'). */
  readonly documentImo?: string | null;
}

export interface RegisterOutcome {
  readonly record: CertificateRecord;
  readonly supersededRecord: CertificateRecord | null;
  readonly wasSuperseded: boolean;
  readonly event: CertificateEvent | null;
  readonly dispatchedNotifications: number;
}

export interface EvaluateOutcome {
  readonly vessel: CertificateVessel;
  readonly views: ReadonlyArray<CertificateView>;
  readonly emittedEvents: ReadonlyArray<CertificateEvent>;
  readonly dispatchedNotifications: number;
}

export interface ReviewDecision {
  readonly decision: "approved" | "rejected";
  readonly reviewNote?: string | null;
}

export function viewFor(
  record: CertificateRecord,
  now: string,
  thresholds: CertificateThresholds,
): CertificateView {
  const placeholder =
    record.source === "unknown" &&
    (record.reason_code === CERTIFICATE_REASON_CODES.MISSING_DOCUMENT ||
      record.reason_code === CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY);
  const d = deriveStatus(
    {
      reviewStatus: record.review_status,
      validationStatus: record.validation_status,
      reviewRequired: record.review_required,
      blocking: record.blocking,
      reasonCode: record.reason_code,
      expiryDate: record.expiry_date,
      issueDate: record.issue_date,
      placeholder,
    },
    thresholds,
    now,
  );
  return {
    record,
    status: d.status,
    reasonCode: d.reasonCode,
    blocking: d.blocking,
    reviewRequired: d.reviewRequired,
    daysUntilExpiry: record.expiry_date
      ? Math.floor(
          (new Date(record.expiry_date + "T00:00:00.000Z").getTime() -
            new Date(now.slice(0, 10) + "T00:00:00.000Z").getTime()) /
            86_400_000,
        )
      : null,
  };
}

export class CertificateService {
  private readonly thresholds: CertificateThresholds;

  constructor(private readonly deps: CertificateServiceDeps) {
    this.thresholds = deps.thresholds ?? DEFAULT_CERTIFICATE_THRESHOLDS;
  }

  async getCertificates(imo: string, now?: string): Promise<CertificateView[]> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return [];
    const nowIso = now ?? new Date().toISOString();
    const rows = await this.deps.certRepo.findByVesselId(vessel.id, { onlyCurrent: true });
    return rows.map((r) => viewFor(r, nowIso, this.thresholds));
  }

  async getCertificateById(id: string, now?: string): Promise<CertificateView | null> {
    const row = await this.deps.certRepo.findById(id);
    if (!row) return null;
    return viewFor(row, now ?? new Date().toISOString(), this.thresholds);
  }

  async getExpiring(imo: string, withinDays?: number, now?: string): Promise<CertificateView[]> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return [];
    const nowIso = now ?? new Date().toISOString();
    const window = withinDays ?? this.thresholds.expiringSoonDays;
    const rows = await this.deps.certRepo.findExpiringWithinDays(vessel.id, window, nowIso);
    return rows
      .map((r) => viewFor(r, nowIso, this.thresholds))
      .filter((v) => v.status === "EXPIRING_SOON");
  }

  async getExpired(imo: string, now?: string): Promise<CertificateView[]> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return [];
    const nowIso = now ?? new Date().toISOString();
    const rows = await this.deps.certRepo.findExpired(vessel.id, nowIso);
    return rows
      .map((r) => viewFor(r, nowIso, this.thresholds))
      .filter((v) => v.status === "EXPIRED");
  }

  /**
   * Register a certificate record derived from a document. Deterministic guards:
   *   • document IMO mismatch        → PENDING_REVIEW, blocking, REVIEW_REQUIRED
   *   • missing expiry date          → PENDING_REVIEW (never invent a date)
   *   • existing current record      → superseded (version +1, REPLACED event)
   */
  async registerFromDocument(
    imo: string,
    input: RegisterCertificateInput,
    now?: string,
  ): Promise<RegisterOutcome> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) throw new Error(`Vessel not found for IMO ${imo}`);

    const nowIso = now ?? new Date().toISOString();
    const blocking = input.documentImo != null && input.documentImo !== imo;
    const missingExpiry = input.expiryDate == null;

    const derived = deriveStatus(
      {
        reviewStatus: null,
        validationStatus: "valid",
        reviewRequired: blocking || missingExpiry,
        blocking,
        reasonCode: blocking
          ? CERTIFICATE_REASON_CODES.IMO_MISMATCH
          : missingExpiry
            ? CERTIFICATE_REASON_CODES.MISSING_EXPIRY
            : null,
        expiryDate: input.expiryDate ?? null,
        issueDate: input.issueDate ?? null,
      },
      this.thresholds,
      nowIso,
    );

    const existing = await this.deps.certRepo.findByVesselAndType(vessel.id, input.certificateType);
    const superseded = existing ?? null;

    const insert: CertificateRecordInsert = {
      vessel_id: vessel.id,
      imo,
      document_id: input.documentId ?? null,
      certificate_type: input.certificateType,
      certificate_number: input.certificateNumber ?? null,
      issuing_authority: input.issuingAuthority ?? null,
      class_society: input.classSociety ?? null,
      issue_date: input.issueDate ?? null,
      expiry_date: input.expiryDate ?? null,
      status: derived.status,
      source: input.source,
      validation_status: "valid",
      review_status: derived.reviewRequired ? "PENDING" : "NOT_REQUIRED",
      review_required: derived.reviewRequired,
      blocking: derived.blocking,
      reason_code: derived.reasonCode,
      confidence: input.confidence ?? null,
      notes: input.notes ?? null,
      version: superseded ? superseded.version + 1 : 1,
      supersedes_id: superseded ? superseded.id : null,
      is_current: true,
    };

    let supersededRecord: CertificateRecord | null = null;
    let wasSuperseded = false;
    if (superseded) {
      await this.deps.certRepo.update(superseded.id, { is_current: false });
      supersededRecord = { ...superseded, is_current: false };
      wasSuperseded = true;
    }

    const record = await this.deps.certRepo.insert(insert);
    const event = await this.emit(
      {
        certificate_id: record.id,
        vessel_id: vessel.id,
        imo,
        event_ts: nowIso,
        event_type: wasSuperseded ? "REPLACED" : "CREATED",
        severity: severityForEvent(wasSuperseded ? "REPLACED" : "CREATED", blocking),
        previous_status: superseded?.status ?? null,
        new_status: record.status,
        reason_code: record.reason_code,
        details: {
          version: record.version,
          supersedes: superseded?.id ?? null,
          certificate_type: record.certificate_type,
          expiry_date: record.expiry_date,
        },
        dedup_key: null,
      },
      record,
      nowIso,
    );

    return {
      record,
      supersededRecord,
      wasSuperseded,
      event,
      dispatchedNotifications:
        event !== null && (event.event_type === "CREATED" || event.event_type === "UPDATED") ? 0 : 1,
    };
  }

  /**
   * Re-evaluate every current record: refresh the stored status snapshot and
   * emit deterministic expiry/review events when the derived status changed.
   * Events are deduplicated by dedup_key (latest event for the certificate).
   */
  async evaluate(imo: string, opts: { readonly now?: string } = {}): Promise<EvaluateOutcome> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) throw new Error(`Vessel not found for IMO ${imo}`);

    const nowIso = opts.now ?? new Date().toISOString();
    const rows = await this.deps.certRepo.findByVesselId(vessel.id, { onlyCurrent: true });
    const emitted: CertificateEvent[] = [];
    let dispatched = 0;

    const views: CertificateView[] = [];
    for (const row of rows) {
      const view = viewFor(row, nowIso, this.thresholds);
      views.push(view);

      if (view.status === row.status && view.reasonCode === row.reason_code) {
        continue;
      }

      await this.deps.certRepo.update(row.id, {
        status: view.status,
        reason_code: view.reasonCode,
        blocking: view.blocking,
        review_required: view.reviewRequired,
      });

      const eventType = this.eventTypeForTransition(row.status, view.status);
      if (!eventType) continue;

      const event = await this.emit(
        {
          certificate_id: row.id,
          vessel_id: vessel.id,
          imo,
          event_ts: nowIso,
          event_type: eventType,
          severity: severityForEvent(eventType, view.blocking),
          previous_status: row.status,
          new_status: view.status,
          reason_code: view.reasonCode,
          details: {
            certificate_type: row.certificate_type,
            expiry_date: row.expiry_date,
            days_remaining: view.daysUntilExpiry,
          },
          dedup_key: buildExpiryDedupKey(vessel.id, row.certificate_type, view.status),
        },
        { ...row, status: view.status },
        nowIso,
      );
      if (event) {
        emitted.push(event);
        dispatched += 1;
      }
    }

    return { vessel, views, emittedEvents: emitted, dispatchedNotifications: dispatched };
  }

  /**
   * Requirements reconciliation: materialize MISSING/UNKNOWN placeholder records
   * for known requirements that have no current evidence. Deterministic and
   * source-driven (requirements.ts); deduplicated by certificate type.
   */
  async reconcileRequirements(
    imo: string,
    profile: VesselCertProfile,
    opts: { readonly now?: string } = {},
  ): Promise<EvaluateOutcome> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) throw new Error(`Vessel not found for IMO ${imo}`);

    const nowIso = opts.now ?? new Date().toISOString();
    const rows = await this.deps.certRepo.findByVesselId(vessel.id, { onlyCurrent: true });
    const presentTypes = new Set(rows.map((r) => r.certificate_type));
    const specs = evaluateRequirements(profile);
    const emitted: CertificateEvent[] = [];
    let dispatched = 0;

    for (const spec of specs) {
      if (spec.applicability === "NOT_REQUIRED") continue;
      if (presentTypes.has(spec.certificate_type)) continue;

      const placeholder = placeholderRecordFor(spec, { vessel_id: vessel.id, imo });
      const record = await this.deps.certRepo.insert({
        ...placeholder,
        vessel_id: vessel.id,
        imo,
        document_id: null,
        validation_status: "pending",
        review_status: placeholder.review_required ? "PENDING" : "NOT_REQUIRED",
        blocking: false,
        confidence: null,
      });
      const eventType = placeholder.status === "MISSING" ? "MISSING" : "REVIEW_REQUIRED";
      const event = await this.emit(
        {
          certificate_id: record.id,
          vessel_id: vessel.id,
          imo,
          event_ts: nowIso,
          event_type: eventType,
          severity: severityForEvent(eventType, false),
          previous_status: null,
          new_status: record.status,
          reason_code: record.reason_code,
          details: {
            certificate_type: record.certificate_type,
            reference: spec.reference,
            source: spec.source,
            applicability: spec.applicability,
          },
          dedup_key: buildExpiryDedupKey(vessel.id, record.certificate_type, record.status),
        },
        record,
        nowIso,
      );
      if (event) {
        emitted.push(event);
        dispatched += 1;
      }
    }

    const views = await this.getCertificates(imo, nowIso);
    return { vessel, views, emittedEvents: emitted, dispatchedNotifications: dispatched };
  }

  /** Resolve a pending review decision (approved/rejected) and refresh status. */
  async applyReviewDecision(
    certificateId: string,
    decision: ReviewDecision,
    now?: string,
  ): Promise<CertificateView> {
    const row = await this.deps.certRepo.findById(certificateId);
    if (!row) throw new Error(`Certificate record not found: ${certificateId}`);

    const nowIso = now ?? new Date().toISOString();
    const reviewStatus = decision.decision === "approved" ? "APPROVED" : "REJECTED";
    const derived = deriveStatus(
      {
        reviewStatus,
        validationStatus: row.validation_status,
        reviewRequired: decision.decision === "approved" ? false : row.review_required,
        blocking: row.blocking,
        reasonCode: row.reason_code,
        expiryDate: row.expiry_date,
        issueDate: row.issue_date,
      },
      this.thresholds,
      nowIso,
    );

    const updated = await this.deps.certRepo.update(row.id, {
      review_status: reviewStatus,
      review_required: derived.reviewRequired,
      status: derived.status,
      reason_code: derived.reasonCode,
      blocking: derived.blocking,
      notes: decision.reviewNote != null ? decision.reviewNote : row.notes,
    });

    await this.deps.certRepo.insertEvent({
      certificate_id: row.id,
      vessel_id: row.vessel_id,
      imo: row.imo,
      event_ts: nowIso,
      event_type: "UPDATED",
      severity: severityForEvent("UPDATED", derived.blocking),
      previous_status: row.status,
      new_status: updated.status,
      reason_code: derived.reasonCode,
      details: { decision: decision.decision, review_note: decision.reviewNote ?? null },
      dedup_key: null,
    });

    return viewFor(updated, nowIso, this.thresholds);
  }

  private eventTypeForTransition(
    previous: string,
    next: CertificateStatus,
  ): "CERTIFICATE_EXPIRING" | "CERTIFICATE_EXPIRED" | "REVIEW_REQUIRED" | null {
    if (next === "EXPIRING_SOON" && previous !== "EXPIRING_SOON") return "CERTIFICATE_EXPIRING";
    if (next === "EXPIRED" && previous !== "EXPIRED") return "CERTIFICATE_EXPIRED";
    if (next === "PENDING_REVIEW" && previous !== "PENDING_REVIEW") return "REVIEW_REQUIRED";
    return null;
  }

  /** Insert an event (unless the dedup key already matches the latest event) and dispatch a notification. */
  private async emit(
    input: CertificateEventInsert,
    record: CertificateRecord,
    nowIso: string,
  ): Promise<CertificateEvent | null> {
    if (input.dedup_key !== null) {
      const latest = await this.deps.certRepo.findEventsByCertificateId(record.id, 1);
      if (latest.length > 0 && latest[0]?.dedup_key === input.dedup_key) {
        return null;
      }
    }
    const event = await this.deps.certRepo.insertEvent(input);

    const notificationType = certificateNotificationTypeForEvent(event);
    if (notificationType && this.deps.notify) {
      const notification = buildCertificateNotification({ event, certificate: record });
      if (notification) {
        await this.deps.notify.dispatch(notification);
      }
    }
    return event;
  }
}
