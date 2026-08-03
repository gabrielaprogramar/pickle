import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import type {
  AppearanceSettings,
  NotificationPreferences,
  OrganizationProfile,
} from "@/lib/settings";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import {
  buildDefaultSettingsApiDeps,
  requireAuth,
  requirePermission,
} from "./_lib";
import type { SettingsApiDeps } from "./_lib";
import { PERMISSIONS } from "@/lib/roles/catalog";

interface PatchBody {
  readonly section?:
    | "organization"
    | "general"
    | "appearance"
    | "notifications"
    | "integrations";
  readonly organization?: Partial<Omit<OrganizationProfile, "id">>;
  readonly general?: {
    readonly organizationName?: string;
    readonly defaultTimezone?: string;
    readonly defaultReportingYear?: number;
    readonly language?: string;
  };
  readonly appearance?: AppearanceSettings;
  readonly notifications?: NotificationPreferences;
  readonly integrations?: {
    readonly provider: string;
    readonly action: "configure" | "disconnect";
    readonly config?: Record<string, unknown>;
  };
}

/**
 * GET /api/settings
 *
 * Returns the full settings bundle for the current session's organization.
 */
export async function GET(
  req: Request,
  _ctx: unknown,
  deps: SettingsApiDeps = buildDefaultSettingsApiDeps(),
): Promise<Response> {
  try {
    const session = await requireAuth(deps, req);
    if (session instanceof Response) return session;

    const bundle = await deps.settings.getBundle(session.organization.id);
    return apiSuccess(bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}

/**
 * PATCH /api/settings
 *
 * Applies a section-scoped settings update. Each section maps to a permission:
 * organization/general/appearance/notifications → settings.general;
 * integrations → settings.integrations.
 */
export async function PATCH(
  req: Request,
  _ctx: unknown,
  deps: SettingsApiDeps = buildDefaultSettingsApiDeps(),
): Promise<Response> {
  try {
    const session = await requireAuth(deps, req);
    if (session instanceof Response) return session;

    const raw = await parseJsonBody<PatchBody>(req);
    if (!raw || !raw.section) {
      return apiError(VALIDATION_ERROR, "section is required", 400);
    }

    const orgId = session.organization.id;

    switch (raw.section) {
      case "organization": {
        const denied = requirePermission(session, PERMISSIONS.org_manage);
        if (denied) return denied;
        const profile = await deps.settings.updateOrganization(
          orgId,
          raw.organization ?? {},
        );
        return apiSuccess({ section: "organization", organization: profile });
      }
      case "general": {
        const denied = requirePermission(session, PERMISSIONS.settings_general);
        if (denied) return denied;
        const general = await deps.settings.updateGeneral(orgId, raw.general ?? {});
        return apiSuccess({ section: "general", general });
      }
      case "appearance": {
        const denied = requirePermission(session, PERMISSIONS.settings_general);
        if (denied) return denied;
        if (!raw.appearance) {
          return apiError(VALIDATION_ERROR, "appearance is required", 400);
        }
        const appearance = await deps.settings.updateAppearance(orgId, raw.appearance);
        return apiSuccess({ section: "appearance", appearance });
      }
      case "notifications": {
        const denied = requirePermission(session, PERMISSIONS.settings_general);
        if (denied) return denied;
        if (!raw.notifications) {
          return apiError(VALIDATION_ERROR, "notifications is required", 400);
        }
        const notifications = await deps.settings.updateNotificationPreferences(
          orgId,
          raw.notifications,
        );
        return apiSuccess({ section: "notifications", notifications });
      }
      case "integrations": {
        const denied = requirePermission(session, PERMISSIONS.settings_integrations);
        if (denied) return denied;
        const body = raw.integrations;
        if (!body || !body.provider || !isIntegrationProvider(body.provider)) {
          return apiError(VALIDATION_ERROR, "a valid integration provider is required", 400);
        }
        if (body.action === "disconnect") {
          const integration = await deps.settings.disconnectIntegration(
            orgId,
            body.provider,
          );
          return apiSuccess({ section: "integrations", integration });
        }
        if (body.action !== "configure") {
          return apiError(VALIDATION_ERROR, "action must be 'configure' or 'disconnect'", 400);
        }
        const integration = await deps.settings.saveIntegration(
          orgId,
          body.provider,
          body.config ?? {},
        );
        return apiSuccess({ section: "integrations", integration });
      }
      default:
        return apiError(VALIDATION_ERROR, `Unknown section: ${raw.section}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
