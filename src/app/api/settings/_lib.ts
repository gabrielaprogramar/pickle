/**
 * settings/_lib.ts — shared wiring for the settings API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Builds a `SettingsService` from the real Supabase repositories and exposes a
 * session guard that returns 401/403. Route handlers accept `SettingsApiDeps`
 * so tests can inject fakes.
 */

import { apiError } from "@/app/api/_lib/http";
import { AUTH_COOKIE_NAME, readCookie } from "@/app/api/_lib/cookies";
import type { AuthSessionInfo } from "@/lib/auth";
import { createAuthService } from "@/lib/auth";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createSettingsService } from "@/lib/settings";
import type { SettingsService } from "@/lib/settings";
import { can } from "@/lib/roles/catalog";
import { PERMISSIONS } from "@/lib/roles/catalog";
import { getSupabaseClient } from "@/lib/supabase";
import { createAuthTokenRepository } from "@/lib/supabase/repositories/auth_tokens";
import { createIntegrationCredentialRepository } from "@/lib/supabase/repositories/integration_credentials";
import { createOrganizationInviteRepository } from "@/lib/supabase/repositories/organization_invites";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationSettingsRepository } from "@/lib/supabase/repositories/organization_settings";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";

export interface SettingsApiDeps {
  readonly settings: SettingsService;
  /** Resolve the current session from the request, or null. */
  readonly session: (req: Request) => Promise<AuthSessionInfo | null>;
}

export function buildDefaultSettingsApiDeps(): SettingsApiDeps {
  const client = getSupabaseClient();
  const userRepo = createOrganizationUserRepository({ client });
  const orgRepo = createOrganizationRepository({ client });

  const authService = createAuthService({
    userRepo,
    organizationRepo: orgRepo,
    tokenRepo: createAuthTokenRepository({ client }),
    emailProvider: createMockNotificationEmailProvider(),
  });

  const settings = createSettingsService({
    organizationRepo: orgRepo,
    settingsRepo: createOrganizationSettingsRepository({ client }),
    userRepo,
    inviteRepo: createOrganizationInviteRepository({ client }),
    credentialRepo: createIntegrationCredentialRepository({ client }),
    emailProvider: createMockNotificationEmailProvider(),
  });

  return {
    settings,
    async session(req: Request): Promise<AuthSessionInfo | null> {
      const token = readCookie(req.headers.get("cookie"), AUTH_COOKIE_NAME);
      if (!token) return null;
      return authService.getSession(token);
    },
  };
}

/**
 * Guard that requires an authenticated, active member of the org. Returns the
 * session on success or a 401/403 Response on failure.
 */
export async function requireAuth(
  deps: SettingsApiDeps,
  req: Request,
): Promise<AuthSessionInfo | Response> {
  const session = await deps.session(req);
  if (!session) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }
  return session;
}

/** Permission-check helper returning a 403 Response when denied. */
export function requirePermission(
  session: AuthSessionInfo,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
): Response | null {
  if (!can(session.user.role, permission)) {
    return apiError("FORBIDDEN", `Missing permission: ${permission}`, 403);
  }
  return null;
}
