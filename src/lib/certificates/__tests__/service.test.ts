/**
 * certificates/__tests__/service.test.ts — CertificateService orchestration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises registerFromDocument (creation, supersession, IMO mismatch, missing
 * expiry, evidence linkage), evaluate (expiry transitions + dedup), requirements
 * reconciliation, review decisions, and cross-vessel isolation against an
 * in-memory CertificateRepository fake.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { CertificateService } from "../service";
import type {
  CertificateRepository,
  CertificateServiceDeps,
  CertificateVessel,
} from "../service";
import type {
  CertificateEvent,
  CertificateEventInsert,
  CertificateRecord,
  CertificateRecordInsert,
} from "../types";
import { CERTIFICATE_REASON_CODES, DEFAULT_CERTIFICATE_THRESHOLDS } from "../types";
import type { NotificationEvent } from "@/lib/notifications";

const IMO = "9074729";
const VESSEL_ID = "vsl-aurelia";
const NOW = "2026-07-10T12:00:00.000Z";

class InMemoryCertRepo implements CertificateRepository {
  private readonly rows: CertificateRecord[] = [];
  private readonly events: CertificateEvent[] = [];
  private idSeq = 0;
  private evSeq = 0;

  constructor(seed: readonly CertificateRecord[] = []) {
    this.rows = seed.map((r) => ({ ...r }));
  }

  get all(): ReadonlyArray<CertificateRecord> {
    return this.rows;
  }

  get audit(): ReadonlyArray<CertificateEvent> {
    return this.events;
  }

  async findById(id: string): Promise<CertificateRecord | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findByVesselId(
    vesselId: string,
    opts: { readonly onlyCurrent?: boolean; readonly status?: string; readonly certificateType?: string } = {},
  ): Promise<CertificateRecord[]> {
    return this.rows.filter((r) => {
      if (r.vessel_id !== vesselId) return false;
      if (opts.onlyCurrent && !r.is_current) return false;
      if (opts.status && r.status !== opts.status) return false;
      if (opts.certificateType && r.certificate_type !== opts.certificateType) return false;
      return true;
    });
  }

  async findByVesselAndType(vesselId: string, certificateType: string): Promise<CertificateRecord | null> {
    return (
      this.rows.find(
        (r) => r.vessel_id === vesselId && r.certificate_type === certificateType && r.is_current,
      ) ?? null
    );
  }

  async findExpiringWithinDays(vesselId: string, withinDays: number, now: string): Promise<CertificateRecord[]> {
    const today = now.slice(0, 10);
    const upper = new Date(new Date(today + "T00:00:00.000Z").getTime() + withinDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return this.rows.filter(
      (r) => r.vessel_id === vesselId && r.is_current && r.expiry_date !== null && r.expiry_date >= today && r.expiry_date <= upper,
    );
  }

  async findExpired(vesselId: string, now: string): Promise<CertificateRecord[]> {
    const today = now.slice(0, 10);
    return this.rows.filter(
      (r) => r.vessel_id === vesselId && r.is_current && r.expiry_date !== null && r.expiry_date < today,
    );
  }

  async insert(input: CertificateRecordInsert): Promise<CertificateRecord> {
    const row: CertificateRecord = {
      id: `cert-${++this.idSeq}`,
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
      created_at: NOW,
      updated_at: NOW,
    };
    this.rows.push(row);
    return row;
  }

  async update(id: string, patch: Partial<CertificateRecordInsert>): Promise<CertificateRecord> {
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Certificate record not found: ${id}`);
    const next: CertificateRecord = {
      ...this.rows[idx]!,
      ...(patch as Partial<CertificateRecord>),
      updated_at: NOW,
    };
    this.rows[idx] = next;
    return next;
  }

  async findEventsByVesselId(vesselId: string): Promise<CertificateEvent[]> {
    return this.events.filter((e) => e.vessel_id === vesselId);
  }

  async findEventsByCertificateId(certificateId: string, limit?: number): Promise<CertificateEvent[]> {
    const filtered = this.events.filter((e) => e.certificate_id === certificateId);
    return typeof limit === "number" ? filtered.slice(Math.max(0, filtered.length - limit)) : filtered;
  }

  async insertEvent(input: CertificateEventInsert): Promise<CertificateEvent> {
    const event: CertificateEvent = {
      id: `evt-${++this.evSeq}`,
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
    this.events.push(event);
    return event;
  }
}

function makeVessel(overrides: Partial<CertificateVessel> = {}): CertificateVessel {
  return {
    id: VESSEL_ID,
    name: "Aurelia",
    gt: 1250,
    vesselType: "commercial",
    ballastTanks: null,
    ...overrides,
  };
}

function buildService(seed: readonly CertificateRecord[] = []) {
  const certRepo = new InMemoryCertRepo(seed);
  const dispatched: NotificationEvent[] = [];
  const deps: CertificateServiceDeps = {
    certRepo,
    vesselRepo: {
      async findByImo(imo: string) {
        return imo === IMO ? makeVessel() : null;
      },
    },
    notify: {
      async dispatch(n: NotificationEvent) {
        dispatched.push(n);
      },
    },
  };
  const service = new CertificateService(deps);
  return { service, certRepo, dispatched, deps };
}

function registerInput(overrides: Partial<Parameters<CertificateService["registerFromDocument"]>[1]> = {}) {
  return {
    documentId: "doc-iapp-1",
    certificateType: "AIR_POLLUTION_PREVENTION",
    certificateNumber: "IAPP-2024-0581",
    issuingAuthority: "Transport Malta",
    issueDate: "2024-05-15",
    expiryDate: "2027-05-14",
    source: "document_ocr" as const,
    confidence: 0.92,
    documentImo: IMO,
    ...overrides,
  };
}

describe("CertificateService.registerFromDocument — creation", () => {
  it("registers a VALID record linked to its evidence document", async () => {
    const { service, certRepo, dispatched } = buildService();

    const outcome = await service.registerFromDocument(IMO, registerInput(), NOW);

    expect(outcome.record.document_id).toBe("doc-iapp-1");
    expect(outcome.record.certificate_type).toBe("AIR_POLLUTION_PREVENTION");
    expect(outcome.record.status).toBe("VALID");
    expect(outcome.record.version).toBe(1);
    expect(outcome.record.is_current).toBe(true);
    expect(outcome.record.blocking).toBe(false);
    expect(outcome.record.review_required).toBe(false);
    expect(outcome.record.confidence).toBe(0.92);
    expect(outcome.wasSuperseded).toBe(false);
    expect(outcome.supersededRecord).toBeNull();
    expect(outcome.event?.event_type).toBe("CREATED");
    expect(outcome.dispatchedNotifications).toBe(0);

    expect(certRepo.audit.length).toBe(1);
    expect(dispatched.length).toBe(0);
  });

  it("keeps the record attached to its evidence (document_id never lost)", async () => {
    const { service } = buildService();
    const outcome = await service.registerFromDocument(IMO, registerInput(), NOW);
    const byId = await service.getCertificateById(outcome.record.id, NOW);
    expect(byId?.record.document_id).toBe("doc-iapp-1");
  });
});

describe("CertificateService.registerFromDocument — supersession", () => {
  it("supersedes an existing current record with version +1 and a REPLACED event", async () => {
    const { service, certRepo, dispatched } = buildService();
    const first = await service.registerFromDocument(IMO, registerInput(), NOW);

    const second = await service.registerFromDocument(IMO, registerInput({ documentId: "doc-iapp-2" }), NOW);

    expect(second.record.version).toBe(2);
    expect(second.record.supersedes_id).toBe(first.record.id);
    expect(second.record.is_current).toBe(true);
    expect(second.wasSuperseded).toBe(true);
    expect(second.supersededRecord?.id).toBe(first.record.id);
    expect(second.event?.event_type).toBe("REPLACED");

    const firstAfter = await service.getCertificateById(first.record.id, NOW);
    expect(firstAfter?.record.is_current).toBe(false);
    expect(firstAfter?.record.document_id).toBe("doc-iapp-1");

    expect(certRepo.audit.length).toBe(2);
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("certificate_replaced");
    expect(dispatched[0]?.severity).toBe("INFO");
  });

  it("tracks the superseded certificate in the record (history never deleted)", async () => {
    const { service, certRepo } = buildService();
    const first = await service.registerFromDocument(IMO, registerInput(), NOW);
    await service.registerFromDocument(IMO, registerInput({ documentId: "doc-iapp-2" }), NOW);

    const rows = await certRepo.findByVesselId(VESSEL_ID, { onlyCurrent: true });
    expect(rows.length).toBe(1);
    expect(rows[0]?.id !== first.record.id).toBe(true);
  });
});

describe("CertificateService.registerFromDocument — deterministic guards", () => {
  it("flags an IMO mismatch as blocking PENDING_REVIEW / IMO_MISMATCH", async () => {
    const { service, certRepo } = buildService();
    const outcome = await service.registerFromDocument(
      IMO,
      registerInput({ documentImo: "0000000", expiryDate: "2027-05-14" }),
      NOW,
    );

    expect(outcome.record.status).toBe("PENDING_REVIEW");
    expect(outcome.record.reason_code).toBe(CERTIFICATE_REASON_CODES.IMO_MISMATCH);
    expect(outcome.record.blocking).toBe(true);
    expect(outcome.record.review_required).toBe(true);

    const view = await service.getCertificateById(outcome.record.id, NOW);
    expect(view?.blocking).toBe(true);
    expect(view?.status).toBe("PENDING_REVIEW");
  });

  it("routes a missing expiry to PENDING_REVIEW without inventing a date", async () => {
    const { service, certRepo } = buildService();
    const outcome = await service.registerFromDocument(
      IMO,
      registerInput({ expiryDate: null }),
      NOW,
    );

    expect(outcome.record.status).toBe("PENDING_REVIEW");
    expect(outcome.record.reason_code).toBe(CERTIFICATE_REASON_CODES.MISSING_EXPIRY);
    expect(outcome.record.expiry_date).toBeNull();
    expect(outcome.record.review_required).toBe(true);
    expect(outcome.record.blocking).toBe(false);
  });

  it("derives EXPIRING_SOON status from the evidence expiry date", async () => {
    const { service } = buildService();
    const outcome = await service.registerFromDocument(
      IMO,
      registerInput({ certificateType: "ISCC", expiryDate: "2026-09-20", documentId: "doc-iscc-1" }),
      NOW,
    );
    expect(outcome.record.status).toBe("EXPIRING_SOON");
  });

  it("throws when the vessel is unknown", async () => {
    const { service } = buildService();
    await expect(async () =>
      service.registerFromDocument("0000000", registerInput(), NOW),
    ).toThrow("Vessel not found");
  });
});

describe("CertificateService.evaluate — expiry transitions", () => {
  function seedExpired(): CertificateRecord {
    return {
      id: "cert-loadline",
      vessel_id: VESSEL_ID,
      imo: IMO,
      document_id: "doc-ll-1",
      certificate_type: "LOAD_LINE",
      certificate_number: "LL-2021-0113",
      issuing_authority: "Transport Malta",
      class_society: null,
      issue_date: "2021-11-02",
      expiry_date: "2026-03-15",
      status: "VALID",
      source: "document_ocr",
      validation_status: "valid",
      review_status: "NOT_REQUIRED",
      review_required: false,
      blocking: false,
      reason_code: null,
      confidence: null,
      notes: null,
      version: 1,
      supersedes_id: null,
      is_current: true,
      created_at: NOW,
      updated_at: NOW,
    };
  }

  it("refreshes an expired record and emits a deterministic CERTIFICATE_EXPIRED event", async () => {
    const { service, certRepo, dispatched } = buildService([seedExpired()]);

    const outcome = await service.evaluate(IMO, { now: NOW });

    expect(outcome.emittedEvents.length).toBe(1);
    expect(outcome.emittedEvents[0]?.event_type).toBe("CERTIFICATE_EXPIRED");
    expect(outcome.emittedEvents[0]?.severity).toBe("HIGH");
    expect(outcome.emittedEvents[0]?.dedup_key).toBe(`vsl-aurelia:LOAD_LINE:EXPIRED`);
    expect(outcome.views[0]?.status).toBe("EXPIRED");
    expect(outcome.views[0]?.daysUntilExpiry).toBe(-117);

    const stored = await certRepo.findById("cert-loadline");
    expect(stored?.status).toBe("EXPIRED");
    expect(stored?.reason_code).toBeNull();

    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("certificate_expired");
  });

  it("deduplicates re-emission via the latest-event dedup_key", async () => {
    const { service, certRepo } = buildService([seedExpired()]);
    await service.evaluate(IMO, { now: NOW });

    const stored = await certRepo.findById("cert-loadline");
    expect(stored?.status).toBe("EXPIRED");

    const second = await service.evaluate(IMO, { now: NOW });
    expect(second.emittedEvents.length).toBe(0);
    expect(second.dispatchedNotifications).toBe(0);
  });

  it("re-derives EXPIRING_SOON and emits a CERTIFICATE_EXPIRING event", async () => {
    const seed = seedExpired();
    const expiring: CertificateRecord = {
      ...seed,
      id: "cert-iscc",
      certificate_type: "ISCC",
      expiry_date: "2026-09-20",
    };
    const { service, certRepo } = buildService([expiring]);

    const outcome = await service.evaluate(IMO, { now: NOW });

    expect(outcome.emittedEvents.length).toBe(1);
    expect(outcome.emittedEvents[0]?.event_type).toBe("CERTIFICATE_EXPIRING");
    expect(outcome.emittedEvents[0]?.severity).toBe("MEDIUM");

    const stored = await certRepo.findById("cert-iscc");
    expect(stored?.status).toBe("EXPIRING_SOON");
  });

  it("does not re-emit when the derived snapshot equals the stored snapshot", async () => {
    const seed = seedExpired();
    const valid: CertificateRecord = {
      ...seed,
      id: "cert-iapp",
      certificate_type: "AIR_POLLUTION_PREVENTION",
      expiry_date: "2027-05-14",
    };
    const { service } = buildService([valid]);
    const outcome = await service.evaluate(IMO, { now: NOW });
    expect(outcome.emittedEvents.length).toBe(0);
  });

  it("suppresses re-emission via the latest-event dedup_key on an oscillating status", async () => {
    const seed = seedExpired();
    const oscillating: CertificateRecord = {
      ...seed,
      id: "cert-osc",
      certificate_type: "ISCC",
      expiry_date: "2026-08-01",
    };
    const { service, certRepo } = buildService([oscillating]);

    await service.evaluate(IMO, { now: NOW });
    expect((await certRepo.findEventsByCertificateId("cert-osc")).length).toBe(1);

    await certRepo.update("cert-osc", { expiry_date: "2028-01-01" });
    await service.evaluate(IMO, { now: NOW });

    await certRepo.update("cert-osc", { expiry_date: "2026-08-01", status: "VALID" });
    const third = await service.evaluate(IMO, { now: NOW });

    expect(third.emittedEvents.length).toBe(0);
    expect(third.dispatchedNotifications).toBe(0);

    const stored = await certRepo.findById("cert-osc");
    expect(stored?.status).toBe("EXPIRING_SOON");
    expect((await certRepo.findEventsByCertificateId("cert-osc")).length).toBe(1);
  });
});

describe("CertificateService.reconcileRequirements", () => {
  it("materializes MISSING placeholders for required types without evidence", async () => {
    const { service } = buildService();
    const outcome = await service.reconcileRequirements(
      IMO,
      {
        imo: IMO,
        name: "Aurelia",
        vesselType: "commercial",
        gt: 1250,
        lengthM: 60,
        ballastTanks: null,
      },
      { now: NOW },
    );

    const missing = outcome.views.filter((v) => v.status === "MISSING");
    const uncertainReview = outcome.views.filter(
      (v) => v.status === "PENDING_REVIEW" && v.reasonCode === CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY,
    );

    expect(missing.length).toBeGreaterThan(3);
    expect(missing.some((v) => v.record.certificate_type === "AIR_POLLUTION_PREVENTION")).toBe(true);
    expect(missing.some((v) => v.record.certificate_type === "LOAD_LINE")).toBe(true);

    expect(uncertainReview.some((v) => v.record.certificate_type === "TONNAGE")).toBe(true);
    expect(uncertainReview.some((v) => v.record.certificate_type === "ISCC")).toBe(true);
    expect(uncertainReview.some((v) => v.record.certificate_type === "BALLAST_WATER")).toBe(true);

    expect(outcome.emittedEvents.some((e) => e.event_type === "MISSING")).toBe(true);
    expect(outcome.emittedEvents.some((e) => e.event_type === "REVIEW_REQUIRED")).toBe(true);
  });

  it("never creates a duplicate placeholder on a second pass", async () => {
    const { service } = buildService();
    const profile = {
      imo: IMO,
      name: "Aurelia",
      vesselType: "commercial" as const,
      gt: 1250,
      lengthM: 60,
      ballastTanks: null,
    };
    await service.reconcileRequirements(IMO, profile, { now: NOW });
    const second = await service.reconcileRequirements(IMO, profile, { now: NOW });
    expect(second.emittedEvents.length).toBe(0);
  });
});

describe("CertificateService.applyReviewDecision", () => {
  function seedReview(): CertificateRecord {
    return {
      id: "cert-safety-review",
      vessel_id: VESSEL_ID,
      imo: IMO,
      document_id: "doc-safety-1",
      certificate_type: "SAFETY_CERTIFICATE",
      certificate_number: null,
      issuing_authority: null,
      class_society: null,
      issue_date: null,
      expiry_date: null,
      status: "PENDING_REVIEW",
      source: "document_ocr",
      validation_status: "pending",
      review_status: "PENDING",
      review_required: true,
      blocking: false,
      reason_code: CERTIFICATE_REASON_CODES.PENDING_REVIEW,
      confidence: null,
      notes: null,
      version: 1,
      supersedes_id: null,
      is_current: true,
      created_at: NOW,
      updated_at: NOW,
    };
  }

  it("rejects a review → INVALID with REVIEW_REJECTED", async () => {
    const { service } = buildService([seedReview()]);
    const view = await service.applyReviewDecision(
      "cert-safety-review",
      { decision: "rejected", reviewNote: "Scan unreadable" },
      NOW,
    );

    expect(view.status).toBe("INVALID");
    expect(view.reasonCode).toBe(CERTIFICATE_REASON_CODES.REVIEW_REJECTED);
    const stored = await service.getCertificateById("cert-safety-review", NOW);
    expect(stored?.record.review_status).toBe("REJECTED");
  });

  it("approves a review → valid status when expiry is on file", async () => {
    const seeded = seedReview();
    const withExpiry: CertificateRecord = { ...seeded, expiry_date: "2027-01-01" };
    const { service } = buildService([withExpiry]);

    const view = await service.applyReviewDecision("cert-safety-review", { decision: "approved" }, NOW);

    expect(view.status).toBe("VALID");
    expect(view.reasonCode).toBeNull();
  });

  it("throws for an unknown certificate", async () => {
    const { service } = buildService();
    await expect(async () =>
      service.applyReviewDecision("nope", { decision: "approved" }, NOW),
    ).toThrow("not found");
  });
});

describe("CertificateService — cross-vessel isolation", () => {
  it("only returns records for the requested vessel", async () => {
    const { service } = buildService();
    await service.registerFromDocument(IMO, registerInput(), NOW);

    const other = await service.getCertificates("0000000", NOW);
    expect(other.length).toBe(0);
  });
});

run();
