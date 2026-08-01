/**
 * routes.test.ts — Certificate & Statutory Document Registry API routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises GET /api/vessels/[imo]/certificates (list + summary + filters),
 * GET /api/certificates/[id], POST /api/vessels/[imo]/certificates/evaluate
 * (expiry transitions + requirements reconciliation), and
 * POST /api/documents/[id]/certificate (registration with deterministic guards).
 * Mirrors the sox-watch route-test DI pattern with fakes.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import type { FakeSupabaseClientOptions } from "@/lib/supabase/fake-client";
import { CertificateService } from "@/lib/certificates";
import { CERT_MOCK_VESSEL } from "@/lib/certificates";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createCertificateRepository } from "@/lib/supabase/repositories/certificates";
import { adaptCertificateRepository, createMockCertificateRepository } from "../_lib";
import type { CertificateApiDeps } from "../_lib";
import { GET as listCertificates } from "../route";
import { POST as postEvaluate } from "../evaluate/route";
import { GET as getCertificateById } from "@/app/api/certificates/[id]/route";
import type { CertificateByIdApiDeps } from "@/app/api/certificates/[id]/_lib";
import { POST as postDocumentCertificate } from "@/app/api/documents/[id]/certificate/route";
import type { DocumentCertificateApiDeps } from "@/app/api/documents/[id]/certificate/_lib";
import type { NotificationEvent } from "@/lib/notifications";
import type { CertificateRegistryInsert } from "@/lib/supabase/types";

const IMO = "9074729";
const DOC_ID = "doc-iapp-1";
const NOW = "2026-07-10T12:00:00.000Z";

function certificateInsert(
  overrides: Partial<CertificateRegistryInsert> = {},
): CertificateRegistryInsert {
  return {
    vessel_id: "vsl-aurelia",
    imo: IMO,
    document_id: DOC_ID,
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
    confidence: 0.9,
    notes: null,
    version: 1,
    supersedes_id: null,
    is_current: true,
    ...overrides,
  };
}

function buildDeps(opts: FakeSupabaseClientOptions = {}) {
  const fake = createFakeSupabaseClient(opts);
  const vesselRepo = createVesselRepository({ client: fake });
  const certRepo = adaptCertificateRepository(createCertificateRepository({ client: fake }));
  const dispatched: NotificationEvent[] = [];
  const service = new CertificateService({
    certRepo,
    vesselRepo,
    notify: {
      async dispatch(n: NotificationEvent) {
        dispatched.push(n);
      },
    },
  });
  const deps: CertificateApiDeps = { service, vesselRepo, mock: false };
  return { deps, fake, dispatched, vesselRepo, certRepo, service };
}

async function seedVessel(fake: ReturnType<typeof createFakeSupabaseClient>): Promise<string> {
  const repo = createVesselRepository({ client: fake });
  return (await repo.upsertByImo({ imo: IMO, name: "Aurelia" })).id;
}

function listRequest(imo = IMO, query = "") {
  return new Request(`https://example.com/api/vessels/${imo}/certificates${query}`, {
    method: "GET",
  });
}

function evaluateRequest(body: unknown, imo = IMO, query = "") {
  return new Request(`https://example.com/api/vessels/${imo}/certificates/evaluate${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function documentCertificateRequest(body: unknown, docId = DOC_ID) {
  return new Request(`https://example.com/api/documents/${docId}/certificate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validDocumentBody(overrides: Record<string, unknown> = {}) {
  return {
    imo: IMO,
    documentImo: IMO,
    certificateType: "AIR_POLLUTION_PREVENTION",
    certificateNumber: "IAPP-2024-0581",
    issuingAuthority: "Transport Malta",
    issueDate: "2024-05-15",
    expiryDate: "2027-05-14",
    source: "document_ocr",
    confidence: 0.9,
    ...overrides,
  };
}

function buildDocumentDeps(fake: ReturnType<typeof createFakeSupabaseClient>) {
  const vesselRepo = createVesselRepository({ client: fake });
  const service = new CertificateService({
    certRepo: adaptCertificateRepository(createCertificateRepository({ client: fake })),
    vesselRepo,
  });
  const deps: DocumentCertificateApiDeps = {
    service,
    vesselRepo,
    documentRepo: {
      async findById(id: string) {
        return id === DOC_ID ? { id: DOC_ID, vessel_id: "vsl-aurelia" } : null;
      },
    },
  };
  return { deps, vesselRepo };
}

describe("GET /api/vessels/[imo]/certificates", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await listCertificates(listRequest("0000000"), { params: { imo: "0000000" } }, deps);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("returns an empty registry with zeroed summary for a known vessel", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);

    const response = await listCertificates(listRequest(), { params: { imo: IMO } }, deps);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.imo).toBe(IMO);
    expect(body.data.count).toBe(0);
    expect(body.data.summary.VALID).toBe(0);
    expect(body.data.summary.EXPIRED).toBe(0);
  });

  it("returns derived statuses, a summary, and expiry filters for a seeded registry", async () => {
    const { deps, fake } = buildDeps();
    const vesselId = await seedVessel(fake);
    const certRepo = createCertificateRepository({ client: fake });
    await certRepo.insert(certificateInsert({ vessel_id: vesselId }));
    await certRepo.insert(certificateInsert({ vessel_id: vesselId, certificate_type: "ISCC", expiry_date: "2026-09-20" }));
    await certRepo.insert(certificateInsert({ vessel_id: vesselId, certificate_type: "LOAD_LINE", expiry_date: "2026-03-15", status: "EXPIRED" }));

    const all = await (await listCertificates(listRequest(), { params: { imo: IMO } }, deps)).json();
    expect(all.data.count).toBe(3);
    expect(all.data.summary.VALID).toBe(1);
    expect(all.data.summary.EXPIRING_SOON).toBe(1);
    expect(all.data.summary.EXPIRED).toBe(1);

    const expiring = await (await listCertificates(listRequest(IMO, "?status=expiring"), { params: { imo: IMO } }, deps)).json();
    expect(expiring.data.count).toBe(1);
    expect(expiring.data.certificates[0].status).toBe("EXPIRING_SOON");

    const expired = await (await listCertificates(listRequest(IMO, "?status=expired"), { params: { imo: IMO } }, deps)).json();
    expect(expired.data.count).toBe(1);
    expect(expired.data.certificates[0].status).toBe("EXPIRED");
  });

  it("rejects an invalid status filter", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);
    const response = await listCertificates(listRequest(IMO, "?status=bogus"), { params: { imo: IMO } }, deps);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid now param", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);
    const response = await listCertificates(listRequest(IMO, "?now=not-a-date"), { params: { imo: IMO } }, deps);
    expect(response.status).toBe(400);
  });

  it("serves the deterministic mock registry with ?mock=true", async () => {
    const { deps } = buildDeps();
    const response = await listCertificates(listRequest(IMO, "?mock=true"), { params: { imo: IMO } }, deps);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.mock).toBe(true);
    expect(body.data.imo).toBe(CERT_MOCK_VESSEL.imo);
    expect(body.data.count).toBe(8);
    expect(body.data.summary.EXPIRING_SOON).toBe(1);
    expect(body.data.summary.EXPIRED).toBe(1);
  });
});

describe("GET /api/certificates/[id]", () => {
  it("returns a single record with freshly derived status", async () => {
    const { fake } = buildDeps();
    const certRepo = createCertificateRepository({ client: fake });
    const seeded = await certRepo.insert(certificateInsert());
    const service = new CertificateService({
      certRepo: adaptCertificateRepository(createCertificateRepository({ client: fake })),
      vesselRepo: {
        async findByImo() {
          return null;
        },
      },
    });
    const deps: CertificateByIdApiDeps = { service };

    const response = await getCertificateById(
      new Request(`https://example.com/api/certificates/${seeded.id}`, { method: "GET" }),
      { params: { id: seeded.id } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.certificate.status).toBe("VALID");
    expect(body.data.certificate.record.certificate_type).toBe("AIR_POLLUTION_PREVENTION");
  });

  it("returns 404 for an unknown record", async () => {
    const { fake } = buildDeps();
    const service = new CertificateService({
      certRepo: adaptCertificateRepository(createCertificateRepository({ client: fake })),
      vesselRepo: {
        async findByImo() {
          return null;
        },
      },
    });
    const deps: CertificateByIdApiDeps = { service };
    const response = await getCertificateById(
      new Request("https://example.com/api/certificates/nope", { method: "GET" }),
      { params: { id: "nope" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/vessels/[imo]/certificates/evaluate", () => {
  it("re-evaluates expiry and emits a deterministic event", async () => {
    const { deps, fake, dispatched } = buildDeps();
    const vesselId = await seedVessel(fake);
    const certRepo = createCertificateRepository({ client: fake });
    await certRepo.insert(certificateInsert({ vessel_id: vesselId, certificate_type: "LOAD_LINE", expiry_date: "2026-03-15", status: "VALID" }));

    const response = await postEvaluate(evaluateRequest({ now: NOW }), { params: { imo: IMO } }, deps);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.emittedEvents.length).toBe(1);
    expect(body.data.emittedEvents[0].event_type).toBe("CERTIFICATE_EXPIRED");
    expect(body.data.emittedEvents[0].severity).toBe("HIGH");
    expect(body.data.dispatchedNotifications).toBe(1);

    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("certificate_expired");
  });

  it("reconciles requirements into MISSING and UNKNOWN placeholders", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);

    const response = await postEvaluate(
      evaluateRequest({
        now: NOW,
        reconcile: {
          imo: IMO,
          name: "Aurelia",
          vesselType: "commercial",
          gt: 1250,
          lengthM: 60,
          ballastTanks: null,
        },
      }),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    const statuses = body.data.certificates.map((c: { status: string }) => c.status);
    expect(statuses).toContain("MISSING");
    expect(statuses).toContain("PENDING_REVIEW");
    expect(
      body.data.certificates.some(
        (c: { record: { certificate_type: string; reason_code: string | null } }) =>
          c.record.certificate_type === "TONNAGE" && c.record.reason_code === "UNCERTAIN_APPLICABILITY",
      ),
    ).toBe(true);
    expect(body.data.emittedEvents.some((e: { event_type: string }) => e.event_type === "MISSING")).toBe(true);
  });

  it("rejects invalid JSON", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);
    const response = await postEvaluate(evaluateRequest("not json"), { params: { imo: IMO } }, deps);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("rejects an invalid reconcile profile", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(fake);
    const response = await postEvaluate(
      evaluateRequest({ reconcile: { imo: IMO, name: "Aurelia", vesselType: "carrier" } }),
      { params: { imo: IMO } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await postEvaluate(
      evaluateRequest({}, "0000000"),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });
});

describe("POST /api/documents/[id]/certificate", () => {
  it("registers a certificate from a document and links the evidence", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody()),
      { params: { id: DOC_ID } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.documentId).toBe(DOC_ID);
    expect(body.data.certificate.document_id).toBe(DOC_ID);
    expect(body.data.certificate.status).toBe("VALID");
    expect(body.data.wasSuperseded).toBe(false);
    expect(body.data.blocking).toBe(false);
    expect(body.data.reviewRequired).toBe(false);
  });

  it("flags an IMO mismatch as blocking review-required", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody({ documentImo: "0000000" })),
      { params: { id: DOC_ID } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.blocking).toBe(true);
    expect(body.data.reviewRequired).toBe(true);
    expect(body.data.certificate.reason_code).toBe("IMO_MISMATCH");
  });

  it("routes a missing expiry to review without inventing a date", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody({ expiryDate: null })),
      { params: { id: DOC_ID } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.reviewRequired).toBe(true);
    expect(body.data.certificate.status).toBe("PENDING_REVIEW");
    expect(body.data.certificate.reason_code).toBe("MISSING_EXPIRY");
    expect(body.data.certificate.expiry_date).toBeNull();
  });

  it("supersedes an existing record for the same type", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    await postDocumentCertificate(documentCertificateRequest(validDocumentBody()), { params: { id: DOC_ID } }, deps);
    const second = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody({ certificateNumber: "IAPP-2025-9999" })),
      { params: { id: DOC_ID } },
      deps,
    );
    const body = await second.json();
    expect(body.data.wasSuperseded).toBe(true);
    expect(body.data.supersededId).toBeTruthy();
    expect(body.data.certificate.version).toBe(2);
  });

  it("returns 404 for an unknown document", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody(), "missing-doc"),
      { params: { id: "missing-doc" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDocumentDeps(createFakeSupabaseClient());
    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody({ imo: "0000000" })),
      { params: { id: DOC_ID } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("rejects invalid JSON", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest("not json"),
      { params: { id: DOC_ID } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("rejects a malformed expiry date", async () => {
    const { deps, vesselRepo } = buildDocumentDeps(createFakeSupabaseClient());
    await (vesselRepo as ReturnType<typeof createVesselRepository>).upsertByImo({ imo: IMO, name: "Aurelia" });

    const response = await postDocumentCertificate(
      documentCertificateRequest(validDocumentBody({ expiryDate: "14/05/2027" })),
      { params: { id: DOC_ID } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("createMockCertificateRepository", () => {
  it("isolates mock records by vessel and supports versioned insertion", async () => {
    const repo = createMockCertificateRepository();

    const other = await repo.findByVesselId("vsl-other");
    expect(other.length).toBe(0);

    const inserted = await repo.insert({
      vessel_id: CERT_MOCK_VESSEL.vesselId,
      imo: CERT_MOCK_VESSEL.imo,
      document_id: "doc-x",
      certificate_type: "ISCC",
      certificate_number: "ISCC-X",
      expiry_date: "2026-09-20",
      status: "EXPIRING_SOON",
      source: "document_ocr",
      version: 2,
      supersedes_id: "cert-1",
    });
    expect(inserted.id).toBeTruthy();
    expect(inserted.version).toBe(2);
    expect(inserted.supersedes_id).toBe("cert-1");
    expect(inserted.is_current).toBe(true);

    const byId = await repo.findById(inserted.id);
    expect(byId?.certificate_type).toBe("ISCC");
  });

  it("supersedes through the service and keeps history", async () => {
    const repo = createMockCertificateRepository();
    const service = new CertificateService({
      certRepo: repo,
      vesselRepo: {
        async findByImo(imo: string) {
          return imo === CERT_MOCK_VESSEL.imo
            ? { id: CERT_MOCK_VESSEL.vesselId, name: CERT_MOCK_VESSEL.name, gt: 1250, vesselType: "commercial", ballastTanks: null }
            : null;
        },
      },
    });

    const first = await service.registerFromDocument(
      CERT_MOCK_VESSEL.imo,
      {
        documentId: "doc-a",
        certificateType: "CLASS_CERTIFICATE",
        expiryDate: "2027-04-09",
        source: "document_ocr",
      },
      "2026-07-10T12:00:00.000Z",
    );
    const second = await service.registerFromDocument(
      CERT_MOCK_VESSEL.imo,
      {
        documentId: "doc-b",
        certificateType: "CLASS_CERTIFICATE",
        expiryDate: "2027-04-09",
        source: "document_ocr",
      },
      "2026-07-10T12:00:00.000Z",
    );

    expect(second.record.version).toBe(first.record.version + 1);
    expect(second.wasSuperseded).toBe(true);
    const firstAfter = await repo.findById(first.record.id);
    expect(firstAfter?.is_current).toBe(false);
  });
});

run();
