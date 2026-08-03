/**
 * service.test.ts — settings service tests (Phase 4.5)
 *
 * Exercises the full settings surface: bundle assembly, organization/general/
 * appearance/notifications updates, member management rules (last owner, self-
 * demotion, seniority), invitations, and integration credential lifecycle.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import { createOrganizationSettingsRepository } from "@/lib/supabase/repositories/organization_settings";
import { createOrganizationInviteRepository } from "@/lib/supabase/repositories/organization_invites";
import { createIntegrationCredentialRepository } from "@/lib/supabase/repositories/integration_credentials";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createSettingsService } from "../index";
import {
  CannotDeactivateLastOwnerError,
  CannotDemoteSelfError,
  InvalidIntegrationError,
  InviteConflictError,
  InviteNotFoundError,
  OrganizationNotFoundError,
  UserNotFoundError,
} from "../errors";
import type { AppearanceSettings } from "../types";
import { hashPassword } from "@/lib/auth/passwords";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-001";
const OWNER_ID = "user-owner";
const MEMBER_ID = "user-member";

function makeSeed() {
  return {
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
  };
}

function build() {
  const fake = createFakeSupabaseClient({ tables: makeSeed() });
  const email = createMockNotificationEmailProvider();
  const service = createSettingsService({
    organizationRepo: createOrganizationRepository({ client: fake }),
    settingsRepo: createOrganizationSettingsRepository({ client: fake }),
    userRepo: createOrganizationUserRepository({ client: fake }),
    inviteRepo: createOrganizationInviteRepository({ client: fake }),
    credentialRepo: createIntegrationCredentialRepository({ client: fake }),
    emailProvider: email,
  });
  return { fake, email, service };
}

describe("settings service — bundle", () => {
  it("assembles the full bundle with org defaults", async () => {
    const { service } = build();
    const bundle = await service.getBundle(ORG_ID);

    expect(bundle.organization.id).toBe(ORG_ID);
    expect(bundle.organization.country).toBe("GR");
    expect(bundle.general.organizationName).toBe("Demo Organization");
    expect(bundle.general.defaultTimezone).toBe("UTC");
    expect(bundle.general.defaultReportingYear).toBe(2026);
    expect(bundle.appearance.theme).toBe("dark");
    expect(bundle.notificationPreferences.emails).toBe(true);
    expect(bundle.users.length).toBe(2);
    expect(bundle.invites).toEqual([]);
    expect(bundle.integrations.length).toBe(5);
    expect(bundle.integrations.every((i) => i.status === "NOT_CONFIGURED")).toBe(true);
    expect(bundle.about.appName.length > 0).toBe(true);
    expect(bundle.about.authMode).toBe("mock");
  });

  it("throws OrganizationNotFoundError for an unknown org", async () => {
    const { service } = build();
    await expect(
      async () => await service.getBundle("org-missing"),
    ).toThrow(OrganizationNotFoundError);
  });
});

describe("settings service — organization profile", () => {
  it("updates profile fields", async () => {
    const { service } = build();
    const updated = await service.updateOrganization(ORG_ID, {
      name: "Poseidon Shipping",
      country: "NO",
      supportEmail: "support@poseidon.com",
    });

    expect(updated.name).toBe("Poseidon Shipping");
    expect(updated.country).toBe("NO");
    expect(updated.supportEmail).toBe("support@poseidon.com");
    expect(updated.imoCompanyNumber).toBe("1234567");
  });
});

describe("settings service — general", () => {
  it("updates settings and renames the org", async () => {
    const { service } = build();
    const result = await service.updateGeneral(ORG_ID, {
      organizationName: "Poseidon Shipping",
      defaultTimezone: "Europe/Athens",
      defaultReportingYear: 2027,
    });

    expect(result.organizationName).toBe("Poseidon Shipping");
    expect(result.defaultTimezone).toBe("Europe/Athens");
    expect(result.defaultReportingYear).toBe(2027);

    const bundle = await service.getBundle(ORG_ID);
    expect(bundle.organization.name).toBe("Poseidon Shipping");
    expect(bundle.general.defaultTimezone).toBe("Europe/Athens");
  });
});

describe("settings service — appearance", () => {
  it("normalizes and persists appearance", async () => {
    const { service } = build();
    const result = await service.updateAppearance(ORG_ID, {
      theme: "light",
      accent: "teal",
      sidebarDensity: "comfortable",
      tableDensity: "roomy",
      gridView: "list",
    });

    expect(result.theme).toBe("light");
    expect(result.accent).toBe("teal");
    expect(result.tableDensity).toBe("roomy");

    const bundle = await service.getBundle(ORG_ID);
    expect(bundle.appearance.theme).toBe("light");
    expect(bundle.appearance.accent).toBe("teal");
  });

  it("falls back to defaults for invalid values", async () => {
    const { service } = build();
    const result = await service.updateAppearance(ORG_ID, {
      theme: "neon",
      accent: "purple",
      sidebarDensity: "extra",
      tableDensity: "huge",
      gridView: "cards",
    } as unknown as AppearanceSettings);
    expect(result.theme).toBe("dark");
    expect(result.accent).toBe("blue");
    expect(result.sidebarDensity).toBe("compact");
    expect(result.tableDensity).toBe("compact");
    expect(result.gridView).toBe("grid");
  });
});

describe("settings service — notifications", () => {
  it("persists notification preferences", async () => {
    const { service } = build();
    const result = await service.updateNotificationPreferences(ORG_ID, {
      emails: false,
      complianceAlerts: false,
      certificateExpiry: true,
      fuelAlerts: true,
      noonReport: false,
      assistantDigests: true,
      systemAnnouncements: false,
    });

    expect(result.emails).toBe(false);
    expect(result.complianceAlerts).toBe(false);

    const bundle = await service.getBundle(ORG_ID);
    expect(bundle.notificationPreferences.emails).toBe(false);
    expect(bundle.notificationPreferences.systemAnnouncements).toBe(false);
  });
});

describe("settings service — member management", () => {
  it("lets a senior actor promote a member", async () => {
    const { service } = build();
    const updated = await service.updateUser(ORG_ID, OWNER_ID, MEMBER_ID, {
      role: "fleet_manager",
    });
    expect(updated.role).toBe("fleet_manager");
    expect(updated.status).toBe("active");
  });

  it("forbids changing your own role", async () => {
    const { service } = build();
    await expect(
      async () => await service.updateUser(ORG_ID, OWNER_ID, OWNER_ID, { role: "viewer" }),
    ).toThrow(CannotDemoteSelfError);
  });

  it("forbids a junior actor from managing a senior member", async () => {
    const { service } = build();
    await expect(
      async () => await service.updateUser(ORG_ID, MEMBER_ID, OWNER_ID, { role: "viewer" }),
    ).toThrow(CannotDemoteSelfError);
  });

  it("blocks deactivating the last active owner", async () => {
    const { service } = build();
    await expect(
      async () =>
        await service.updateUser(ORG_ID, MEMBER_ID, OWNER_ID, { status: "inactive" }),
    ).toThrow(CannotDeactivateLastOwnerError);
  });

  it("allows deactivating an owner when another active owner exists", async () => {
    const { fake, service } = build();
    const { data: created } = await fake.from("organization_users").insert({
      organization_id: ORG_ID,
      email: "owner2@poseidonledger.com",
      full_name: "Owner Two",
      role: "owner",
      status: "active",
      password_hash: hashPassword("demo1234"),
    });
    const createdOwnerId = (created![0] as { id: string }).id;
    const updated = await service.updateUser(ORG_ID, OWNER_ID, createdOwnerId, {
      status: "inactive",
    });
    expect(updated.status).toBe("inactive");
  });

  it("throws UserNotFoundError for an unknown target", async () => {
    const { service } = build();
    await expect(
      async () => await service.updateUser(ORG_ID, OWNER_ID, "ghost", { role: "viewer" }),
    ).toThrow(UserNotFoundError);
  });
});

describe("settings service — invitations", () => {
  it("creates a pending invite and sends a mock email", async () => {
    const { service, email } = build();
    const invite = await service.inviteUser(ORG_ID, OWNER_ID, {
      email: "new@poseidonledger.com",
      fullName: "New Hire",
      role: "viewer",
    });

    expect(invite.email).toBe("new@poseidonledger.com");
    expect(invite.role).toBe("viewer");
    expect(invite.status).toBe("pending");
    expect(invite.invitedBy).toBe(OWNER_ID);
    expect(email.sent.length).toBe(1);
    expect(email.sent[0]!.notificationType).toBe("org_invite");
    expect(email.sent[0]!.html).toContainString("New Hire");
  });

  it("rejects inviting an existing member", async () => {
    const { service } = build();
    await expect(
      async () =>
        await service.inviteUser(ORG_ID, OWNER_ID, {
          email: "member@poseidonledger.com",
          fullName: null,
          role: "viewer",
        }),
    ).toThrow(InviteConflictError);
  });

  it("rejects a duplicate pending invite", async () => {
    const { service } = build();
    await service.inviteUser(ORG_ID, OWNER_ID, {
      email: "new@poseidonledger.com",
      fullName: null,
      role: "viewer",
    });
    await expect(
      async () =>
        await service.inviteUser(ORG_ID, OWNER_ID, {
          email: "NEW@POSEIDONLEDGER.COM",
          fullName: null,
          role: "viewer",
        }),
    ).toThrow(InviteConflictError);
  });

  it("rejects an unknown role", async () => {
    const { service } = build();
    await expect(
      async () =>
        await service.inviteUser(ORG_ID, OWNER_ID, {
          email: "new@poseidonledger.com",
          fullName: null,
          role: "captain",
        }),
    ).toThrow(InviteNotFoundError);
  });

  it("cancels a pending invite", async () => {
    const { service } = build();
    const invite = await service.inviteUser(ORG_ID, OWNER_ID, {
      email: "new@poseidonledger.com",
      fullName: null,
      role: "viewer",
    });
    const cancelled = await service.cancelInvite(ORG_ID, invite.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("resends a pending invite and bumps the counter", async () => {
    const { service, email } = build();
    const invite = await service.inviteUser(ORG_ID, OWNER_ID, {
      email: "new@poseidonledger.com",
      fullName: null,
      role: "viewer",
    });
    const resent = await service.resendInvite(ORG_ID, invite.id);
    expect(resent.resendCount).toBe(1);
    expect(resent.lastSentAt).toBeTruthy();
    expect(email.sent.length).toBe(2);
    expect(email.sent[1]!.notificationType).toBe("org_invite_resend");
  });
});

describe("settings service — integrations", () => {
  it("saves a configuration as CONFIGURED with encrypted values", async () => {
    const { service, fake } = build();
    const saved = await service.saveIntegration(ORG_ID, "marinetraffic", {
      apiKey: "mt-secret",
      endpoint: "https://api.marinetraffic.com",
    });

    expect(saved.provider).toBe("marinetraffic");
    expect(saved.status).toBe("CONFIGURED");
    expect(saved.displayValues.endpoint).toBe("https://api.marinetraffic.com");
    expect(saved.displayValues.apiKey).toBeFalsy();

    const { data: rows } = await fake.from("integration_credentials").select();
    const stored = rows![0] as { encrypted_config: Record<string, unknown> };
    expect(String(stored.encrypted_config.apiKey).startsWith("pl:mock:v1:")).toBe(true);
  });

  it("disconnects a configured integration back to NOT_CONFIGURED", async () => {
    const { service } = build();
    await service.saveIntegration(ORG_ID, "openai", { apiKey: "sk-xyz" });
    const disconnected = await service.disconnectIntegration(ORG_ID, "openai");
    expect(disconnected.status).toBe("NOT_CONFIGURED");
    expect(disconnected.displayValues).toEqual({});

    const bundle = await service.getBundle(ORG_ID);
    expect(bundle.integrations.find((i) => i.provider === "openai")!.status).toBe(
      "NOT_CONFIGURED",
    );
  });

  it("rejects unknown providers", async () => {
    const { service } = build();
    await expect(
      async () => await service.saveIntegration(ORG_ID, "not-a-provider", {}),
    ).toThrow(InvalidIntegrationError);
    await expect(
      async () => await service.disconnectIntegration(ORG_ID, "not-a-provider"),
    ).toThrow(InvalidIntegrationError);
  });
});

run();
