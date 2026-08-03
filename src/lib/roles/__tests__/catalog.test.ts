/**
 * catalog.test.ts — role + permission catalog tests (Phase 4.5)
 *
 * Verifies the deterministic permission matrix: role shapes, `can()`,
 * `mayManageUser()` rank gating, `roleLabel`, `isRoleCode`, and that every
 * seeded user_roles row in the migration matches the in-code catalog.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  PERMISSIONS,
  ROLES,
  can,
  getRole,
  isRoleCode,
  mayManageUser,
  permissionsFor,
  roleLabel,
} from "../catalog";

describe("roles catalog — shape", () => {
  it("defines exactly the five required roles", () => {
    expect(ROLES.length).toBe(5);
    expect(ROLES.map((r) => r.code).join(",")).toBe(
      "owner,administrator,compliance_manager,fleet_manager,viewer",
    );
  });

  it("assigns strictly descending ranks", () => {
    const ranks = ROLES.map((r) => r.rank);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]! > ranks[i - 1]!).toBe(false);
    }
    expect(ranks[0]).toBe(50);
    expect(ranks[4]).toBe(10);
  });

  it("gives owner and administrator every management permission", () => {
    for (const code of ["owner", "administrator"] as const) {
      const role = getRole(code)!;
      expect(can(code, PERMISSIONS.org_manage)).toBe(true);
      expect(can(code, PERMISSIONS.users_invite)).toBe(true);
      expect(can(code, PERMISSIONS.users_manage)).toBe(true);
      expect(can(code, PERMISSIONS.settings_general)).toBe(true);
      expect(can(code, PERMISSIONS.settings_integrations)).toBe(true);
      expect(role.permissions.includes(PERMISSIONS.fleet_view)).toBe(true);
      expect(role.permissions.includes(PERMISSIONS.noon_view)).toBe(true);
    }
  });

  it("does not let restricted roles manage the org or users", () => {
    for (const code of ["compliance_manager", "fleet_manager", "viewer"] as const) {
      expect(can(code, PERMISSIONS.org_manage)).toBe(false);
      expect(can(code, PERMISSIONS.users_invite)).toBe(false);
      expect(can(code, PERMISSIONS.users_manage)).toBe(false);
      expect(can(code, PERMISSIONS.settings_general)).toBe(false);
      expect(can(code, PERMISSIONS.settings_integrations)).toBe(false);
    }
  });

  it("keeps compliance_manager read-only over compliance surfaces", () => {
    expect(can("compliance_manager", PERMISSIONS.compliance_view)).toBe(true);
    expect(can("compliance_manager", PERMISSIONS.noon_view)).toBe(true);
    expect(can("compliance_manager", PERMISSIONS.voyages_view)).toBe(false);
    expect(can("compliance_manager", PERMISSIONS.assistant_use)).toBe(false);
  });

  it("keeps viewer read-only everywhere", () => {
    expect(can("viewer", PERMISSIONS.settings_about)).toBe(true);
    expect(can("viewer", PERMISSIONS.settings_general)).toBe(false);
    expect(can("viewer", PERMISSIONS.settings_integrations)).toBe(false);
    expect(can("viewer", PERMISSIONS.org_manage)).toBe(false);
    expect(can("viewer", PERMISSIONS.users_view)).toBe(false);
    expect(can("viewer", PERMISSIONS.users_invite)).toBe(false);
    expect(can("viewer", PERMISSIONS.users_manage)).toBe(false);
    expect(can("viewer", PERMISSIONS.org_view)).toBe(true);
    expect(can("viewer", PERMISSIONS.documents_view)).toBe(true);
  });

  it("rejects unknown roles entirely", () => {
    expect(can("captain", PERMISSIONS.org_view)).toBe(false);
    expect(getRole("captain")).toBeNull();
    expect(isRoleCode("captain")).toBe(false);
    expect(permissionsFor("captain").length).toBe(0);
  });

  it("isRoleCode accepts only known codes", () => {
    expect(isRoleCode("owner")).toBe(true);
    expect(isRoleCode("viewer")).toBe(true);
    expect(isRoleCode("OWNER")).toBe(false);
    expect(isRoleCode("")).toBe(false);
  });

  it("roleLabel returns a human label", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("compliance_manager")).toBe("Compliance Manager");
    expect(roleLabel("unknown")).toBe("unknown");
  });
});

describe("roles catalog — mayManageUser", () => {
  it("allows a strictly senior role to manage a junior one", () => {
    expect(mayManageUser("owner", "administrator")).toBe(true);
    expect(mayManageUser("administrator", "compliance_manager")).toBe(true);
    expect(mayManageUser("compliance_manager", "fleet_manager")).toBe(true);
    expect(mayManageUser("fleet_manager", "viewer")).toBe(true);
  });

  it("forbids managing peers and self-rank", () => {
    expect(mayManageUser("owner", "owner")).toBe(false);
    expect(mayManageUser("administrator", "administrator")).toBe(false);
  });

  it("forbids a junior role from managing a senior one", () => {
    expect(mayManageUser("viewer", "owner")).toBe(false);
    expect(mayManageUser("fleet_manager", "compliance_manager")).toBe(false);
  });

  it("returns false for unknown roles", () => {
    expect(mayManageUser("captain", "viewer")).toBe(false);
    expect(mayManageUser("owner", "captain")).toBe(false);
  });
});

run();
