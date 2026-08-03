/**
 * cookies.ts — mock session cookie helpers
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The mock auth seam stores its session token in an httpOnly-style cookie so
 * route handlers can resolve it server-side. Real Supabase Auth replaces this
 * entirely in a later phase; the cookie name is a public constant so the
 * frontend service and the routes agree.
 */

export const AUTH_COOKIE_NAME = "pl_session";

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    if (trimmed.slice(0, idx).trim() === name) {
      return decodeURIComponent(trimmed.slice(idx + 1).trim());
    }
  }
  return null;
}

export function sessionCookieValue(token: string): string {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 60 * 60}`;
}

export function clearSessionCookieValue(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
