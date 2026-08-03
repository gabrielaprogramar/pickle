import { apiFetch } from "./api-client";
import type {
  AppearanceSettings,
  GeneralSettings,
  IntegrationState,
  NotificationPreferences,
  OrganizationProfile,
  SettingsBundle,
  SettingsInvite,
  SettingsUser,
} from "@/lib/settings";

export interface UpdateOrganizationResult {
  readonly section: "organization";
  readonly organization: OrganizationProfile;
}

export interface UpdateGeneralResult {
  readonly section: "general";
  readonly general: GeneralSettings;
}

export interface UpdateAppearanceResult {
  readonly section: "appearance";
  readonly appearance: AppearanceSettings;
}

export interface UpdateNotificationsResult {
  readonly section: "notifications";
  readonly notifications: NotificationPreferences;
}

export interface UpdateIntegrationsResult {
  readonly section: "integrations";
  readonly integration: IntegrationState;
}

export type UpdateSettingsResult =
  | UpdateOrganizationResult
  | UpdateGeneralResult
  | UpdateAppearanceResult
  | UpdateNotificationsResult
  | UpdateIntegrationsResult;

export function updateOrganization(
  organization: Partial<Omit<OrganizationProfile, "id">>,
): Promise<UpdateOrganizationResult> {
  return apiFetch<UpdateOrganizationResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({ section: "organization", organization }),
  });
}

export function updateGeneral(
  general: Partial<GeneralSettings>,
): Promise<UpdateGeneralResult> {
  return apiFetch<UpdateGeneralResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({ section: "general", general }),
  });
}

export function updateAppearance(
  appearance: AppearanceSettings,
): Promise<UpdateAppearanceResult> {
  return apiFetch<UpdateAppearanceResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({ section: "appearance", appearance }),
  });
}

export function updateNotificationPreferences(
  notifications: NotificationPreferences,
): Promise<UpdateNotificationsResult> {
  return apiFetch<UpdateNotificationsResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({ section: "notifications", notifications }),
  });
}

export function configureIntegration(
  provider: string,
  config: Record<string, unknown>,
): Promise<UpdateIntegrationsResult> {
  return apiFetch<UpdateIntegrationsResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({
      section: "integrations",
      integrations: { provider, action: "configure", config },
    }),
  });
}

export function disconnectIntegration(
  provider: string,
): Promise<UpdateIntegrationsResult> {
  return apiFetch<UpdateIntegrationsResult>("settings", {
    method: "PATCH",
    body: JSON.stringify({
      section: "integrations",
      integrations: { provider, action: "disconnect" },
    }),
  });
}

export interface CreateInviteInput {
  readonly email: string;
  readonly fullName?: string | null;
  readonly role: string;
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<SettingsInvite> {
  const result = await apiFetch<{ invite: SettingsInvite }>("settings/invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.invite;
}

export async function cancelInvite(id: string): Promise<SettingsInvite> {
  const result = await apiFetch<{ invite: SettingsInvite }>(`settings/invites/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "cancel" }),
  });
  return result.invite;
}

export async function resendInvite(id: string): Promise<SettingsInvite> {
  const result = await apiFetch<{ invite: SettingsInvite }>(`settings/invites/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "resend" }),
  });
  return result.invite;
}

export async function updateUser(
  id: string,
  patch: { readonly role?: string; readonly status?: "active" | "inactive" },
): Promise<SettingsUser> {
  const result = await apiFetch<{ user: SettingsUser }>(`settings/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return result.user;
}

export type { SettingsBundle };
