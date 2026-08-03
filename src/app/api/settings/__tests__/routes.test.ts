/**
 * routes.test.ts — settings API route tests (Phase 4.5)
 *
 * Exercises GET/PATCH /api/settings, POST /api/settings/invites,
 * PATCH /api/settings/invites/[id] and PATCH /api/settings/users/[id] with a
 * fixed authenticated session over a fake Supabase client.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import { createOrganizationSettingsRepository } from "@/lib/supabase/repositories/organization_settings";
import { createOrganizationInviteRepository } from "@/lib/supabase/repositories/organization_invites";
import { createIntegrationCredentialRepository } from "@/lib/supabase/repositories/integration_credentials";
import { createSettingsService } from "@/lib/settings";
import type { SettingsApiDeps } from "../_lib";
import { GET as getSettings, PATCH as patchSettings } from "../route";
import { POST as postInvite } from "../invites/route";
import { PATCH as patchInvite } from "../invites/[id]/route";
import { PATCH as patchUser } from "../users/[id]/route";
import { hashPassword } from "@/lib/auth/passwords";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-001";
const OWNER_ID = "user-owner";
const MEMBER_ID = "user-member";

function build(actorRole = "owner") {
  const fake = createFakeSupabaseClient({
    tables: {
      organizations: [
        {
          id: ORG_ID,
          name: "Demo Organization",
          company_logo_url: null,
          country: "GR",
          imo_company_number: "1234567",
          address: null,
          billing_email: null,
          support_email: null,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      organization_settings: [
        {
          id: "settings-001",
          organization_id: ORG_ID,
          default_timezone: "UTC",
          default_reporting_year: 2026,
          language: "en",
          appearance: { theme: "dark", accent: "blue", sidebarDensity: "compact", tableDensity: "compact", gridView: "grid" },
          notification_preferences: { emails: true, complianceAlerts: true, certificateExpiry: true, fuelAlerts: true, noonReport: true, assistantDigests: true, systemAnnouncements: true },
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      organization_users: [
        {
          id: OWNER_ID,
          organization_id: ORG_ID,
          email: "owner@poseidonledger.com",
          full_name: "Owner",
          avatar_url: null,
          role: "owner",
          status: "active",
          password_hash: hashPassword("demo1234"),
          last_login_at: null,
          created_at: NOW,
          updated_at: NOW,
        },
        {
          id: MEMBER_ID,
          organization_id: ORG_ID,
          email: "member@poseidonledger.com",
          full_name: "Member",
          avatar_url: null,
          role: "viewer",
          status: "active",
          password_hash: hashPassword("demo1234"),
          last_login_at: null,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      organization_invites: [],
      integration_credentials: [],
    },
  });

  const settings = createSettingsService({
    organizationRepo: createOrganizationRepository({ client: fake }),
    settingsRepo: createOrganizationSettingsRepository({ client: fake }),
    userRepo: createOrganizationUserRepository({ client: fake }),
    inviteRepo: createOrganizationInviteRepository({ client: fake }),
    credentialRepo: createIntegrationCredentialRepository({ client: fake }),
  });

  const deps: SettingsApiDeps = {
    settings,
    session: async () => ({
      user: {
        id: OWNER_ID,
        email: "owner@poseidonledger.com",
        fullName: "Owner",
        avatarUrl: null,
        role: actorRole,
        status: "active",
        lastLoginAt: null,
      },
      organization: { id: ORG_ID, name: "Demo Organization", companyLogoUrl: null },
    }),
  };
  return { deps, fake };
}

function jsonRequest(body: unknown, method = "PATCH"): Request {
  return new Request("https://app.example.com/api/settings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/settings", () => {
  it("returns the full settings bundle", async () => {
    const { deps } = build();
    const res = await getSettings(
      new Request("https://app.example.com/api/settings"),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.organization.id).toBe(ORG_ID);
    expect(body.data.users.length).toBe(2);
    expect(body.data.integrations.length).toBe(5);
  });
});

describe("PATCH /api/settings", () => {
  it("updates the organization section", async () => {
    const { deps } = build();
    const res = await patchSettings(
      jsonRequest({ section: "organization", organization: { name: "Poseidon Shipping" } }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.organization.name).toBe("Poseidon Shipping");
  });

  it("requires a section", async () => {
    const { deps } = build();
    const res = await patchSettings(jsonRequest({}), undefined, deps);
    expect(res.status).toBe(400);
  });

  it("updates general settings", async () => {
    const { deps } = build();
    const res = await patchSettings(
      jsonRequest({ section: "general", general: { defaultTimezone: "Europe/Athens" } }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.general.defaultTimezone).toBe("Europe/Athens");
  });

  it("updates appearance", async () => {
    const { deps } = build();
    const res = await patchSettings(
      jsonRequest({
        section: "appearance",
        appearance: { theme: "light", accent: "teal", sidebarDensity: "comfortable", tableDensity: "compact", gridView: "list" },
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.appearance.theme).toBe("light");
  });

  it("updates notifications", async () => {
    const { deps } = build();
    const res = await patchSettings(
      jsonRequest({
        section: "notifications",
        notifications: { emails: false, complianceAlerts: true, certificateExpiry: true, fuelAlerts: true, noonReport: true, assistantDigests: true, systemAnnouncements: true },
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.notifications.emails).toBe(false);
  });

  it("configures and disconnects an integration", async () => {
    const { deps } = build();
    const configured = await patchSettings(
      jsonRequest({
        section: "integrations",
        integrations: { provider: "marinetraffic", action: "configure", config: { apiKey: "sk", endpoint: "https://api.example.com" } },
      }),
      undefined,
      deps,
    );
    expect(configured.status).toBe(200);
    const cBody = await configured.json();
    expect(cBody.data.integration.status).toBe("CONFIGURED");

    const disconnected = await patchSettings(
      jsonRequest({
        section: "integrations",
        integrations: { provider: "marinetraffic", action: "disconnect" },
      }),
      undefined,
      deps,
    );
    const dBody = await disconnected.json();
    expect(dBody.data.integration.status).toBe("NOT_CONFIGURED");
  });

  it("rejects unknown providers", async () => {
    const { deps } = build();
    const res = await patchSettings(
      jsonRequest({
        section: "integrations",
        integrations: { provider: "spacex", action: "configure", config: {} },
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(400);
  });

  it("forbids a viewer from updating the organization", async () => {
    const { deps } = build("viewer");
    const res = await patchSettings(
      jsonRequest({ section: "organization", organization: { name: "Hijacked" } }),
      undefined,
      deps,
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/settings/invites", () => {
  it("creates an invite as an owner", async () => {
    const { deps } = build();
    const res = await postInvite(
      jsonRequest({ email: "new@poseidonledger.com", fullName: "New Hire", role: "viewer" }, "POST"),
      undefined,
      deps,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.invite.email).toBe("new@poseidonledger.com");
    expect(body.data.invite.status).toBe("pending");
  });

  it("rejects an existing member with 409", async () => {
    const { deps } = build();
    const res = await postInvite(
      jsonRequest({ email: "member@poseidonledger.com", role: "viewer" }, "POST"),
      undefined,
      deps,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVITE_CONFLICT");
  });

  it("rejects an unknown role with 400", async () => {
    const { deps } = build();
    const res = await postInvite(
      jsonRequest({ email: "new@poseidonledger.com", role: "captain" }, "POST"),
      undefined,
      deps,
    );
    expect(res.status).toBe(400);
  });

  it("forbids a viewer from inviting", async () => {
    const { deps } = build("viewer");
    const res = await postInvite(
      jsonRequest({ email: "new@poseidonledger.com", role: "viewer" }, "POST"),
      undefined,
      deps,
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/settings/invites/[id]", () => {
  async function createInviteId(deps: SettingsApiDeps): Promise<string> {
    const res = await postInvite(
      jsonRequest({ email: "new@poseidonledger.com", role: "viewer" }, "POST"),
      undefined,
      deps,
    );
    const body = await res.json();
    return body.data.invite.id as string;
  }

  it("cancels a pending invite", async () => {
    const { deps } = build();
    const id = await createInviteId(deps);
    const res = await patchInvite(
      jsonRequest({ action: "cancel" }),
      { params: { id } },
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.invite.status).toBe("cancelled");
  });

  it("resends a pending invite", async () => {
    const { deps } = build();
    const id = await createInviteId(deps);
    const res = await patchInvite(
      jsonRequest({ action: "resend" }),
      { params: { id } },
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.invite.resendCount).toBe(1);
  });

  it("returns 404 for an unknown invite", async () => {
    const { deps } = build();
    const res = await patchInvite(
      jsonRequest({ action: "cancel" }),
      { params: { id: "ghost" } },
      deps,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("INVITE_NOT_FOUND");
  });
});

describe("PATCH /api/settings/users/[id]", () => {
  it("promotes a member as an owner", async () => {
    const { deps } = build();
    const res = await patchUser(
      jsonRequest({ role: "fleet_manager" }),
      { params: { id: MEMBER_ID } },
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.role).toBe("fleet_manager");
  });

  it("rejects a self-demotion", async () => {
    const { deps } = build();
    const res = await patchUser(
      jsonRequest({ role: "viewer" }),
      { params: { id: OWNER_ID } },
      deps,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an unknown role with 400", async () => {
    const { deps } = build();
    const res = await patchUser(
      jsonRequest({ role: "captain" }),
      { params: { id: MEMBER_ID } },
      deps,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown user", async () => {
    const { deps } = build();
    const res = await patchUser(
      jsonRequest({ role: "viewer" }),
      { params: { id: "ghost" } },
      deps,
    );
    expect(res.status).toBe(404);
  });

  it("forbids a viewer from managing members", async () => {
    const { deps } = build("viewer");
    const res = await patchUser(
      jsonRequest({ role: "viewer" }),
      { params: { id: MEMBER_ID } },
      deps,
    );
    expect(res.status).toBe(403);
  });
});

run();
