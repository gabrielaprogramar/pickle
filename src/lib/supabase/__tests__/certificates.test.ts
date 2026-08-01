/**
 * certificates.test.ts — unit tests for the CertificateRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the certificate & statutory document registry repository against
 * the in-memory fake Supabase client: CRUD, current-only filtering, deterministic
 * date-window queries, supersession, and the append-only event trail.
 *
 * Run via: npm run test:certificates_repo
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createCertificateRepository } from "../repositories/certificates";
import type { CertificateRegistryInsert } from "../types";

const VESSEL_ID = "vsl-aurelia";
const IMO = "9074729";

function insert(overrides: Partial<CertificateRegistryInsert> = {}): CertificateRegistryInsert {
  return {
    vessel_id: VESSEL_ID,
    imo: IMO,
    document_id: "doc-iapp-1",
    certificate_type: "AIR_POLLUTION_PREVENTION",
    certificate_number: "IAPP-2024-0581",
    issuing_authority: "Transport Malta",
    class_society: null,
    issue_date: "2024-05-15",
    expiry_date: "2027-05-14",
    status: "VALID",
    source: "document_ocr",
    validation_status: "valid",
    review_status: "NOT_REQUIRED",
    review_required: false,
    blocking: false,
    reason_code: null,
    confidence: 0.92,
    notes: null,
    version: 1,
    supersedes_id: null,
    is_current: true,
    ...overrides,
  };
}

describe("CertificateRepository — insert", () => {
  it("inserts a record and returns the row with server defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });

    const row = await repo.insert(insert());

    expect(row.id).toBeTruthy();
    expect(row.vessel_id).toBe(VESSEL_ID);
    expect(row.imo).toBe(IMO);
    expect(row.document_id).toBe("doc-iapp-1");
    expect(row.status).toBe("VALID");
    expect(row.version).toBe(1);
    expect(row.is_current).toBe(true);
    expect(row.confidence).toBe(0.92);
    expect(row.updated_at).toBeTruthy();
  });

  it("applies defaults when optional fields are omitted", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });

    const row = await repo.insert({
      vessel_id: VESSEL_ID,
      imo: IMO,
      certificate_type: "LOAD_LINE",
      status: "EXPIRED",
      source: "document_ocr",
    });

    expect(row.document_id).toBeNull();
    expect(row.certificate_number).toBeNull();
    expect(row.issuing_authority).toBeNull();
    expect(row.expiry_date).toBeNull();
    expect(row.review_required).toBe(false);
    expect(row.blocking).toBe(false);
    expect(row.reason_code).toBeNull();
    expect(row.version).toBe(1);
    expect(row.is_current).toBe(true);
  });
});

describe("CertificateRepository — findById", () => {
  it("returns the record when it exists", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const seeded = await repo.insert(insert());

    const row = await repo.findById(seeded.id);
    expect(row).toBeTruthy();
    expect(row!.certificate_type).toBe("AIR_POLLUTION_PREVENTION");
  });

  it("returns null when unknown", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    expect(await repo.findById("nope")).toBeNull();
  });
});

describe("CertificateRepository — findByVesselId", () => {
  it("returns current records only with onlyCurrent", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const current = await repo.insert(insert({ certificate_type: "ISCC" }));
    await repo.insert(insert({ certificate_type: "ISCC", is_current: false, version: 2 }));

    const rows = await repo.findByVesselId(VESSEL_ID, { onlyCurrent: true });
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(current.id);
  });

  it("filters by status", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    await repo.insert(insert({ certificate_type: "ISCC" }));
    const expired = await repo.insert(insert({ certificate_type: "LOAD_LINE", status: "EXPIRED" }));

    const rows = await repo.findByVesselId(VESSEL_ID, { status: "EXPIRED" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(expired.id);
  });

  it("filters by certificate type", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    await repo.insert(insert({ certificate_type: "AIR_POLLUTION_PREVENTION" }));
    const cls = await repo.insert(insert({ certificate_type: "CLASS_CERTIFICATE" }));

    const rows = await repo.findByVesselId(VESSEL_ID, { certificateType: "CLASS_CERTIFICATE" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(cls.id);
  });

  it("isolates by vessel", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const certA = await repo.insert(insert());
    await repo.insert(insert({ vessel_id: "vsl-other" }));

    const rows = await repo.findByVesselId(VESSEL_ID);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(certA.id);
  });
});

describe("CertificateRepository — findByVesselAndType", () => {
  it("returns the single current record for a type", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const v1 = await repo.insert(insert({ certificate_type: "ISCC" }));
    await repo.insert(insert({ certificate_type: "ISCC", is_current: false, version: 2 }));

    const row = await repo.findByVesselAndType(VESSEL_ID, "ISCC");
    expect(row).toBeTruthy();
    expect(row!.id).toBe(v1.id);
  });

  it("returns null when only historical rows exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    await repo.insert(insert({ certificate_type: "ISCC", is_current: false }));

    expect(await repo.findByVesselAndType(VESSEL_ID, "ISCC")).toBeNull();
  });
});

describe("CertificateRepository — expiry window queries", () => {
  it("finds records expiring within a deterministic date window", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const cert90 = await repo.insert(insert({ certificate_type: "ISCC", expiry_date: "2026-10-08" }));
    const cert120 = await repo.insert(insert({ certificate_type: "LOAD_LINE", expiry_date: "2026-11-07" }));
    const hist = await repo.insert(insert({ certificate_type: "ISCC", expiry_date: "2026-09-01", is_current: false }));

    const rows = await repo.findExpiringWithinDays(VESSEL_ID, 90, "2026-07-10T12:00:00.000Z");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(cert90.id);
    expect(ids.includes(cert120.id)).toBe(false);
    expect(ids.includes(hist.id)).toBe(false);
  });

  it("finds expired records excluding historical versions", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const expired = await repo.insert(insert({ certificate_type: "LOAD_LINE", expiry_date: "2026-03-15", status: "EXPIRED" }));
    const valid = await repo.insert(insert({ certificate_type: "ISCC", expiry_date: "2027-01-01" }));
    const hist = await repo.insert(insert({ certificate_type: "LOAD_LINE", expiry_date: "2025-01-01", is_current: false }));

    const rows = await repo.findExpired(VESSEL_ID, "2026-07-10T12:00:00.000Z");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(expired.id);
    expect(ids.includes(valid.id)).toBe(false);
    expect(ids.includes(hist.id)).toBe(false);
  });
});

describe("CertificateRepository — update", () => {
  it("updates snapshot fields and returns the refreshed row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const seeded = await repo.insert(insert());

    const updated = await repo.update(seeded.id, { status: "EXPIRED", blocking: true });
    expect(updated.status).toBe("EXPIRED");
    expect(updated.blocking).toBe(true);
    expect(updated.id).toBe(seeded.id);
  });
});

describe("CertificateRepository — event trail", () => {
  it("inserts an event and lists events for a certificate newest-first", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createCertificateRepository({ client: fake });
    const seeded = await repo.insert(insert());

    await repo.insertEvent({
      certificate_id: seeded.id,
      vessel_id: VESSEL_ID,
      imo: IMO,
      event_ts: "2026-07-01T00:00:00.000Z",
      event_type: "CERTIFICATE_EXPIRING",
      severity: "MEDIUM",
      previous_status: "VALID",
      new_status: "EXPIRING_SOON",
      dedup_key: `${VESSEL_ID}:ISCC:EXPIRING_SOON`,
    });
    await repo.insertEvent({
      certificate_id: seeded.id,
      vessel_id: VESSEL_ID,
      imo: IMO,
      event_ts: "2026-07-10T00:00:00.000Z",
      event_type: "CERTIFICATE_EXPIRED",
      severity: "HIGH",
      previous_status: "EXPIRING_SOON",
      new_status: "EXPIRED",
      dedup_key: `${VESSEL_ID}:ISCC:EXPIRED`,
    });

    const byCert = await repo.findEventsByCertificateId(seeded.id, 1);
    expect(byCert.length).toBe(1);
    expect(byCert[0]!.event_type).toBe("CERTIFICATE_EXPIRED");

    const byVessel = await repo.findEventsByVesselId(VESSEL_ID);
    expect(byVessel.length).toBe(2);
  });
});

run();
