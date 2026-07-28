/**
 * errors.ts — typed error hierarchy for the Supabase repository layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Mirrors the MarineTraffic module's error philosophy: callers (the API route,
 * the orchestration layer) need to branch on WHY a write failed, not parse
 * PostgREST error text. Four distinct failure modes cover everything Phase 1B
 * can encounter:
 *
 *   - bad config            → SupabaseConfigError
 *   - integrity violation   → RepositoryIntegrityError (FK, unique, CHECK)
 *   - transient/upstream    → RepositoryUpstreamError (network, 5xx)
 *   - unexpected/programming → RepositoryError (base, unknown)
 *
 * The PostgREST error body from @supabase/supabase-js carries a stable `code`
 * (PostgreSQL SQLSTATE, e.g. 23505 = unique_violation). mapError() uses it to
 * pick the right typed subclass so repositories don't have to.
 *
 * HOW IT FITS
 * config.ts throws SupabaseConfigError on missing live credentials.
 * repositories import mapError() to wrap every PostgREST failure.
 */

/** Base class for every error this module raises. Narrow with `instanceof`. */
export abstract class SupabaseError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** A required environment variable is missing or malformed. Fatal at startup. */
export class SupabaseConfigError extends SupabaseError {}

/** Base for repository write/read failures. */
export abstract class RepositoryError extends SupabaseError {
  constructor(
    message: string,
    /** The PostgreSQL SQLSTATE code from PostgREST, when available. */
    public readonly pgCode: string | null = null,
    /** The original PostgREST error object, for debugging. */
    public readonly postgrestError?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/**
 * An integrity constraint was violated: unique_violation (23505), foreign_key
 * (23503), check_violation (23514), not_null (23502). Caller input problem.
 */
export class RepositoryIntegrityError extends RepositoryError {}

/** A transient upstream failure: network error, 5xx, timeout. Retryable. */
export class RepositoryUpstreamError extends RepositoryError {}

// ── PostgREST error shape + SQLSTATE mapping ─────────────────────────────────

/**
 * The error shape thrown by @supabase/supabase-js on a failed query. We model
 * only the fields we use; the real object has more.
 */
interface PostgrestErrorLike {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
}

/** PostgreSQL SQLSTATE codes that represent integrity violations. */
const INTEGRITY_CODES: ReadonlySet<string> = new Set([
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
  "23P01", // exclusion_violation
]);

/** Returns true when the thrown value looks like a PostgREST error. */
function isPostgrestError(value: unknown): value is PostgrestErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

/**
 * Wrap any thrown value into the right RepositoryError subclass.
 * - PostgREST integrity codes → RepositoryIntegrityError
 * - Other PostgREST / network failures → RepositoryUpstreamError
 * - Anything else → RepositoryError (via the base class)
 *
 * Usage in repositories:
 *   try { ... } catch (e) { throw mapError("insert voyage", e); }
 */
export function mapError(operation: string, thrown: unknown): RepositoryError {
  if (isPostgrestError(thrown)) {
    const code = thrown.code ?? null;
    const msg = `${operation} failed: ${thrown.message}`;
    if (code && INTEGRITY_CODES.has(code)) {
      return new RepositoryIntegrityError(msg, code, thrown);
    }
    return new RepositoryUpstreamError(msg, code, thrown);
  }
  // Non-PostgREST throw (e.g. TypeError, network). Treat as upstream.
  const msg =
    thrown instanceof Error
      ? `${operation} failed: ${thrown.message}`
      : `${operation} failed: ${String(thrown)}`;
  return new RepositoryUpstreamError(msg, null, undefined, thrown);
}
