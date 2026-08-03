/**
 * routes.test.ts — auth API route tests (Phase 4.5)
 *
 * Exercises POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout,
 * POST /api/auth/forgot-password and POST /api/auth/reset-password against a
 * fake Supabase client + mock email provider.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import { createAuthTokenRepository } from "@/lib/supabase/repositories/auth_tokens";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createAuthService, hashPassword } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/app/api/_lib/cookies";
import { POST as loginRoute } from "../login/route";
import { GET as sessionRoute } from "../session/route";
import { POST as logoutRoute } from "../logout/route";
import { POST as forgotRoute } from "../forgot-password/route";
import { POST as resetRoute } from "../reset-password/route";
import type { AuthApiDeps } from "../_lib";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-001";
const EMAIL = "operator@poseidonledger.com";
const PASSWORD = "demo1234";

function build() {
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
      organization_users: [
        {
          id: "user-001",
          organization_id: ORG_ID,
          email: EMAIL,
          full_name: "Operator",
          avatar_url: null,
          role: "owner",
          status: "active",
          password_hash: hashPassword(PASSWORD),
          last_login_at: null,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      auth_tokens: [],
    },
  });
  const email = createMockNotificationEmailProvider();
  const service = createAuthService({
    userRepo: createOrganizationUserRepository({ client: fake }),
    organizationRepo: createOrganizationRepository({ client: fake }),
    tokenRepo: createAuthTokenRepository({ client: fake }),
    emailProvider: email,
  });
  const deps: AuthApiDeps = { service };
  return { deps, email, fake };
}

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cookieHeader(token: string): string {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function extractToken(response: Response): string {
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const prefix = `${AUTH_COOKIE_NAME}=`;
  const idx = setCookie.indexOf(prefix);
  if (idx < 0) throw new Error("no session cookie set");
  const rest = setCookie.slice(idx + prefix.length);
  return decodeURIComponent(rest.split(";")[0]!);
}

async function login(deps: AuthApiDeps): Promise<string> {
  const res = await loginRoute(
    jsonRequest("https://app.example.com/api/auth/login", { email: EMAIL, password: PASSWORD }),
    undefined,
    deps,
  );
  expect(res.status).toBe(200);
  return extractToken(res);
}

describe("POST /api/auth/login", () => {
  it("returns the session and sets a session cookie", async () => {
    const { deps } = build();
    const res = await loginRoute(
      jsonRequest("https://app.example.com/api/auth/login", { email: EMAIL, password: PASSWORD }),
      undefined,
      deps,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(EMAIL);
    expect(body.data.user.role).toBe("owner");
    expect(body.data.organization.name).toBe("Demo Organization");

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie.includes(`${AUTH_COOKIE_NAME}=`)).toBe(true);
    expect(setCookie.includes("HttpOnly")).toBe(true);
  });

  it("rejects bad credentials with 401", async () => {
    const { deps } = build();
    const res = await loginRoute(
      jsonRequest("https://app.example.com/api/auth/login", { email: EMAIL, password: "wrong" }),
      undefined,
      deps,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a missing body with 400", async () => {
    const { deps } = build();
    const res = await loginRoute(
      jsonRequest("https://app.example.com/api/auth/login", {}),
      undefined,
      deps,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/session", () => {
  it("resolves an authenticated session from the cookie", async () => {
    const { deps } = build();
    const token = await login(deps);

    const res = await sessionRoute(
      new Request("https://app.example.com/api/auth/session", {
        headers: { cookie: cookieHeader(token) },
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.email).toBe(EMAIL);
    expect(body.data.organization.id).toBe(ORG_ID);
  });

  it("returns anonymous shape without a cookie", async () => {
    const { deps } = build();
    const res = await sessionRoute(
      new Request("https://app.example.com/api/auth/session"),
      undefined,
      deps,
    );
    const body = await res.json();
    expect(body.data.user).toBeNull();
    expect(body.data.organization).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const { deps } = build();
    const token = await login(deps);

    const res = await logoutRoute(
      new Request("https://app.example.com/api/auth/logout", {
        method: "POST",
        headers: { cookie: cookieHeader(token) },
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    expect((res.headers.get("Set-Cookie") ?? "").includes("Max-Age=0")).toBe(true);

    const session = await sessionRoute(
      new Request("https://app.example.com/api/auth/session", {
        headers: { cookie: cookieHeader(token) },
      }),
      undefined,
      deps,
    );
    const body = await session.json();
    expect(body.data.user).toBeNull();
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("always returns sent:true and dispatches a mock email for a known user", async () => {
    const { deps, email } = build();
    const res = await forgotRoute(
      jsonRequest("https://app.example.com/api/auth/forgot-password", { email: EMAIL }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sent).toBe(true);
    expect(email.sent.length).toBe(1);
    expect(email.sent[0]!.notificationType).toBe("password_reset");
  });

  it("returns sent:true even for an unknown email (no account leak)", async () => {
    const { deps, email } = build();
    const res = await forgotRoute(
      jsonRequest("https://app.example.com/api/auth/forgot-password", { email: "ghost@example.com" }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    expect(email.sent.length).toBe(0);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password with a valid one-time token", async () => {
    const { deps, email, fake } = build();
    await forgotRoute(
      jsonRequest("https://app.example.com/api/auth/forgot-password", { email: EMAIL }),
      undefined,
      deps,
    );
    const resetLink = email.sent[0]!.html.match(/reset-password\?token=([^"<&]+)/)![1];

    const res = await resetRoute(
      jsonRequest("https://app.example.com/api/auth/reset-password", {
        token: resetLink,
        password: "newpassword123",
      }),
      undefined,
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reset).toBe(true);

    const relogin = await loginRoute(
      jsonRequest("https://app.example.com/api/auth/login", { email: EMAIL, password: "newpassword123" }),
      undefined,
      deps,
    );
    expect(relogin.status).toBe(200);
  });

  it("rejects a reused token with 400", async () => {
    const { deps, email } = build();
    await forgotRoute(
      jsonRequest("https://app.example.com/api/auth/forgot-password", { email: EMAIL }),
      undefined,
      deps,
    );
    const resetLink = email.sent[0]!.html.match(/reset-password\?token=([^"<&]+)/)![1];

    await resetRoute(
      jsonRequest("https://app.example.com/api/auth/reset-password", {
        token: resetLink,
        password: "newpassword123",
      }),
      undefined,
      deps,
    );
    const second = await resetRoute(
      jsonRequest("https://app.example.com/api/auth/reset-password", {
        token: resetLink,
        password: "anotherpass123",
      }),
      undefined,
      deps,
    );
    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects a missing token with 400", async () => {
    const { deps } = build();
    const res = await resetRoute(
      jsonRequest("https://app.example.com/api/auth/reset-password", { password: "newpassword123" }),
      undefined,
      deps,
    );
    expect(res.status).toBe(400);
  });
});

run();
