/**
 * auth/_lib.ts — shared wiring for the auth API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Builds an `AuthService` from the real Supabase repositories. Route handlers
 * accept `AuthApiDeps` so tests can inject fakes; `route.ts` uses
 * `buildDefaultAuthApiDeps()`.
 */

import { createAuthService } from "@/lib/auth";
import type { AuthService } from "@/lib/auth";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { getSupabaseClient } from "@/lib/supabase";
import { createAuthTokenRepository } from "@/lib/supabase/repositories/auth_tokens";
import { createOrganizationRepository } from "@/lib/supabase/repositories/organizations";
import { createOrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";

export interface AuthApiDeps {
  readonly service: AuthService;
}

export function buildDefaultAuthApiDeps(): AuthApiDeps {
  const client = getSupabaseClient();
  const userRepo = createOrganizationUserRepository({ client });
  const service = createAuthService({
    userRepo,
    organizationRepo: createOrganizationRepository({ client }),
    tokenRepo: createAuthTokenRepository({ client }),
    emailProvider: createMockNotificationEmailProvider(),
  });
  return { service };
}
