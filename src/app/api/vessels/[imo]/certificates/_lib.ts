/**
 * certificates/_lib.ts — shared wiring for the Certificate & Statutory Document Registry API
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Builds a `CertificateService` from the real Supabase repositories and the
 * shared notification dispatcher, or from a deterministic in-memory mock
 * (Aurelia IMO 9074729) when `mock` is requested. Route handlers accept
 * `CertificateApiDeps` so tests can inject fakes; `route.ts` uses
 * `buildDefaultCertificateApiDeps()` and opts into mock mode via `?mock=true`.
 */

import { CertificateService } from "@/lib/certificates";
import type {
  CertificateEvent,
  CertificateEventInsert,
  CertificateRecord,
  CertificateRecordInsert,
  CertificateServiceDeps,
  CertificateVessel,
} from "@/lib/certificates";
import {
  CERT_MOCK_NOW,
  CERT_MOCK_PROFILE,
  CERT_MOCK_VESSEL,
  buildMockCertificateRegistry,
} from "@/lib/certificates";
import {
  createNotificationDispatcher,
  createNotificationEmailProvider,
  createPreferenceService,
  formatCertificateTemplate,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createCertificateRepository,
} from "@/lib/supabase/repositories/certificates";
import type {
  CertificateRepository as CertificateRepoRow,
} from "@/lib/supabase/repositories/certificates";
import {
  createNotificationPreferenceRepository,
} from "@/lib/supabase/repositories/notification_preferences";
import {
  createNotificationRepository,
} from "@/lib/supabase/repositories/notifications";
import {
  createVesselRepository,
} from "@/lib/supabase/repositories/vessels";
import type { CertificateRepository } from "@/lib/certificates";

/**
 * The repository stores loose column types; the domain uses checked unions
 * (DB CHECK constraints enforce the same values). This adapter narrows rows
 * to the domain shapes at the repository boundary.
 */
export function adaptCertificateRepository(
  repo: CertificateRepoRow,
): CertificateRepository {
  return {
    async findById(id) {
      const row = await repo.findById(id);
      return row ? (row as unknown as CertificateRecord) : null;
    },
    async findByVesselId(vesselId, opts) {
      const rows = await repo.findByVesselId(vesselId, opts);
      return rows as unknown as CertificateRecord[];
    },
    async findByVesselAndType(vesselId, certificateType) {
      const row = await repo.findByVesselAndType(vesselId, certificateType);
      return row ? (row as unknown as CertificateRecord) : null;
    },
    async findExpiringWithinDays(vesselId, withinDays, now) {
      const rows = await repo.findExpiringWithinDays(vesselId, withinDays, now);
      return rows as unknown as CertificateRecord[];
    },
    async findExpired(vesselId, now) {
      const rows = await repo.findExpired(vesselId, now);
      return rows as unknown as CertificateRecord[];
    },
    async insert(input) {
      const row = await repo.insert(input as never);
      return row as unknown as CertificateRecord;
    },
    async update(id, patch) {
      const row = await repo.update(id, patch as never);
      return row as unknown as CertificateRecord;
    },
    async findEventsByVesselId(vesselId, limit) {
      const rows = await repo.findEventsByVesselId(vesselId, limit);
      return rows as unknown as CertificateEvent[];
    },
    async findEventsByCertificateId(certificateId, limit) {
      const rows = await repo.findEventsByCertificateId(certificateId, limit);
      return rows as unknown as CertificateEvent[];
    },
    async insertEvent(input) {
      const row = await repo.insertEvent(input as never);
      return row as unknown as CertificateEvent;
    },
  };
}

export interface CertificateApiDeps {
  readonly service: CertificateService;
  readonly vesselRepo: CertificateServiceDeps["vesselRepo"];
  /** True when serving the deterministic in-memory mock (Aurelia). */
  readonly mock: boolean;
}

export function buildDefaultCertificateApiDeps(): CertificateApiDeps {
  const client = getSupabaseClient();
  const vesselRepo = createVesselRepository({ client });

  const service = new CertificateService({
    certRepo: adaptCertificateRepository(createCertificateRepository({ client })),
    vesselRepo,
    notify: createNotificationDispatcher({
      notifRepo: createNotificationRepository({ client }),
      emailProvider: createNotificationEmailProvider(),
      prefService: createPreferenceService({
        prefRepo: createNotificationPreferenceRepository({ client }),
      }),
      templateFormatter: { formatCertificate: formatCertificateTemplate },
    }),
  });

  return { service, vesselRepo, mock: false };
}

export function buildMockCertificateApiDeps(): CertificateApiDeps {
  const vesselRepo: CertificateServiceDeps["vesselRepo"] = {
    async findByImo(imo: string): Promise<CertificateVessel | null> {
      if (imo !== CERT_MOCK_VESSEL.imo) return null;
      return {
        id: CERT_MOCK_VESSEL.vesselId,
        name: CERT_MOCK_VESSEL.name,
        gt: CERT_MOCK_PROFILE.gt,
        vesselType: CERT_MOCK_PROFILE.vesselType,
        ballastTanks: CERT_MOCK_PROFILE.ballastTanks,
      };
    },
  };

  const service = new CertificateService({
    certRepo: createMockCertificateRepository(),
    vesselRepo,
    notify: {
      async dispatch() {
        return undefined;
      },
    },
  });

  return { service, vesselRepo, mock: true };
}

/** Select real or mock deps based on the request's `mock` query flag. */
export function resolveCertificateApiDeps(mock: boolean): CertificateApiDeps {
  return mock ? buildMockCertificateApiDeps() : buildDefaultCertificateApiDeps();
}

/** In-memory CertificateRepository seeded from the deterministic mock registry. */
export function createMockCertificateRepository(): CertificateRepository {
  const { records } = buildMockCertificateRegistry();
  const rows: CertificateRecord[] = records.map((r) => ({ ...r }));
  const events: CertificateEvent[] = [];
  let idCounter = 0;

  const nextId = (): string => `mock-cert-${++idCounter}`;

  return {
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findByVesselId(vesselId, opts = {}) {
      return rows.filter((r) => {
        if (r.vessel_id !== vesselId) return false;
        if (opts.onlyCurrent && !r.is_current) return false;
        if (opts.status && r.status !== opts.status) return false;
        if (opts.certificateType && r.certificate_type !== opts.certificateType) return false;
        return true;
      });
    },
    async findByVesselAndType(vesselId, certificateType) {
      return rows.find(
        (r) => r.vessel_id === vesselId && r.certificate_type === certificateType && r.is_current,
      ) ?? null;
    },
    async findExpiringWithinDays(vesselId, withinDays, now) {
      const today = now.slice(0, 10);
      const upper = new Date(new Date(today + "T00:00:00.000Z").getTime() + withinDays * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return rows.filter((r) => {
        if (r.vessel_id !== vesselId || !r.is_current || r.expiry_date === null) return false;
        return r.expiry_date >= today && r.expiry_date <= upper;
      });
    },
    async findExpired(vesselId, now) {
      const today = now.slice(0, 10);
      return rows.filter(
        (r) => r.vessel_id === vesselId && r.is_current && r.expiry_date !== null && r.expiry_date < today,
      );
    },
    async insert(input) {
      const row: CertificateRecord = {
        id: nextId(),
        vessel_id: input.vessel_id,
        imo: input.imo,
        document_id: input.document_id ?? null,
        certificate_type: input.certificate_type,
        certificate_number: input.certificate_number ?? null,
        issuing_authority: input.issuing_authority ?? null,
        class_society: input.class_society ?? null,
        issue_date: input.issue_date ?? null,
        expiry_date: input.expiry_date ?? null,
        status: input.status,
        source: input.source,
        validation_status: input.validation_status ?? "pending",
        review_status: input.review_status ?? "NOT_REQUIRED",
        review_required: input.review_required ?? false,
        blocking: input.blocking ?? false,
        reason_code: input.reason_code ?? null,
        confidence: input.confidence ?? null,
        notes: input.notes ?? null,
        version: input.version ?? 1,
        supersedes_id: input.supersedes_id ?? null,
        is_current: input.is_current ?? true,
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
      };
      rows.push(row);
      return row;
    },
    async update(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Certificate record not found: ${id}`);
      const next: CertificateRecord = {
        ...rows[idx]!,
        ...(patch as Partial<CertificateRecord>),
        updated_at: "2026-07-10T12:00:00.000Z",
      };
      rows[idx] = next;
      return next;
    },
    async findEventsByVesselId(vesselId) {
      return events.filter((e) => e.vessel_id === vesselId);
    },
    async findEventsByCertificateId(certificateId, limit) {
      const filtered = events.filter((e) => e.certificate_id === certificateId);
      return typeof limit === "number" ? filtered.slice(Math.max(0, filtered.length - limit)) : filtered;
    },
    async insertEvent(input) {
      const event: CertificateEvent = {
        id: `mock-cert-ev-${events.length + 1}`,
        certificate_id: input.certificate_id,
        vessel_id: input.vessel_id,
        imo: input.imo,
        event_ts: input.event_ts,
        event_type: input.event_type,
        severity: input.severity,
        previous_status: input.previous_status ?? null,
        new_status: input.new_status ?? null,
        reason_code: input.reason_code ?? null,
        details: input.details ?? null,
        dedup_key: input.dedup_key ?? null,
        created_at: input.event_ts,
      };
      events.push(event);
      return event;
    },
  };
}

export { CERT_MOCK_NOW, CERT_MOCK_VESSEL };
