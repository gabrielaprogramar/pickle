import { apiError, apiSuccess } from "@/app/api/_lib/http";
import { readCookie, AUTH_COOKIE_NAME } from "@/app/api/_lib/cookies";
import { buildDefaultAuthApiDeps } from "../_lib";
import type { AuthApiDeps } from "../_lib";

/**
 * GET /api/auth/session
 *
 * Resolves the session cookie to the current user + organization, or returns
 * `{ user: null, organization: null }` when unauthenticated.
 */
export async function GET(
  req: Request,
  _ctx: unknown,
  deps: AuthApiDeps = buildDefaultAuthApiDeps(),
): Promise<Response> {
  try {
    const token = readCookie(req.headers.get("cookie"), AUTH_COOKIE_NAME);
    if (!token) {
      return apiSuccess({ user: null, organization: null });
    }
    const session = await deps.service.getSession(token);
    if (!session) {
      return apiSuccess({ user: null, organization: null });
    }
    return apiSuccess({
      user: session.user,
      organization: session.organization,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
