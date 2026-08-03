import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { isRoleCode } from "@/lib/roles/catalog";
import { buildDefaultSettingsApiDeps, requireAuth, requirePermission } from "../../_lib";
import type { SettingsApiDeps } from "../../_lib";
import { PERMISSIONS } from "@/lib/roles/catalog";

interface PatchBody {
  readonly role?: string;
  readonly status?: "active" | "inactive";
}

/**
 * PATCH /api/settings/users/[id]
 *
 * Changes a member's role or status. Enforces the deterministic role hierarchy
 * (only a senior role may reassign) and the last-owner protection.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
  deps: SettingsApiDeps = buildDefaultSettingsApiDeps(),
): Promise<Response> {
  try {
    const session = await requireAuth(deps, req);
    if (session instanceof Response) return session;
    const denied = requirePermission(session, PERMISSIONS.users_manage);
    if (denied) return denied;

    const raw = await parseJsonBody<PatchBody>(req);
    const role = raw?.role;
    const status = raw?.status;
    if (role !== undefined && !isRoleCode(role)) {
      return apiError(VALIDATION_ERROR, `Unknown role: ${role}`, 400);
    }
    if (status !== undefined && status !== "active" && status !== "inactive") {
      return apiError(VALIDATION_ERROR, "status must be 'active' or 'inactive'", 400);
    }
    if (role === undefined && status === undefined) {
      return apiError(VALIDATION_ERROR, "role or status is required", 400);
    }

    const user = await deps.settings.updateUser(
      session.organization.id,
      session.user.id,
      params.id,
      { role, status },
    );
    return apiSuccess({ user });
  } catch (err) {
    if (err instanceof Error) {
      const name = err.constructor.name;
      if (name === "UserNotFoundError") {
        return apiError("USER_NOT_FOUND", err.message, 404);
      }
      if (name === "CannotDemoteSelfError") {
        return apiError("FORBIDDEN", err.message, 403);
      }
      if (name === "CannotDeactivateLastOwnerError") {
        return apiError("LAST_OWNER", err.message, 409);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
