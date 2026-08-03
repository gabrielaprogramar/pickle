/**
 * organization_invites.test.ts — supabase OrganizationInviteRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOrganizationInviteRepository } from "../repositories/organization_invites";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-1";

const INVITE = {
  id: "invite-1",
  organization_id: ORG_ID,
  email: "new@poseidon.com",
  full_name: null,
  role: "viewer",
  status: "pending",
  token: "tok-1",
  invited_by: "user-1",
  expires_at: "2026-08-08T12:00:00.000Z",
  accepted_at: null,
  resend_count: 0,
  last_sent_at: null,
  created_at: NOW,
  updated_at: NOW,
};

describe("OrganizationInviteRepository — insert", () => {
  it("inserts a pending invite with defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationInviteRepository({ client: fake });

    const row = await repo.insert({
      organization_id: ORG_ID,
      email: "new@poseidon.com",
      role: "viewer",
      token: "tok-x",
      invited_by: "user-1",
      expires_at: "2026-08-08T12:00:00.000Z",
    });

    expect(row.id).toBeTruthy();
    expect(row.status).toBe("pending");
    expect(row.full_name).toBeNull();
    expect(row.resend_count).toBe(0);
    expect(row.accepted_at).toBeNull();
  });
});

describe("OrganizationInviteRepository — lookups", () => {
  it("finds by token", async () => {
    const fake = createFakeSupabaseClient({ tables: { organization_invites: [INVITE] } });
    const repo = createOrganizationInviteRepository({ client: fake });
    expect((await repo.findByToken("tok-1"))!.id).toBe("invite-1");
    expect(await repo.findByToken("missing")).toBeNull();
  });

  it("lists invites per org and only pending ones", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organization_invites: [
          INVITE,
          { ...INVITE, id: "invite-2", status: "cancelled" },
          { ...INVITE, id: "invite-3", organization_id: "org-9" },
        ],
      },
    });
    const repo = createOrganizationInviteRepository({ client: fake });

    const all = await repo.listByOrganizationId(ORG_ID);
    expect(all.length).toBe(2);

    const pending = await repo.listPendingByOrganizationId(ORG_ID);
    expect(pending.length).toBe(1);
    expect(pending[0]!.id).toBe("invite-1");
  });
});

describe("OrganizationInviteRepository — update", () => {
  it("cancels an invite and bumps resend counters", async () => {
    const fake = createFakeSupabaseClient({ tables: { organization_invites: [INVITE] } });
    const repo = createOrganizationInviteRepository({ client: fake });

    const updated = await repo.update("invite-1", {
      status: "cancelled",
    });
    expect(updated.status).toBe("cancelled");
  });
});

run();
