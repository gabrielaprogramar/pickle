import { apiSuccess } from "@/app/api/_lib/http";
import { clearSessionCookieValue, readCookie, AUTH_COOKIE_NAME } from "@/app/api/_lib/cookies";
import { buildDefaultAuthApiDeps } from "../_lib";
import type { AuthApiDeps } from "../_lib";

/**
 * POST /api/auth/logout
 *
 * Revokes the current session token (if any) and clears the session cookie.
 */
export async function POST(
  req: Request,
  _ctx: unknown,
  deps: AuthApiDeps = buildDefaultAuthApiDeps(),
): Promise<Response> {
  const token = readCookie(req.headers.get("cookie"), AUTH_COOKIE_NAME);
  if (token) {
    await deps.service.logout(token);
  }
  const res = apiSuccess({ loggedOut: true });
  res.headers.set(
    "Set-Cookie",
    clearSessionCookieValue(process.env.NODE_ENV === "production"),
  );
  return res;
}
