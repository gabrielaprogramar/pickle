/**
 * user_roles.test.ts — supabase UserRoleRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createUserRoleRepository } from "../repositories/user_roles";

describe("UserRoleRepository — insert", () => {
  it("inserts a role and applies defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createUserRoleRepository({ client: fake });

    const row = await repo.insert({
      code: "owner",
      label: "Owner",
      permissions: ["org.view"],
      rank: 50,
    });

    expect(row.code).toBe("owner");
    expect(row.label).toBe("Owner");
    expect(row.permissions).toEqual(["org.view"]);
    expect(row.rank).toBe(50);
    expect(row.description).toBeNull();
  });
});

describe("UserRoleRepository — findByCode / listAll", () => {
  it("finds a role by code", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        user_roles: [
          { code: "viewer", label: "Viewer", description: null, permissions: [], rank: 10 },
        ],
      },
    });
    const repo = createUserRoleRepository({ client: fake });

    const row = await repo.findByCode("viewer");
    expect(row).toBeTruthy();
    expect(row!.label).toBe("Viewer");
    expect(row!.rank).toBe(10);
  });

  it("returns null for an unknown code", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createUserRoleRepository({ client: fake });
    expect(await repo.findByCode("captain")).toBeNull();
  });

  it("lists roles ordered by ascending rank", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        user_roles: [
          { code: "owner", label: "Owner", description: null, permissions: [], rank: 50 },
          { code: "viewer", label: "Viewer", description: null, permissions: [], rank: 10 },
        ],
      },
    });
    const repo = createUserRoleRepository({ client: fake });

    const rows = await repo.listAll();
    expect(rows.length).toBe(2);
    expect(rows[0]!.code).toBe("viewer");
    expect(rows[1]!.code).toBe("owner");
  });
});

run();
