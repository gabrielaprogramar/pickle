import { apiError, apiCreated, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { isRoleCode } from "@/lib/roles/catalog";
import { buildDefaultSettingsApiDeps, requireAuth, requirePermission } from "../_lib";
import type { SettingsApiDeps } from "../_lib";
import { PERMISSIONS } from "@/lib/roles/catalog";

interface InviteBody {
  readonly email?: string;
  readonly fullName?: string | null;
  readonly role?: string;
}

/**
 * POST /api/settings/invites
 *
 * Creates a pending invitation and dispatches a mock invite email.
 */
export async function POST(
  req: Request,
  _ctx: unknown,
  deps: SettingsApiDeps = buildDefaultSettingsApiDeps(),
): Promise<Response> {
  try {
    const session = await requireAuth(deps, req);
    if (session instanceof Response) return session;
    const denied = requirePermission(session, PERMISSIONS.users_invite);
    if (denied) return denied;

    const raw = await parseJsonBody<InviteBody>(req);
    const email = raw?.email?.trim().toLowerCase();
    const role = raw?.role;
    if (!email || !role) {
      return apiError(VALIDATION_ERROR, "email and role are required", 400);
    }
    if (!isRoleCode(role)) {
      return apiError(VALIDATION_ERROR, `Unknown role: ${role}`, 400);
    }

    const invite = await deps.settings.inviteUser(session.organization.id, session.user.id, {
      email,
      fullName: raw.fullName ?? null,
      role,
    });
    return apiCreated({ invite });
  } catch (err) {
    if (err instanceof Error) {
      const name = err.constructor.name;
      if (name === "InviteConflictError") {
        return apiError("INVITE_CONFLICT", err.message, 409);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
