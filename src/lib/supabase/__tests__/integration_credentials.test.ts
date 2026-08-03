/**
 * integration_credentials.test.ts — supabase IntegrationCredentialRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createIntegrationCredentialRepository } from "../repositories/integration_credentials";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-1";

const CREDENTIAL = {
  id: "cred-1",
  organization_id: ORG_ID,
  provider: "marinetraffic",
  status: "NOT_CONFIGURED",
  encrypted_config: {},
  configured_at: null,
  created_at: NOW,
  updated_at: NOW,
};

describe("IntegrationCredentialRepository — insert", () => {
  it("inserts a NOT_CONFIGURED credential by default", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createIntegrationCredentialRepository({ client: fake });

    const row = await repo.insert({
      organization_id: ORG_ID,
      provider: "resend",
    });

    expect(row.id).toBeTruthy();
    expect(row.status).toBe("NOT_CONFIGURED");
    expect(row.encrypted_config).toEqual({});
    expect(row.configured_at).toBeNull();
  });
});

describe("IntegrationCredentialRepository — upsert", () => {
  it("upserts per org + provider (onConflict organization_id,provider)", async () => {
    const fake = createFakeSupabaseClient({ tables: { integration_credentials: [CREDENTIAL] } });
    const repo = createIntegrationCredentialRepository({ client: fake });

    const row = await repo.upsertByOrganizationAndProvider(ORG_ID, "marinetraffic", {
      organization_id: ORG_ID,
      provider: "marinetraffic",
      status: "CONFIGURED",
      encrypted_config: { apiKey: "envelope" },
      configured_at: NOW,
    });

    expect(row.id).toBe("cred-1");
    expect(row.status).toBe("CONFIGURED");
    expect(row.encrypted_config).toEqual({ apiKey: "envelope" });

    const stored = await repo.findByOrganizationAndProvider(ORG_ID, "marinetraffic");
    expect(stored!.status).toBe("CONFIGURED");
  });

  it("finds by org + provider and returns null when absent", async () => {
    const fake = createFakeSupabaseClient({ tables: { integration_credentials: [CREDENTIAL] } });
    const repo = createIntegrationCredentialRepository({ client: fake });

    expect((await repo.findByOrganizationAndProvider(ORG_ID, "marinetraffic"))!.id).toBe("cred-1");
    expect(await repo.findByOrganizationAndProvider(ORG_ID, "openai")).toBeNull();
  });
});

describe("IntegrationCredentialRepository — list", () => {
  it("lists credentials for an org", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        integration_credentials: [
          CREDENTIAL,
          { ...CREDENTIAL, id: "cred-2", provider: "openai", organization_id: "org-9" },
        ],
      },
    });
    const repo = createIntegrationCredentialRepository({ client: fake });

    const rows = await repo.listByOrganizationId(ORG_ID);
    expect(rows.length).toBe(1);
    expect(rows[0]!.provider).toBe("marinetraffic");
  });
});

run();
