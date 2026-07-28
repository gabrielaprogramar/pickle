/**
 * errors.ts — typed error hierarchy for the MarineTraffic module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Plain `Error` strings make control flow guesswork. Callers (client.ts, and
 * later Supabase persistence + the UI) need to branch on WHY a fetch failed:
 *   - bad input        → ConfigurationError / InvalidIMOError
 *   - upstream problem → RateLimitError / UpstreamError / TimeoutError
 *   - no data          → VesselNotFoundError
 *
 * Typed errors let the caller do `if (e instanceof RateLimitError)` and pick
 * the right retry/escalation path instead of parsing message text.
 *
 * HOW IT FITS
 * config.ts throws ConfigurationError on missing/bad env.
 * parse.ts   throws InvalidIMOError on a bad IMO number.
 * http.ts    throws TimeoutError / RateLimitError / UpstreamError.
 * client.ts  throws VesselNotFoundError when the API returns no rows.
 */

/** Base class for every error this module raises. Narrow with `instanceof`. */
export abstract class MarineTrafficError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Preserve stack on V8 without dragging in platform-specific "any".
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** A required environment variable is missing or malformed. Fatal at startup. */
export class ConfigurationError extends MarineTrafficError {}

/** The supplied IMO failed checksum/format validation. Caller input error. */
export class InvalidIMOError extends MarineTrafficError {}

/** The request exceeded the upstream or local rate limit (HTTP 429). */
export class RateLimitError extends MarineTrafficError {
  constructor(
    message: string,
    /** Seconds to wait before retrying, when the upstream provides one. */
    public readonly retryAfterSeconds: number | null = null,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** The upstream request exceeded the configured timeout. Retryable. */
export class TimeoutError extends MarineTrafficError {}

/** MarineTraffic returned a non-2xx (other than 429) or a malformed body. */
export class UpstreamError extends MarineTrafficError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** The IMO is valid but no vessel / voyage data exists for it. */
export class VesselNotFoundError extends MarineTrafficError {}

/** A response parsed but did not contain enough data to build a Voyage. */
export class MalformedResponseError extends MarineTrafficError {}
