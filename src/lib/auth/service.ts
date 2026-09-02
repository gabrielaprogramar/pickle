/**
 * service.ts — mock auth service (login/logout/session/forgot/reset)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Implements the full auth flow against the `auth_tokens` + `organization_users`
 * tables using a mock email provider for password reset. Everything is
 * self-contained; real Supabase Auth replaces this seam in a later phase.
 */

import type { OrganizationRow, OrganizationUserRow } from "@/lib/supabase/types";
import type { OrganizationRepository } from "@/lib/supabase/repositories/organizations";
import type { OrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import type { AuthTokenRepository } from "@/lib/supabase/repositories/auth_tokens";
import { hashPassword, verifyPassword, isLegacyMockHash } from "./passwords";
import { generateToken, hashToken, resetExpiry, sessionExpiry } from "./tokens";
import {
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidSessionError,
  UserNotActiveError,
} from "./errors";
import type { NotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string | null;
  readonly role: string;
  readonly status: "active" | "inactive";
  readonly lastLoginAt: string | null;
}

export interface AuthOrganization {
  readonly id: string;
  readonly name: string;
  readonly companyLogoUrl: string | null;
}

export interface AuthSession {
  readonly token: string;
  readonly user: AuthUser;
  readonly organization: AuthOrganization;
}

export interface AuthSessionInfo {
  readonly user: AuthUser;
  readonly organization: AuthOrganization;
}

export interface LoginOptions {
  readonly now?: string;
}

export interface ForgotPasswordOptions {
  readonly now?: string;
  /** Base URL for the reset link (e.g. request origin). */
  readonly baseUrl?: string;
}

export interface ResetPasswordOptions {
  readonly now?: string;
}

export interface AuthServiceDeps {
  readonly userRepo: OrganizationUserRepository;
  readonly organizationRepo: OrganizationRepository;
  readonly tokenRepo: AuthTokenRepository;
  readonly emailProvider: NotificationEmailProvider;
}

export interface CreateAuthServiceOptions {
  readonly userRepo: OrganizationUserRepository;
  readonly organizationRepo: OrganizationRepository;
  readonly tokenRepo: AuthTokenRepository;
  readonly emailProvider?: NotificationEmailProvider;
}

function toAuthUser(row: OrganizationUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
  };
}

function toAuthOrganization(row: OrganizationRow): AuthOrganization {
  return {
    id: row.id,
    name: row.name,
    companyLogoUrl: row.company_logo_url,
  };
}

export function createAuthService(
  deps: CreateAuthServiceOptions,
): AuthService {
  return new AuthService({
    userRepo: deps.userRepo,
    organizationRepo: deps.organizationRepo,
    tokenRepo: deps.tokenRepo,
    emailProvider: deps.emailProvider ?? createMockNotificationEmailProvider(),
  });
}

export class AuthService {
  private readonly deps: AuthServiceDeps;

  constructor(deps: AuthServiceDeps) {
    this.deps = deps;
  }

  /**
   * Authenticate a user and mint a session token.
   * @returns the raw token (caller stores it) plus the session info.
   * @throws InvalidCredentialsError when email/password mismatch.
   * @throws UserNotActiveError when the account is deactivated.
   */
  async login(email: string, password: string, opts: LoginOptions = {}): Promise<AuthSession> {
    const now = opts.now ?? new Date().toISOString();
    const user = await this.deps.userRepo.findByEmail(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new InvalidCredentialsError();
    }
    // Transparently upgrade legacy mock$v1$ hashes to bcrypt on login.
    if (isLegacyMockHash(user.password_hash)) {
      await this.deps.userRepo.update(user.id, {
        password_hash: hashPassword(password),
      });
    }
    if (user.status !== "active") {
      throw new UserNotActiveError();
    }

    const organization = await this.deps.organizationRepo.findById(user.organization_id);
    if (!organization) {
      throw new InvalidCredentialsError("Organization not found for this account");
    }

    const rawToken = generateToken();
    await this.deps.tokenRepo.insert({
      token: hashToken(rawToken),
      kind: "session",
      organization_id: organization.id,
      user_id: user.id,
      email: user.email,
      expires_at: sessionExpiry(now),
    });

    await this.deps.userRepo.update(user.id, { last_login_at: now });

    return {
      token: rawToken,
      user: toAuthUser(user),
      organization: toAuthOrganization(organization),
    };
  }

  /** Revoke a session token (logout). No-op when the token is unknown. */
  async logout(token: string): Promise<void> {
    await this.deps.tokenRepo.revoke(hashToken(token));
  }

  /**
   * Resolve a session token to user + organization, or null when missing,
   * expired, or revoked.
   */
  async getSession(token: string, opts: LoginOptions = {}): Promise<AuthSessionInfo | null> {
    const now = opts.now ?? new Date().toISOString();
    const stored = await this.deps.tokenRepo.findValidByToken(hashToken(token), { now });
    if (!stored || stored.kind !== "session" || !stored.user_id || !stored.organization_id) {
      return null;
    }

    const [user, organization] = await Promise.all([
      this.deps.userRepo.findById(stored.user_id),
      this.deps.organizationRepo.findById(stored.organization_id),
    ]);
    if (!user || !organization || user.status !== "active") {
      return null;
    }

    return { user: toAuthUser(user), organization: toAuthOrganization(organization) };
  }

  /**
   * Start a password reset for an email. Always resolves successfully (to avoid
   * leaking which accounts exist) and dispatches a mock reset email.
   * @returns true when a user exists and a reset was actually issued.
   */
  async forgotPassword(email: string, opts: ForgotPasswordOptions = {}): Promise<boolean> {
    const now = opts.now ?? new Date().toISOString();
    const user = await this.deps.userRepo.findByEmail(email.trim().toLowerCase());
    if (!user) return false;

    const rawToken = generateToken();
    await this.deps.tokenRepo.insert({
      token: hashToken(rawToken),
      kind: "password_reset",
      organization_id: user.organization_id,
      user_id: user.id,
      email: user.email,
      expires_at: resetExpiry(now),
    });

    const baseUrl = opts.baseUrl ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;
    await this.deps.emailProvider.send({
      to: user.email,
      subject: "Reset your Poseidon Ledger password",
      html:
        `<p>Hello ${user.full_name},</p>` +
        `<p>Click the link below to set a new password. The link expires in 1 hour.</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
      text: `Reset your Poseidon Ledger password: ${resetUrl}`,
      notificationType: "password_reset",
    });

    return true;
  }

  /**
   * Complete a password reset with a one-time token. Revokes the token on
   * success. Throws InvalidResetTokenError when the token is invalid/expired.
   */
  async resetPassword(token: string, password: string, opts: ResetPasswordOptions = {}): Promise<void> {
    const now = opts.now ?? new Date().toISOString();
    if (!password || password.length < 8) {
      throw new InvalidResetTokenError("Password must be at least 8 characters");
    }
    const stored = await this.deps.tokenRepo.findValidByToken(hashToken(token), { now });
    if (!stored || stored.kind !== "password_reset" || !stored.user_id) {
      throw new InvalidResetTokenError();
    }

    const user = await this.deps.userRepo.findById(stored.user_id);
    if (!user) {
      throw new InvalidResetTokenError();
    }

    await this.deps.userRepo.update(user.id, { password_hash: hashPassword(password) });
    await this.deps.tokenRepo.revoke(hashToken(token));
  }

  /** Hash a password (used when creating seed/demo users). */
  hashPasswordValue(password: string): string {
    return hashPassword(password);
  }

  /**
   * Require an active session, throwing InvalidSessionError when absent.
   * Convenience for route guards that must return 401.
   */
  async requireSession(token: string, opts: LoginOptions = {}): Promise<AuthSessionInfo> {
    const session = await this.getSession(token, opts);
    if (!session) throw new InvalidSessionError();
    return session;
  }
}
