import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { buildDefaultAuthApiDeps } from "../_lib";
import type { AuthApiDeps } from "../_lib";

interface ResetPasswordBody {
  readonly token?: string;
  readonly password?: string;
}

/**
 * POST /api/auth/reset-password
 *
 * Completes a password reset using the one-time token from the reset email.
 */
export async function POST(
  req: Request,
  _ctx: unknown,
  deps: AuthApiDeps = buildDefaultAuthApiDeps(),
): Promise<Response> {
  try {
    const raw = await parseJsonBody<ResetPasswordBody>(req);
    const token = raw?.token?.trim();
    const password = raw?.password;

    if (!token || !password) {
      return apiError(VALIDATION_ERROR, "token and password are required", 400);
    }

    await deps.service.resetPassword(token, password);
    return apiSuccess({ reset: true });
  } catch (err) {
    if (err instanceof Error && err.constructor.name === "InvalidResetTokenError") {
      return apiError("INVALID_RESET_TOKEN", err.message, 400);
    }
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
