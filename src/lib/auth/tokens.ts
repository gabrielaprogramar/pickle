/**
 * tokens.ts — session & reset token generation (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tokens are opaque random strings persisted in `auth_tokens`. Generation is
 * crypto-random; the persisted form is a hashed digest so a leaked table is
 * not directly replayable. This mirrors how a real auth provider behaves while
 * staying fully mock/self-contained.
 */

import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

/** 32-byte random base64url token. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 digest used as the storage key for a token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: string): string {
  return new Date(new Date(now).getTime() + SESSION_TTL_MS).toISOString();
}

export function resetExpiry(now: string): string {
  return new Date(new Date(now).getTime() + PASSWORD_RESET_TTL_MS).toISOString();
}
