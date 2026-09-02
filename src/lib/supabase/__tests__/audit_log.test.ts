import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createAuditLogRepository } from "../repositories/audit_log";
import { RepositoryUpstreamError } from "../errors";
import type { AuditLogRow } from "../types";

const ORG_ID = "org-uuid-001";

function makeRow(overrides: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: overrides.id ?? "audit-uuid-001",
    organization_id: overrides.organization_id ?? ORG_ID,
    actor_id: overrides.actor_id ?? null,
    actor_email: overrides.actor_email ?? null,
    action: overrides.action ?? "vessel.updated",
    entity_type: overrides.entity_type ?? "vessel",
    entity_id: overrides.entity_id ?? "vessel-uuid-1",
    before_data: overrides.before_data ?? {},
    after_data: overrides.after_data ?? {},
    source: overrides.source ?? "app",
    correlation_id: overrides.correlation_id ?? null,
    recorded_at: overrides.recorded_at ?? "2026-07-29T10:00:00.000Z",
  };
}

describe("AuditLogRepository — insert", () => {
  it("inserts an entry and returns the row with defaults applied", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAuditLogRepository({ client: fake });

    const row = await repo.insert({
      organization_id: ORG_ID,
      actor_id: "user-marina",
      actor_email: "operator@poseidonledger.com",
      action: "vessel.updated",
      entity_type: "vessel",
      entity_id: "vessel-uuid-1",
      before_data: { name: "Old" },
      after_data: { name: "New" },
    });

    expect(row.organization_id).toBe(ORG_ID);
    expect(row.action).toBe("vessel.updated");
    expect(row.entity_type).toBe("vessel");
    expect(row.actor_email).toBe("operator@poseidonledger.com");
    expect(row.before_data.name).toBe("Old");
    expect(row.after_data.name).toBe("New");
    expect(row.id).toBeTruthy();
    expect(row.recorded_at).toBeTruthy();
  });

  it("defaults optional fields", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAuditLogRepository({ client: fake });

    const row = await repo.insert({
      organization_id: ORG_ID,
      action: "tenant.created",
      entity_type: "organization",
    });

    expect(row.actor_id).toBeNull();
    expect(row.actor_email).toBeNull();
    expect(row.entity_id).toBeNull();
    expect(row.source).toBe("app");
    expect(row.correlation_id).toBeNull();
  });
});

describe("AuditLogRepository — listByOrganization", () => {
  it("returns entries for an org, newest first", async () => {
    const e1 = makeRow({ id: "e1", recorded_at: "2026-07-29T10:00:00.000Z", action: "a" });
    const e2 = makeRow({ id: "e2", recorded_at: "2026-07-29T10:01:00.000Z", action: "b" });
    const otherOrg = makeRow({
      id: "e3",
      organization_id: "other-org",
      recorded_at: "2026-07-29T10:02:00.000Z",
    });
    const fake = createFakeSupabaseClient({
      tables: { audit_log: [e1, e2, otherOrg] },
    });
    const repo = createAuditLogRepository({ client: fake });

    const rows = await repo.listByOrganization(ORG_ID);

    expect(rows.length).toBe(2);
    expect(rows[0]!.id).toBe("e2");
    expect(rows[1]!.id).toBe("e1");
  });

  it("returns empty array when no entries exist", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAuditLogRepository({ client: fake });

    const rows = await repo.listByOrganization("nonexistent");
    expect(rows.length).toBe(0);
  });
});

describe("AuditLogRepository — listByEntity", () => {
  it("returns entries for an entity type/id, oldest first", async () => {
    const e1 = makeRow({ id: "e1", recorded_at: "2026-07-29T10:00:00.000Z", action: "a" });
    const e2 = makeRow({ id: "e2", recorded_at: "2026-07-29T10:01:00.000Z", action: "b" });
    const other = makeRow({
      id: "e3",
      entity_type: "vessel",
      entity_id: "vessel-uuid-2",
    });
    const fake = createFakeSupabaseClient({
      tables: { audit_log: [e1, e2, other] },
    });
    const repo = createAuditLogRepository({ client: fake });

    const rows = await repo.listByEntity("vessel", "vessel-uuid-1");

    expect(rows.length).toBe(2);
    expect(rows[0]!.id).toBe("e1");
    expect(rows[1]!.id).toBe("e2");
  });
});

describe("AuditLogRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createAuditLogRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        organization_id: ORG_ID,
        action: "vessel.updated",
        entity_type: "vessel",
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
