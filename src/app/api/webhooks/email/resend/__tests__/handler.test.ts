import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createMockStorageClient } from "@/lib/storage/mock-storage";
import { createMockEmailIngressProvider } from "@/lib/email-ingress/mock-provider";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createDocumentRepository } from "@/lib/supabase/repositories/documents";
import { createDocumentVersionRepository } from "@/lib/supabase/repositories/document_versions";
import { createProcessingJobRepository } from "@/lib/supabase/repositories/processing_jobs";
import { createProcessingLogRepository } from "@/lib/supabase/repositories/processing_logs";
import { createEmailIngestionLogRepository } from "@/lib/supabase/repositories/email_ingestion_log";
import { handleResendWebhook } from "../handler";
import type { ResendWebhookDeps } from "../handler";

function buildDeps() {
  const fake = createFakeSupabaseClient();
  const emailIngress = createMockEmailIngressProvider();
  const storageClient = createMockStorageClient();

  const deps: ResendWebhookDeps = {
    emailIngress,
    auditLogRepo: createEmailIngestionLogRepository({ client: fake }),
    vesselRepo: createVesselRepository({ client: fake }),
    documentRepo: createDocumentRepository({ client: fake }),
    versionRepo: createDocumentVersionRepository({ client: fake }),
    jobRepo: createProcessingJobRepository({ client: fake }),
    processingLogRepo: createProcessingLogRepository({ client: fake }),
    storageClient,
  };

  return { deps, fake, emailIngress, storageClient };
}

async function seedVessel(deps: ResendWebhookDeps): Promise<string> {
  const vessel = await deps.vesselRepo.upsertByImo({
    imo: "9876543",
    name: "MV Poseidon Explorer",
  });
  return vessel.id;
}

function makeValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    message_id: "test-msg-001",
    from: "captain@fleet-operator.com",
    to: ["imo9876543@docs.poseidonledger.com"],
    subject: "BDN - Port of Rotterdam",
    text: "Please find the BDN attached.",
    html: null,
    attachments: [
      {
        filename: "bdn.pdf",
        content: Buffer.from("pdf content").toString("base64"),
        content_type: "application/pdf",
      },
    ],
    created_at: "2026-07-30T12:00:00Z",
    ...overrides,
  };
}

describe("handleResendWebhook", () => {
  it("accepts valid BDN email and creates document", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload()),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.accepted).toBe(true);
    expect(body.data.imo).toBe("9876543");
    expect(body.data.acceptedCount).toBe(1);
    expect(body.data.rejectedCount).toBe(0);
  });

  it("rejects request with missing body", async () => {
    const { deps } = buildDeps();

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: null,
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(400);
  });

  it("rejects request with invalid JSON", async () => {
    const { deps } = buildDeps();

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(400);
  });

  it("rejects request with invalid recipient format", async () => {
    const { deps } = buildDeps();

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({ to: ["imoabc1234@docs.poseidonledger.com"] })),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(400);
  });

  it("rejects request with unknown vessel IMO", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({ to: ["imo0000000@docs.poseidonledger.com"] })),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(404);
  });

  it("rejects request with unsupported attachment type", async () => {
    const { deps, emailIngress } = buildDeps();
    const vesselId = await seedVessel(deps);
    emailIngress.setScenario("unsupported_file");

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({
        attachments: [
          {
            filename: "bdn.pdf",
            content: Buffer.from("pdf").toString("base64"),
            content_type: "application/pdf",
          },
          {
            filename: "data.xlsx",
            content: Buffer.from("xlsx").toString("base64"),
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      })),
    });

    const response = await handleResendWebhook(request, deps);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.accepted).toBe(true);
    expect(body.data.acceptedCount).toBe(1);
    expect(body.data.rejectedCount).toBe(1);
  });

  it("handles duplicate attachment detection", async () => {
    const { deps, emailIngress } = buildDeps();
    await seedVessel(deps);
    emailIngress.setScenario("duplicate_attachment");

    const sameContent = Buffer.from("duplicate content for testing").toString("base64");
    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({
        attachments: [
          {
            filename: "bdn.pdf",
            content: sameContent,
            content_type: "application/pdf",
          },
          {
            filename: "bdn-copy.pdf",
            content: sameContent,
            content_type: "application/pdf",
          },
        ],
      })),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data.acceptedCount).toBe(1);
    expect(body.data.duplicateCount).toBe(1);
  });

  it("creates document with source_channel EMAIL", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload()),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data.accepted).toBe(true);
  });

  it("logs audit events throughout the pipeline", async () => {
    const { deps, fake } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload()),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(201);
  });

  it("handles missing subject gracefully", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({ subject: null })),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(201);
  });

  it("handles email with no attachments", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const request = new Request("https://example.com/api/webhooks/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeValidPayload({ attachments: [] })),
    });

    const response = await handleResendWebhook(request, deps);
    expect(response.status).toBe(202);
  });
});

run();
