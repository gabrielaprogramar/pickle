/**
 * passwords.ts — bcrypt password hashing (Truth Week)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Replaces the deterministic mock hash (djb2 + fixed salt) with real bcrypt
 * (bcryptjs, pure-JS). bcrypt embeds a per-hash random salt, so two hashes of
 * the same password differ — that is correct and expected.
 *
 * FORMAT DETECTION / LEGACY RE-HASH
 *   • `$2a$...` (or `$2b$`/`$2y$`) — current bcrypt. Verified directly.
 *   • `mock$v1$...` — legacy Phase-4.5 mock hash. `verifyPassword` still
 *     accepts it (so a dev/demo DB with stale hashes keeps logging in), but
 *     `isLegacyMockHash` lets the caller transparently re-hash on login so
 *     the stored value is upgraded to bcrypt.
 *
 * SIGNATURE NOTE
 *   bcryptjs synchronous API is used here to preserve the existing sync
 *   call signature used by demo-seed and tests. Password hashing is not a hot
 *   path (once per login / once per seed build). The seam is isolated to this
 *   file, so a future async (or argon2) swap changes nothing downstream.
 */

import * as bcrypt from "bcryptjs";

/** bcrypt workload factor / cost. 12 is a sensible production default. */
export const BCRYPT_COST = 12;

/** Legacy mock prefix retained only for detection + transparent re-hash. */
export const LEGACY_MOCK_PREFIX = "mock$v1$";

/** True when a stored hash is an outdated mock hash that should be re-hashed. */
export function isLegacyMockHash(storedHash: string): boolean {
  return storedHash.startsWith(LEGACY_MOCK_PREFIX);
}

/** True when a stored hash is a current bcrypt hash (does not need re-hash). */
export function isBcryptHash(storedHash: string): boolean {
  return (
    storedHash.startsWith("$2a$") ||
    storedHash.startsWith("$2b$") ||
    storedHash.startsWith("$2y$")
  );
}

/**
 * True when the stored hash should be upgraded to the current algorithm/cost.
 * Today that means legacy mock hashes; extend here if the bcrypt cost is ever
 * raised (e.g. compare the encoded cost to BCRYPT_COST).
 */
export function needsRehash(storedHash: string): boolean {
  return isLegacyMockHash(storedHash) || !isBcryptHash(storedHash);
}

/** Hash a password with bcrypt (random salt embedded). */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

/**
 * Verify a password against a stored hash. Accepts both current bcrypt hashes
 * and legacy `mock$v1$` hashes (so existing dev/demo data keeps working while
 * the caller re-hashes on login via isLegacyMockHash).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (isLegacyMockHash(storedHash)) {
    return legacyMockVerify(password, storedHash);
  }
  if (!isBcryptHash(storedHash)) return false;
  try {
    return bcrypt.compareSync(password, storedHash);
  } catch {
    return false;
  }
}

// ── Legacy mock verification ────────────────────────────────────────────────
// Retained so a developer database seeded with the old mock hashes can still be
// logged into; the record is upgraded the moment a user logs in.

const LEGACY_MOCK_SALT = "poseidon-ledger::phase-4.5";

function legacyMockDigestHex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function legacyMockHash(password: string): string {
  return LEGACY_MOCK_PREFIX + legacyMockDigestHex(LEGACY_MOCK_SALT + "::" + password);
}

function legacyMockVerify(password: string, storedHash: string): boolean {
  return storedHash === legacyMockHash(password);
}
