import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { buildDefaultAuthApiDeps } from "../_lib";
import type { AuthApiDeps } from "../_lib";

interface ForgotPasswordBody {
  readonly email?: string;
}

/**
 * POST /api/auth/forgot-password
 *
 * Starts a password reset. Always returns success (to avoid leaking which
 * accounts exist); a mock reset email is dispatched when the email matches a
 * user.
 */
export async function POST(
  req: Request,
  _ctx: unknown,
  deps: AuthApiDeps = buildDefaultAuthApiDeps(),
): Promise<Response> {
  try {
    const raw = await parseJsonBody<ForgotPasswordBody>(req);
    const email = raw?.email?.trim().toLowerCase();
    if (!email) {
      return apiError(VALIDATION_ERROR, "email is required", 400);
    }

    const baseUrl = new URL(req.url).origin;
    await deps.service.forgotPassword(email, { baseUrl });

    return apiSuccess({ sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
