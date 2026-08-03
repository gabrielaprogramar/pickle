/**
 * service.test.ts — mock auth service tests (Phase 4.5)
 *
 * Exercises login/logout/getSession/forgotPassword/resetPassword against the
 * fake Supabase client and a capturing mock email provider.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import { createAuthTokenRepository } from "@/lib/supabase/repositories/auth_tokens";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createAuthService, hashPassword } from "../index";
import { InvalidCredentialsError, InvalidResetTokenError, InvalidSessionError, UserNotActiveError } from "../errors";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-001";
const USER_ID = "user-001";

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
    organization_users: [
      {
        id: USER_ID,
        organization_id: ORG_ID,
        email: "operator@poseidonledger.com",
        full_name: "Operator",
        avatar_url: null,
        role: "owner",
        status: "active",
        password_hash: hashPassword("demo1234"),
        last_login_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    auth_tokens: [],
  };
}

function build() {
  const fake = createFakeSupabaseClient({ tables: makeSeed() });
  const email = createMockNotificationEmailProvider();
  const service = createAuthService({
    userRepo: createOrganizationUserRepository({ client: fake }),
    organizationRepo: createOrganizationRepository({ client: fake }),
    tokenRepo: createAuthTokenRepository({ client: fake }),
    emailProvider: email,
  });
  return { fake, email, service };
}

describe("auth service — login", () => {
  it("returns a session and updates last_login_at", async () => {
    const { service, fake } = build();
    const session = await service.login("operator@poseidonledger.com", "demo1234", { now: NOW });

    expect(session.token.length > 0).toBe(true);
    expect(session.user.email).toBe("operator@poseidonledger.com");
    expect(session.user.role).toBe("owner");
    expect(session.organization.id).toBe(ORG_ID);
    expect(session.organization.name).toBe("Demo Organization");

    const { data: users } = await fake.from("organization_users").select().eq("id", USER_ID);
    expect((users![0] as { last_login_at: string | null }).last_login_at).toBe(NOW);
  });

  it("lowercases and trims the email", async () => {
    const { service } = build();
    const session = await service.login("  OPERATOR@POSEIDONLEDGER.COM ", "demo1234");
    expect(session.user.email).toBe("operator@poseidonledger.com");
  });

  it("throws InvalidCredentialsError for a wrong password", async () => {
    const { service } = build();
    await expect(
      async () => await service.login("operator@poseidonledger.com", "wrong", { now: NOW }),
    ).toThrow(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError for an unknown email", async () => {
    const { service } = build();
    await expect(
      async () => await service.login("nobody@poseidonledger.com", "demo1234", { now: NOW }),
    ).toThrow(InvalidCredentialsError);
  });

  it("throws UserNotActiveError for a deactivated account", async () => {
    const { service, fake } = build();
    await fake.from("organization_users").update({ status: "inactive" }).eq("id", USER_ID);
    await expect(
      async () => await service.login("operator@poseidonledger.com", "demo1234", { now: NOW }),
    ).toThrow(UserNotActiveError);
  });
});

describe("auth service — session", () => {
  it("resolves a valid session token to user + org", async () => {
    const { service } = build();
    const session = await service.login("operator@poseidonledger.com", "demo1234", { now: NOW });

    const resolved = await service.getSession(session.token, { now: NOW });
    expect(resolved).toBeTruthy();
    expect(resolved!.user.id).toBe(USER_ID);
    expect(resolved!.organization.id).toBe(ORG_ID);
  });

  it("returns null for an unknown token", async () => {
    const { service } = build();
    expect(await service.getSession("not-a-token", { now: NOW })).toBeNull();
  });

  it("returns null for a revoked token", async () => {
    const { service } = build();
    const session = await service.login("operator@poseidonledger.com", "demo1234", { now: NOW });
    await service.logout(session.token);
    expect(await service.getSession(session.token, { now: NOW })).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const { service } = build();
    const session = await service.login("operator@poseidonledger.com", "demo1234", { now: NOW });
    const later = new Date(new Date(NOW).getTime() + 13 * 60 * 60 * 1000).toISOString();
    expect(await service.getSession(session.token, { now: later })).toBeNull();
  });

  it("requireSession throws InvalidSessionError when absent", async () => {
    const { service } = build();
    await expect(
      async () => await service.requireSession("bad-token", { now: NOW }),
    ).toThrow(InvalidSessionError);
  });
});

describe("auth service — forgot/reset password", () => {
  it("issues a reset token and sends a mock email", async () => {
    const { service, email } = build();
    const sent = await service.forgotPassword("operator@poseidonledger.com", {
      now: NOW,
      baseUrl: "https://app.example.com",
    });

    expect(sent).toBe(true);
    expect(email.sent.length).toBe(1);
    expect(email.sent[0]!.to).toBe("operator@poseidonledger.com");
    expect(email.sent[0]!.notificationType).toBe("password_reset");
    expect(email.sent[0]!.html).toContainString("/reset-password?token=");
    expect(email.sent[0]!.html).toContainString("https://app.example.com");
  });

  it("returns false (no leak) for an unknown email", async () => {
    const { service, email } = build();
    const sent = await service.forgotPassword("missing@example.com", { now: NOW });
    expect(sent).toBe(false);
    expect(email.sent.length).toBe(0);
  });

  it("resets the password with a valid token", async () => {
    const { service, email } = build();
    await service.forgotPassword("operator@poseidonledger.com", {
      now: NOW,
      baseUrl: "https://app.example.com",
    });

    const raw = email.sent[0]!.html.match(/reset-password\?token=([^"<&]+)/)![1]!;

    await service.resetPassword(raw, "newpassword123", { now: NOW });

    const ok = await service.login("operator@poseidonledger.com", "newpassword123", { now: NOW });
    expect(ok.user.id).toBe(USER_ID);
  });

  it("rejects a reused reset token after success", async () => {
    const { service, email } = build();
    await service.forgotPassword("operator@poseidonledger.com", {
      now: NOW,
      baseUrl: "https://app.example.com",
    });
    const raw = email.sent[0]!.html.match(/reset-password\?token=([^"<&]+)/)![1]!;

    await service.resetPassword(raw, "newpassword123", { now: NOW });
    await expect(
      async () => await service.resetPassword(raw, "anotherpass123", { now: NOW }),
    ).toThrow(InvalidResetTokenError);
  });

  it("rejects short passwords", async () => {
    const { service } = build();
    await expect(
      async () => await service.resetPassword("any-token", "short", { now: NOW }),
    ).toThrow(InvalidResetTokenError);
  });

  it("rejects an invalid token", async () => {
    const { service } = build();
    await expect(
      async () => await service.resetPassword("bad-token", "newpassword123", { now: NOW }),
    ).toThrow(InvalidResetTokenError);
  });
});

run();
