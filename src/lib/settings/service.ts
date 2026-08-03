/**
 * service.ts — settings service (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Orchestrates everything under Settings: organization profile, general
 * settings, appearance, notifications, member management, invitations (mock
 * email), integrations (stored, never used), and the About panel.
 *
 * The service is the ONLY owner of business rules:
 *   • An organization keeps at least one active Owner.
 *   • A member cannot change their own role/status.
 *   • Invites are mocked through the notification email provider.
 *   • Integration credentials are mock-encrypted, never dialed.
 */

import type {
  OrganizationRow,
  OrganizationUserRow,
} from "@/lib/supabase/types";
import type { OrganizationRepository } from "@/lib/supabase/repositories/organizations";
import type { OrganizationUserRepository } from "@/lib/supabase/repositories/organization_users";
import type { OrganizationSettingsRepository } from "@/lib/supabase/repositories/organization_settings";
import type { OrganizationInviteRepository } from "@/lib/supabase/repositories/organization_invites";
import type { IntegrationCredentialRepository } from "@/lib/supabase/repositories/integration_credentials";
import type { NotificationEmailProvider } from "@/lib/notifications/email-provider";
import { createMockNotificationEmailProvider } from "@/lib/notifications/email-provider";
import { INTEGRATIONS, getIntegration } from "@/lib/integrations/catalog";
import { decryptConfig, encryptConfig } from "@/lib/integrations/credentials";
import {
  APP_NAME,
  APP_VERSION,
  AUTH_MODE,
  BUILD_VERSION,
  CALCULATION_ENGINE_VERSION,
  INTEGRATIONS_MODE,
} from "./version";
import {
  CannotDeactivateLastOwnerError,
  CannotDemoteSelfError,
  InvalidIntegrationError,
  InviteConflictError,
  InviteNotFoundError,
  OrganizationNotFoundError,
  UserNotFoundError,
} from "./errors";
import type {
  AppearanceSettings,
  GeneralSettings,
  IntegrationState,
  NotificationPreferences,
  OrganizationProfile,
  SettingsBundle,
  SettingsInvite,
  SettingsUser,
} from "./types";
import { can, getRole, mayManageUser } from "@/lib/roles/catalog";
import { PERMISSIONS } from "@/lib/roles/catalog";
import { generateToken } from "@/lib/auth/tokens";

export interface InviteUserInput {
  readonly email: string;
  readonly fullName: string | null;
  readonly role: string;
}

export interface CreateSettingsServiceOptions {
  readonly organizationRepo: OrganizationRepository;
  readonly settingsRepo: OrganizationSettingsRepository;
  readonly userRepo: OrganizationUserRepository;
  readonly inviteRepo: OrganizationInviteRepository;
  readonly credentialRepo: IntegrationCredentialRepository;
  readonly emailProvider?: NotificationEmailProvider;
}

export interface SettingsServiceDeps {
  readonly organizationRepo: OrganizationRepository;
  readonly settingsRepo: OrganizationSettingsRepository;
  readonly userRepo: OrganizationUserRepository;
  readonly inviteRepo: OrganizationInviteRepository;
  readonly credentialRepo: IntegrationCredentialRepository;
  readonly emailProvider: NotificationEmailProvider;
  readonly now?: () => string;
}

function toOrganizationProfile(row: OrganizationRow): OrganizationProfile {
  return {
    id: row.id,
    name: row.name,
    companyLogoUrl: row.company_logo_url,
    country: row.country,
    imoCompanyNumber: row.imo_company_number,
    address: row.address,
    billingEmail: row.billing_email,
    supportEmail: row.support_email,
  };
}

function toSettingsUser(row: OrganizationUserRow): SettingsUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  accent: "blue",
  sidebarDensity: "compact",
  tableDensity: "compact",
  gridView: "grid",
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  emails: true,
  complianceAlerts: true,
  certificateExpiry: true,
  fuelAlerts: true,
  noonReport: true,
  assistantDigests: true,
  systemAnnouncements: true,
};

function normalizeAppearance(raw: Record<string, unknown>): AppearanceSettings {
  const value = {
    theme: raw.theme === "light" ? "light" : "dark",
    accent: raw.accent === "teal" || raw.accent === "slate" ? raw.accent : "blue",
    sidebarDensity:
      raw.sidebarDensity === "comfortable" ? "comfortable" : "compact",
    tableDensity:
      raw.tableDensity === "roomy"
        ? "roomy"
        : raw.tableDensity === "comfortable"
          ? "comfortable"
          : "compact",
    gridView: raw.gridView === "list" ? "list" : "grid",
  };
  return value as AppearanceSettings;
}

function normalizeNotifications(raw: Record<string, unknown>): NotificationPreferences {
  const fallback = DEFAULT_NOTIFICATIONS;
  return {
    emails: typeof raw.emails === "boolean" ? raw.emails : fallback.emails,
    complianceAlerts:
      typeof raw.complianceAlerts === "boolean"
        ? raw.complianceAlerts
        : fallback.complianceAlerts,
    certificateExpiry:
      typeof raw.certificateExpiry === "boolean"
        ? raw.certificateExpiry
        : fallback.certificateExpiry,
    fuelAlerts:
      typeof raw.fuelAlerts === "boolean" ? raw.fuelAlerts : fallback.fuelAlerts,
    noonReport:
      typeof raw.noonReport === "boolean" ? raw.noonReport : fallback.noonReport,
    assistantDigests:
      typeof raw.assistantDigests === "boolean"
        ? raw.assistantDigests
        : fallback.assistantDigests,
    systemAnnouncements:
      typeof raw.systemAnnouncements === "boolean"
        ? raw.systemAnnouncements
        : fallback.systemAnnouncements,
  };
}

export class SettingsService {
  private readonly deps: SettingsServiceDeps;

  constructor(deps: SettingsServiceDeps) {
    this.deps = deps;
  }

  private now(): string {
    return (this.deps.now ?? (() => new Date().toISOString()))();
  }

  // ── BUNDLE ────────────────────────────────────────────────────────────────

  async getBundle(organizationId: string): Promise<SettingsBundle> {
    const organization = await this.requireOrganization(organizationId);
    const [settings, users, invites, credentials] = await Promise.all([
      this.deps.settingsRepo.findByOrganizationId(organizationId),
      this.deps.userRepo.listByOrganizationId(organizationId),
      this.deps.inviteRepo.listByOrganizationId(organizationId),
      this.deps.credentialRepo.listByOrganizationId(organizationId),
    ]);

    const appearance = normalizeAppearance(
      settings?.appearance ?? (DEFAULT_APPEARANCE as unknown as Record<string, unknown>),
    );
    const notificationPreferences = normalizeNotifications(
      settings?.notification_preferences ??
        (DEFAULT_NOTIFICATIONS as unknown as Record<string, unknown>),
    );

    const integrationStates = INTEGRATIONS.map((entry) => {
      const credential = credentials.find((c) => c.provider === entry.provider) ?? null;
      return this.toIntegrationState(
        entry.provider,
        credential?.status ?? "NOT_CONFIGURED",
        credential?.encrypted_config ?? {},
        credential?.configured_at ?? null,
      );
    });

    return {
      organization: toOrganizationProfile(organization),
      general: {
        organizationName: organization.name,
        defaultTimezone: settings?.default_timezone ?? "UTC",
        defaultReportingYear:
          settings?.default_reporting_year ?? new Date().getUTCFullYear(),
        language: settings?.language ?? "en",
      },
      appearance,
      notificationPreferences,
      users: users.map(toSettingsUser),
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        fullName: invite.full_name,
        role: invite.role,
        status: invite.status,
        invitedBy: invite.invited_by,
        expiresAt: invite.expires_at,
        resendCount: invite.resend_count,
        lastSentAt: invite.last_sent_at,
        createdAt: invite.created_at,
      })),
      integrations: integrationStates,
      about: {
        appName: APP_NAME,
        appVersion: APP_VERSION,
        buildVersion: BUILD_VERSION,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
        authMode: AUTH_MODE,
        integrationsMode: INTEGRATIONS_MODE,
      },
    };
  }

  // ── ORGANIZATION PROFILE ──────────────────────────────────────────────────

  async updateOrganization(
    organizationId: string,
    patch: Partial<Omit<OrganizationProfile, "id">>,
  ): Promise<OrganizationProfile> {
    await this.requireOrganization(organizationId);
    const updated = await this.deps.organizationRepo.update(organizationId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.companyLogoUrl !== undefined
        ? { company_logo_url: patch.companyLogoUrl }
        : {}),
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.imoCompanyNumber !== undefined
        ? { imo_company_number: patch.imoCompanyNumber }
        : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.billingEmail !== undefined
        ? { billing_email: patch.billingEmail }
        : {}),
      ...(patch.supportEmail !== undefined
        ? { support_email: patch.supportEmail }
        : {}),
    });
    return toOrganizationProfile(updated);
  }

  // ── GENERAL / APPEARANCE / NOTIFICATIONS ──────────────────────────────────

  async updateGeneral(
    organizationId: string,
    patch: Partial<GeneralSettings>,
  ): Promise<GeneralSettings> {
    await this.requireOrganization(organizationId);
    const existing = await this.deps.settingsRepo.findByOrganizationId(organizationId);
    const updated = await this.deps.settingsRepo.upsertByOrganizationId(organizationId, {
      organization_id: organizationId,
      ...(patch.defaultTimezone !== undefined
        ? { default_timezone: patch.defaultTimezone }
        : {}),
      ...(patch.defaultReportingYear !== undefined
        ? { default_reporting_year: patch.defaultReportingYear }
        : {}),
      ...(patch.language !== undefined ? { language: patch.language } : {}),
    });

    if (patch.organizationName !== undefined) {
      await this.deps.organizationRepo.update(organizationId, {
        name: patch.organizationName,
      });
    }

    return {
      organizationName:
        patch.organizationName ??
        (await this.requireOrganization(organizationId)).name,
      defaultTimezone: updated.default_timezone,
      defaultReportingYear: updated.default_reporting_year,
      language: updated.language,
    };
  }

  async updateAppearance(
    organizationId: string,
    appearance: AppearanceSettings,
  ): Promise<AppearanceSettings> {
    await this.requireOrganization(organizationId);
    const normalized = normalizeAppearance(appearance as unknown as Record<string, unknown>);
    await this.deps.settingsRepo.upsertByOrganizationId(organizationId, {
      organization_id: organizationId,
      appearance: normalized as unknown as Record<string, unknown>,
    });
    return normalized;
  }

  async updateNotificationPreferences(
    organizationId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    await this.requireOrganization(organizationId);
    const normalized = normalizeNotifications(
      preferences as unknown as Record<string, unknown>,
    );
    await this.deps.settingsRepo.upsertByOrganizationId(organizationId, {
      organization_id: organizationId,
      notification_preferences: normalized as unknown as Record<string, unknown>,
    });
    return normalized;
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────

  /**
   * Change a member's role/status.
   * @param actor the acting member (must outrank the target; never self).
   */
  async updateUser(
    organizationId: string,
    actorId: string,
    userId: string,
    patch: { readonly role?: string; readonly status?: "active" | "inactive" },
  ): Promise<SettingsUser> {
    const actor = await this.deps.userRepo.findById(actorId);
    if (!actor || actor.organization_id !== organizationId) {
      throw new UserNotFoundError("Acting user not found in organization");
    }
    if (actorId === userId) {
      throw new CannotDemoteSelfError();
    }
    const target = await this.deps.userRepo.findById(userId);
    if (!target || target.organization_id !== organizationId) {
      throw new UserNotFoundError();
    }

    if (patch.role !== undefined && !mayManageUser(actor.role, target.role)) {
      throw new CannotDemoteSelfError(
        "Your role is not senior enough to change this member's role",
      );
    }

    const isOwner = target.role === "owner" || patch.role === "owner";
    if (isOwner && patch.status === "inactive") {
      const owners = (await this.deps.userRepo.listByOrganizationId(organizationId)).filter(
        (u) => u.role === "owner" && u.status === "active",
      );
      if (owners.length <= 1) {
        throw new CannotDeactivateLastOwnerError();
      }
    }

    const updated = await this.deps.userRepo.update(userId, {
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    });
    return toSettingsUser(updated);
  }

  // ── INVITES ───────────────────────────────────────────────────────────────

  async inviteUser(
    organizationId: string,
    invitedBy: string,
    input: InviteUserInput,
  ): Promise<SettingsInvite> {
    await this.requireOrganization(organizationId);
    const email = input.email.trim().toLowerCase();
    const role = getRole(input.role);
    if (!role) throw new InviteNotFoundError(`Unknown role: ${input.role}`);

    const existingUser = await this.deps.userRepo.findByOrgAndEmail(organizationId, email);
    if (existingUser) {
      throw new InviteConflictError("This email already belongs to an active member");
    }
    const pending = await this.deps.inviteRepo.listPendingByOrganizationId(organizationId);
    if (pending.some((invite) => invite.email.toLowerCase() === email)) {
      throw new InviteConflictError();
    }

    const now = this.now();
    const invite = await this.deps.inviteRepo.insert({
      organization_id: organizationId,
      email,
      full_name: input.fullName?.trim() || null,
      role: role.code,
      token: generateToken(),
      invited_by: invitedBy,
      expires_at: new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await this.deps.emailProvider.send({
      to: email,
      subject: `You've been invited to ${await this.orgName(organizationId)}`,
      html:
        `<p>Hello${input.fullName ? ` ${input.fullName}` : ""},</p>` +
        `<p>You've been invited to join <strong>${await this.orgName(organizationId)}</strong> on Poseidon Ledger as ${role.label}.</p>` +
        `<p>Sign in with the email address ${email} to accept.</p>`,
      text: `You've been invited to join ${await this.orgName(organizationId)} on Poseidon Ledger as ${role.label}.`,
      notificationType: "org_invite",
    });

    return {
      id: invite.id,
      email: invite.email,
      fullName: invite.full_name,
      role: invite.role,
      status: invite.status,
      invitedBy: invite.invited_by,
      expiresAt: invite.expires_at,
      resendCount: invite.resend_count,
      lastSentAt: invite.last_sent_at,
      createdAt: invite.created_at,
    };
  }

  async cancelInvite(organizationId: string, inviteId: string): Promise<SettingsInvite> {
    const invite = await this.requireInvite(organizationId, inviteId);
    if (invite.status === "accepted") {
      throw new InviteConflictError("This invitation has already been accepted");
    }
    const updated = await this.deps.inviteRepo.update(invite.id, { status: "cancelled" });
    return this.toInvite(updated);
  }

  async resendInvite(organizationId: string, inviteId: string): Promise<SettingsInvite> {
    const invite = await this.requireInvite(organizationId, inviteId);
    if (invite.status !== "pending") {
      throw new InviteConflictError("Only pending invitations can be resent");
    }
    const now = this.now();
    const updated = await this.deps.inviteRepo.update(invite.id, {
      resend_count: invite.resend_count + 1,
      last_sent_at: now,
    });

    await this.deps.emailProvider.send({
      to: updated.email,
      subject: `Reminder: you've been invited to ${await this.orgName(organizationId)}`,
      html: `<p>This is a reminder that you've been invited to join <strong>${await this.orgName(organizationId)}</strong> on Poseidon Ledger.</p>`,
      text: `Reminder: you've been invited to join ${await this.orgName(organizationId)} on Poseidon Ledger.`,
      notificationType: "org_invite_resend",
    });

    return this.toInvite(updated);
  }

  // ── INTEGRATIONS ──────────────────────────────────────────────────────────

  async saveIntegration(
    organizationId: string,
    provider: string,
    config: Record<string, unknown>,
  ): Promise<IntegrationState> {
    if (!getIntegration(provider)) throw new InvalidIntegrationError();
    const entry = getIntegration(provider)!;
    const now = this.now();
    const credential = await this.deps.credentialRepo.upsertByOrganizationAndProvider(
      organizationId,
      provider,
      {
        organization_id: organizationId,
        provider,
        status: "CONFIGURED",
        encrypted_config: encryptConfig(config),
        configured_at: now,
      },
    );
    return this.toIntegrationState(
      entry.provider,
      credential.status,
      credential.encrypted_config,
      credential.configured_at,
    );
  }

  async disconnectIntegration(
    organizationId: string,
    provider: string,
  ): Promise<IntegrationState> {
    if (!getIntegration(provider)) throw new InvalidIntegrationError();
    const entry = getIntegration(provider)!;
    const now = this.now();
    const credential = await this.deps.credentialRepo.upsertByOrganizationAndProvider(
      organizationId,
      provider,
      {
        organization_id: organizationId,
        provider,
        status: "NOT_CONFIGURED",
        encrypted_config: {},
        configured_at: null,
      },
    );
    return this.toIntegrationState(
      entry.provider,
      credential.status,
      credential.encrypted_config,
      credential.configured_at,
    );
  }

  /** Permission gate helper for the API layer. */
  canManageOrganization(actorRole: string): boolean {
    return can(actorRole, PERMISSIONS.org_manage);
  }

  // ── PRIVATE ───────────────────────────────────────────────────────────────

  private async requireOrganization(organizationId: string): Promise<OrganizationRow> {
    const org = await this.deps.organizationRepo.findById(organizationId);
    if (!org) throw new OrganizationNotFoundError();
    return org;
  }

  private async orgName(organizationId: string): Promise<string> {
    return (await this.requireOrganization(organizationId)).name;
  }

  private async requireInvite(organizationId: string, inviteId: string) {
    const invite = await this.deps.inviteRepo.findById(inviteId);
    if (!invite || invite.organization_id !== organizationId) {
      throw new InviteNotFoundError();
    }
    return invite;
  }

  private toInvite(row: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    status: "pending" | "accepted" | "cancelled";
    invited_by: string;
    expires_at: string;
    resend_count: number;
    last_sent_at: string | null;
    created_at: string;
  }): SettingsInvite {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      resendCount: row.resend_count,
      lastSentAt: row.last_sent_at,
      createdAt: row.created_at,
    };
  }

  private toIntegrationState(
    provider: string,
    status: "NOT_CONFIGURED" | "CONFIGURED",
    encryptedConfig: Record<string, unknown>,
    configuredAt: string | null,
  ): IntegrationState {
    const entry = getIntegration(provider)!;
    const decrypted = decryptConfig(encryptedConfig ?? {});
    const displayValues: Record<string, string> = {};
    for (const field of entry.fields) {
      if (!field.secret && decrypted[field.key] !== undefined) {
        displayValues[field.key] = String(decrypted[field.key]);
      }
    }
    return {
      provider: entry.provider,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      status,
      displayValues,
      configuredAt,
    };
  }
}

export function createSettingsService(
  opts: CreateSettingsServiceOptions,
): SettingsService {
  return new SettingsService({
    organizationRepo: opts.organizationRepo,
    settingsRepo: opts.settingsRepo,
    userRepo: opts.userRepo,
    inviteRepo: opts.inviteRepo,
    credentialRepo: opts.credentialRepo,
    emailProvider: opts.emailProvider ?? createMockNotificationEmailProvider(),
  });
}
