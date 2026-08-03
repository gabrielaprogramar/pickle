/**
 * types.ts — settings service domain types (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Clean shapes for the Settings surface. The service maps raw DB rows to these
 * so the frontend never touches snake_case columns or JSONB internals.
 */

import type { IntegrationProvider } from "@/lib/integrations/catalog";

export interface OrganizationProfile {
  readonly id: string;
  readonly name: string;
  readonly companyLogoUrl: string | null;
  readonly country: string | null;
  readonly imoCompanyNumber: string | null;
  readonly address: string | null;
  readonly billingEmail: string | null;
  readonly supportEmail: string | null;
}

export interface GeneralSettings {
  readonly organizationName: string;
  readonly defaultTimezone: string;
  readonly defaultReportingYear: number;
  readonly language: string;
}

export interface AppearanceSettings {
  readonly theme: "dark" | "light";
  readonly accent: "blue" | "teal" | "slate";
  readonly sidebarDensity: "compact" | "comfortable";
  readonly tableDensity: "compact" | "comfortable" | "roomy";
  readonly gridView: "grid" | "list";
}

export interface NotificationPreferences {
  readonly emails: boolean;
  readonly complianceAlerts: boolean;
  readonly certificateExpiry: boolean;
  readonly fuelAlerts: boolean;
  readonly noonReport: boolean;
  readonly assistantDigests: boolean;
  readonly systemAnnouncements: boolean;
}

export interface SettingsUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string | null;
  readonly role: string;
  readonly status: "active" | "inactive";
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface SettingsInvite {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly role: string;
  readonly status: "pending" | "accepted" | "cancelled";
  readonly invitedBy: string;
  readonly expiresAt: string;
  readonly resendCount: number;
  readonly lastSentAt: string | null;
  readonly createdAt: string;
}

export interface IntegrationState {
  readonly provider: IntegrationProvider;
  readonly name: string;
  readonly description: string;
  readonly category: "Data" | "AI" | "Email" | "Fleet";
  readonly status: "NOT_CONFIGURED" | "CONFIGURED";
  /** Non-secret stored values, decrypted for display. */
  readonly displayValues: Record<string, string>;
  readonly configuredAt: string | null;
}

export interface AboutInfo {
  readonly appName: string;
  readonly appVersion: string;
  readonly buildVersion: string;
  readonly calculationEngineVersion: string;
  readonly authMode: string;
  readonly integrationsMode: string;
}

export interface SettingsBundle {
  readonly organization: OrganizationProfile;
  readonly general: GeneralSettings;
  readonly appearance: AppearanceSettings;
  readonly notificationPreferences: NotificationPreferences;
  readonly users: readonly SettingsUser[];
  readonly invites: readonly SettingsInvite[];
  readonly integrations: readonly IntegrationState[];
  readonly about: AboutInfo;
}
