/**
 * index.ts — public barrel for the settings module
 */
export { SettingsService, createSettingsService } from "./service";
export type {
  InviteUserInput,
  CreateSettingsServiceOptions,
  SettingsServiceDeps,
} from "./service";
export type {
  OrganizationProfile,
  GeneralSettings,
  AppearanceSettings,
  NotificationPreferences,
  SettingsUser,
  SettingsInvite,
  IntegrationState,
  AboutInfo,
  SettingsBundle,
} from "./types";
export {
  SettingsError,
  OrganizationNotFoundError,
  UserNotFoundError,
  InviteNotFoundError,
  InviteConflictError,
  CannotDeactivateLastOwnerError,
  CannotDemoteSelfError,
  InvalidIntegrationError,
} from "./errors";
export {
  APP_NAME,
  APP_VERSION,
  BUILD_VERSION,
  CALCULATION_ENGINE_VERSION,
  AUTH_MODE,
  INTEGRATIONS_MODE,
} from "./version";
