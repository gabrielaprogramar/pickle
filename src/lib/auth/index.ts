/**
 * index.ts — public barrel for the mock auth module
 */
export { createAuthService, AuthService } from "./service";
export type {
  AuthUser,
  AuthOrganization,
  AuthSession,
  AuthSessionInfo,
  LoginOptions,
  ForgotPasswordOptions,
  ResetPasswordOptions,
  CreateAuthServiceOptions,
} from "./service";
export {
  hashPassword,
  verifyPassword,
} from "./passwords";
export {
  generateToken,
  hashToken,
  sessionExpiry,
  resetExpiry,
  SESSION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "./tokens";
export {
  AuthError,
  InvalidCredentialsError,
  InvalidSessionError,
  InvalidResetTokenError,
  UserNotActiveError,
} from "./errors";
