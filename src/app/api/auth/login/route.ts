import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { sessionCookieValue } from "@/app/api/_lib/cookies";
import { buildDefaultAuthApiDeps } from "../_lib";
import type { AuthApiDeps } from "../_lib";

interface LoginBody {
  readonly email?: string;
  readonly password?: string;
}

/**
 * POST /api/auth/login
 *
 * Authenticates a user and returns a session token (set as a cookie) plus the
 * session info.
 */
export async function POST(
  req: Request,
  _ctx: unknown,
  deps: AuthApiDeps = buildDefaultAuthApiDeps(),
): Promise<Response> {
  try {
    const raw = await parseJsonBody<LoginBody>(req);
    const email = raw?.email?.trim().toLowerCase();
    const password = raw?.password;

    if (!email || !password) {
      return apiError(VALIDATION_ERROR, "email and password are required", 400);
    }

    const session = await deps.service.login(email, password);

    const res = apiSuccess({
      user: session.user,
      organization: session.organization,
    });
    res.headers.set(
      "Set-Cookie",
      sessionCookieValue(session.token, process.env.NODE_ENV === "production"),
    );
    return res;
  } catch (err) {
    if (err instanceof Error) {
      const name = err.constructor.name;
      if (name === "InvalidCredentialsError") {
        return apiError("INVALID_CREDENTIALS", err.message, 401);
      }
      if (name === "UserNotActiveError") {
        return apiError("FORBIDDEN", err.message, 403);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
