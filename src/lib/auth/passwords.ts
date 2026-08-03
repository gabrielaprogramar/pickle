/**
 * passwords.ts — mock password hashing (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Phase 4.5 ships without a paid/bare auth provider, so credential hashing is
 * a deterministic mock: a salted digest string that is stable across runs (so
 * seeded demo users keep working after restarts) but clearly NOT a production
 * hash. The seam exists so real bcrypt/argon2 can replace these two functions
 * without touching the service layer.
 *
 * Format: `mock$v1$<hex digest>`. The prefix doubles as a runtime guard — any
 * value without it is treated as non-verifiable.
 */

const PREFIX = "mock$v1$";
const SALT = "poseidon-ledger::phase-4.5";

function digestHex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Deterministic mock hash. NEVER use for real credentials. */
export function hashPassword(password: string): string {
  return PREFIX + digestHex(SALT + "::" + password);
}

/** Verifies a password against a stored mock hash. */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.startsWith(PREFIX)) return false;
  return storedHash === hashPassword(password);
}
