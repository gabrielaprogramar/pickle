import { apiFetch } from "./api-client";
import type {
  AuthOrganization,
  AuthUser,
} from "@/lib/auth";
import type { SettingsBundle } from "@/lib/settings";

export interface AuthSessionResponse {
  readonly user: AuthUser | null;
  readonly organization: AuthOrganization | null;
}

export interface LoginResponse {
  readonly user: AuthUser;
  readonly organization: AuthOrganization;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

/** Resolve the current session (authenticated or not). */
export async function getSession(): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("auth/session");
}

/** Sign in and store the session cookie. */
export async function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Revoke the session cookie. */
export async function logout(): Promise<{ readonly loggedOut: boolean }> {
  return apiFetch<{ loggedOut: boolean }>("auth/logout", { method: "POST" });
}

export async function requestPasswordReset(email: string): Promise<{ readonly sent: boolean }> {
  return apiFetch<{ sent: boolean }>("auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ readonly reset: boolean }> {
  return apiFetch<{ reset: boolean }>("auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

/** Fetch the full settings bundle. */
export async function getSettingsBundle(): Promise<SettingsBundle> {
  return apiFetch<SettingsBundle>("settings");
}
