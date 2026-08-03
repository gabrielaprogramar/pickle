/**
 * organization_users.test.ts — supabase OrganizationUserRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOrganizationUserRepository } from "../repositories/organization_users";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-1";

const USER_ROW = {
  id: "user-1",
  organization_id: ORG_ID,
  email: "a@poseidon.com",
  full_name: "Alice",
  avatar_url: null,
  password_hash: "hash",
  role: "viewer",
  status: "active",
  last_login_at: null,
  created_at: NOW,
  updated_at: NOW,
};

describe("OrganizationUserRepository — insert", () => {
  it("inserts a member with defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationUserRepository({ client: fake });

    const row = await repo.insert({
      organization_id: ORG_ID,
      email: "a@poseidon.com",
      full_name: "Alice",
      password_hash: "hash",
      role: "viewer",
    });

    expect(row.id).toBeTruthy();
    expect(row.status).toBe("active");
    expect(row.avatar_url).toBeNull();
    expect(row.last_login_at).toBeNull();
  });
});

describe("OrganizationUserRepository — lookups", () => {
  it("finds by id and by email", async () => {
    const fake = createFakeSupabaseClient({ tables: { organization_users: [USER_ROW] } });
    const repo = createOrganizationUserRepository({ client: fake });

    expect((await repo.findById("user-1"))!.email).toBe("a@poseidon.com");
    expect((await repo.findByEmail("a@poseidon.com"))!.id).toBe("user-1");
    expect(await repo.findByEmail("missing@poseidon.com")).toBeNull();
  });

  it("finds by org + email (tenant-scoped)", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organization_users: [
          USER_ROW,
          { ...USER_ROW, id: "user-2", email: "a@poseidon.com", organization_id: "org-2" },
        ],
      },
    });
    const repo = createOrganizationUserRepository({ client: fake });

    const row = await repo.findByOrgAndEmail(ORG_ID, "a@poseidon.com");
    expect(row!.id).toBe("user-1");
    expect(await repo.findByOrgAndEmail("org-2", "a@poseidon.com")).toBeTruthy();
    expect(await repo.findByOrgAndEmail(ORG_ID, "nope@x.com")).toBeNull();
  });

  it("lists members of an organization", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organization_users: [
          USER_ROW,
          { ...USER_ROW, id: "user-3", email: "b@poseidon.com", organization_id: "org-9" },
        ],
      },
    });
    const repo = createOrganizationUserRepository({ client: fake });

    const rows = await repo.listByOrganizationId(ORG_ID);
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe("user-1");
  });
});

describe("OrganizationUserRepository — update", () => {
  it("updates role and status", async () => {
    const fake = createFakeSupabaseClient({ tables: { organization_users: [USER_ROW] } });
    const repo = createOrganizationUserRepository({ client: fake });

    const updated = await repo.update("user-1", { role: "fleet_manager", status: "inactive" });
    expect(updated.role).toBe("fleet_manager");
    expect(updated.status).toBe("inactive");
  });
});

run();
