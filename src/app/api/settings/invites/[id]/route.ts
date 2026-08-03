import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { buildDefaultSettingsApiDeps, requireAuth, requirePermission } from "../../_lib";
import type { SettingsApiDeps } from "../../_lib";
import { PERMISSIONS } from "@/lib/roles/catalog";

interface PatchBody {
  readonly action?: "cancel" | "resend";
}

/**
 * PATCH /api/settings/invites/[id]
 *
 * Cancels a pending invitation or resends the mock invite email.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
  deps: SettingsApiDeps = buildDefaultSettingsApiDeps(),
): Promise<Response> {
  try {
    const session = await requireAuth(deps, req);
    if (session instanceof Response) return session;
    const denied = requirePermission(session, PERMISSIONS.users_invite);
    if (denied) return denied;

    const raw = await parseJsonBody<PatchBody>(req);
    const action = raw?.action;
    if (action !== "cancel" && action !== "resend") {
      return apiError(VALIDATION_ERROR, "action must be 'cancel' or 'resend'", 400);
    }

    const invite =
      action === "cancel"
        ? await deps.settings.cancelInvite(session.organization.id, params.id)
        : await deps.settings.resendInvite(session.organization.id, params.id);

    return apiSuccess({ invite });
  } catch (err) {
    if (err instanceof Error) {
      const name = err.constructor.name;
      if (name === "InviteNotFoundError") {
        return apiError("INVITE_NOT_FOUND", err.message, 404);
      }
      if (name === "InviteConflictError") {
        return apiError("INVITE_CONFLICT", err.message, 409);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
