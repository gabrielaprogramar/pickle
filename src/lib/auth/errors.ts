/**
 * errors.ts — typed errors for the mock auth service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Callers (API routes, the frontend) branch on these with `instanceof`, so the
 * HTTP status mapping lives in one place (see httpStatusForError).
 */

export class AuthError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid email or password") {
    super(message, "INVALID_CREDENTIALS");
  }
}

export class InvalidSessionError extends AuthError {
  constructor(message = "Session is missing, expired or revoked") {
    super(message, "INVALID_SESSION");
  }
}

export class InvalidResetTokenError extends AuthError {
  constructor(message = "Reset token is invalid or has expired") {
    super(message, "INVALID_RESET_TOKEN");
  }
}

export class UserNotActiveError extends AuthError {
  constructor(message = "This account is not active") {
    super(message, "USER_NOT_ACTIVE");
  }
}
