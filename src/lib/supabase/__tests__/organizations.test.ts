/**
 * organizations.test.ts — supabase OrganizationRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOrganizationRepository } from "../repositories/organizations";
import { RepositoryUpstreamError } from "../errors";

const NOW = "2026-08-01T12:00:00.000Z";

describe("OrganizationRepository — insert", () => {
  it("inserts an organization with server-defaulted fields", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationRepository({ client: fake });

    const row = await repo.insert({ name: "Acme Shipping" });

    expect(row.id).toBeTruthy();
    expect(row.name).toBe("Acme Shipping");
    expect(row.country).toBeNull();
    expect(row.imo_company_number).toBeNull();
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  it("maps an upstream error to RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({ globalError: { code: "57014", message: "canceling statement due to statement timeout" } });
    const repo = createOrganizationRepository({ client: fake });
    await expect(async () => await repo.insert({ name: "X" })).toThrow(RepositoryUpstreamError);
  });
});

describe("OrganizationRepository — findById / listAll / update", () => {
  it("finds an existing organization", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organizations: [
          { id: "org-1", name: "Acme Shipping", country: "GR", created_at: NOW, updated_at: NOW },
        ],
      },
    });
    const repo = createOrganizationRepository({ client: fake });

    const row = await repo.findById("org-1");
    expect(row).toBeTruthy();
    expect(row!.name).toBe("Acme Shipping");
    expect(row!.country).toBe("GR");
  });

  it("returns null for a missing organization", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationRepository({ client: fake });
    expect(await repo.findById("nope")).toBeNull();
  });

  it("lists all organizations ordered by name", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organizations: [
          { id: "org-2", name: "Zeta", created_at: NOW, updated_at: NOW },
          { id: "org-1", name: "Alpha", created_at: NOW, updated_at: NOW },
        ],
      },
    });
    const repo = createOrganizationRepository({ client: fake });

    const rows = await repo.listAll();
    expect(rows.length).toBe(2);
    expect(rows[0]!.name).toBe("Alpha");
  });

  it("updates select fields", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organizations: [
          { id: "org-1", name: "Acme", country: null, created_at: NOW, updated_at: NOW },
        ],
      },
    });
    const repo = createOrganizationRepository({ client: fake });

    const updated = await repo.update("org-1", { name: "Acme GmbH", country: "DE" });
    expect(updated.name).toBe("Acme GmbH");
    expect(updated.country).toBe("DE");
  });
});

run();
