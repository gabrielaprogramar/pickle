/**
 * http.ts — transport layer: rate limiting, timeout, retry, and the live fetch
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the ONLY place that touches the network. It does three things every
 * production HTTP client must do, and nothing else:
 *   1. RATE LIMIT — a token bucket honoring the configured calls/min so we
 *      never exceed the contract (MarineTraffic hard-caps every key at
 *      100 req/min; our local limit is the lower, safer one from config).
 *   2. TIMEOUT — aborts a request that hangs (AbortController, not a race).
 *   3. RETRY — re-attempts transient failures (429 + 5xx + network/timeout)
 *      with exponential backoff, mapped onto typed errors.
 *
 * THE MOCK/REAL SEAM
 * The `Transport` interface is the contract client.ts depends on. There are
 * exactly two implementations:
 *   - RealTransport (below) — real fetch + key + base URL. Used when the key
 *     is purchased and useMock=false.
 *   - MockTransport (mock.ts) — returns canned fixtures. Used today.
 * client.ts never knows which one it holds; it calls `transport.get(path, params)`.
 * Swapping mock for real is a one-line wiring change in client.ts.
 */

import {
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "./errors";
import type {
  RawPortCallResponse,
  RawVoyageForecastResponse,
} from "./types";

// ── 1. THE TRANSPORT CONTRACT ─────────────────────────────────────────────────

/** Query-string params are always string|number; lists are joined at build. */
export type QueryParams = Readonly<Record<string, string | number>>;

/**
 * Every transport (real and mock) returns the typed raw response for a given
 * service path. `mock` flags whether the bytes came from fixtures or the wire,
 * so the domain layer can stamp provenance on every Voyage.
 */
export interface TransportResponse<T> {
  readonly data: T;
  readonly mock: boolean;
  readonly fetchedAt: string; // ISO-8601 UTC
}

export interface Transport {
  /** Fetch the Voyage Forecast service for given query params. */
  getVoyageForecast(params: QueryParams): Promise<TransportResponse<RawVoyageForecastResponse>>;
  /** Fetch the Port Calls service for given query params. */
  getPortCalls(params: QueryParams): Promise<TransportResponse<RawPortCallResponse>>;
}

// ── 2. TOKEN-BUCKET RATE LIMITER ──────────────────────────────────────────────

/**
 * Minimal token bucket. `capacity` = burst size (== per-minute allowance),
 * `refill` tokens/sec. `acquire()` resolves immediately if a token is free,
 * otherwise waits until one refills. Serializes through a single await chain so
 * concurrent callers are throttled correctly.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // No token available — queue this caller and schedule a refill wake-up.
    await new Promise<void>((resolve) => this.queue.push(resolve));
    // When woken by drain, a token has been reserved for this caller.
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;
    // Release queued waiters as long as we have tokens to give.
    while (this.tokens >= 1 && this.queue.length > 0) {
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }
}

// ── 3. BACKOFF + RETRY MATH ───────────────────────────────────────────────────

/** Exponential backoff with full jitter: 2^attempt * base, capped. */
function backoffMs(attempt: number, baseMs = 500, capMs = 8_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.random() * exp; // full jitter spreads thundering-herd retries
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── 4. THE LIVE FETCH (only used when useMock === false) ──────────────────────

export interface RealTransportOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly rateLimitPerMin: number;
  readonly maxRetries: number;
  /** Injectable for tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
  readonly rateLimiter?: RateLimiter;
}

/**
 * RealTransport talks to MarineTraffic over HTTPS. It is fully implemented and
 * type-safe but DORMANT until the API key is purchased and useMock=false. Until
 * then it is never constructed — MockTransport is used instead (see client.ts).
 *
 * URL shape follows the official jsono service paths:
 *   {baseUrl}/voyageforecast/{apiKey}?imo=...&v=4&protocol=jsono&...
 *   {baseUrl}/portcalls/{apiKey}?imo=...&msgtype=extended&protocol=jsono&...
 *
 * (Per MarineTraffic docs the version `v` and `protocol` are required params.)
 */
export class RealTransport implements Transport {
  private readonly fetchImpl: typeof fetch;
  private readonly limiter: RateLimiter;

  constructor(private readonly opts: RealTransportOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.limiter =
      opts.rateLimiter ?? new RateLimiter(opts.rateLimitPerMin, opts.rateLimitPerMin / 60);
  }

  async getVoyageForecast(
    params: QueryParams,
  ): Promise<TransportResponse<RawVoyageForecastResponse>> {
    return this.request<RawVoyageForecastResponse>("voyageforecast", params);
  }

  async getPortCalls(
    params: QueryParams,
  ): Promise<TransportResponse<RawPortCallResponse>> {
    return this.request<RawPortCallResponse>("portcalls", params);
  }

  private async request<T>(service: string, params: QueryParams): Promise<TransportResponse<T>> {
    const url = this.buildUrl(service, params);

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      // Respect the contract rate limit before every attempt.
      await this.limiter.acquire();

      // On success, return immediately. On retryable failure, back off and loop.
      // On the final attempt, this returns (success) or throws (non-retryable or
      // exhausted retries) — so the loop always exits before reaching the guard.
      try {
        const data = await this.fetchJson<T>(url);
        return { data, mock: false, fetchedAt: new Date().toISOString() };
      } catch (err) {
        const retryable = isRetryable(err);
        if (!retryable || attempt === this.opts.maxRetries) throw err;
        await sleep(backoffMs(attempt));
      }
    }
    // Unreachable: every iteration either returns or throws. Defensive guard.
    throw new UpstreamError(
      `MarineTraffic ${service} request exited its retry loop without a result.`,
      0,
    );
  }

  private buildUrl(service: string, params: QueryParams): string {
    // The API key is a PATH segment per MarineTraffic's service URL convention,
    // never a query param, so it never ends up in logs as a query string.
    const path = `${this.opts.baseUrl}/${service}/${this.opts.apiKey}`;
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    ).toString();
    return qs ? `${path}?${qs}` : path;
  }

  /** Single fetch attempt with timeout + status/body parsing. */
  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : null;
        throw new RateLimitError(
          "MarineTraffic rate limit exceeded (429).",
          Number.isFinite(seconds) ? seconds : null,
        );
      }

      // MarineTraffic returns errors as a JSON object with `errors` field on !2xx.
      const bodyText = await res.text();
      if (!res.ok) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          parsed = bodyText;
        }
        throw new UpstreamError(
          `MarineTraffic ${service_label(url)} returned HTTP ${res.status}`,
          res.status,
          parsed,
        );
      }

      try {
        return JSON.parse(bodyText) as T;
      } catch {
        throw new UpstreamError(
          `MarineTraffic returned a non-JSON body (HTTP ${res.status}).`,
          res.status,
          bodyText,
        );
      }
    } catch (err) {
      // Distinguish our own thrown errors (rethrow) from network/abort errors.
      if (err instanceof RateLimitError || err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(`Request timed out after ${this.opts.timeoutMs}ms.`);
      }
      // Network-level failure (DNS, connection reset, etc.) — retryable upstream.
      throw new UpstreamError(
        `Network error contacting MarineTraffic: ${err instanceof Error ? err.message : String(err)}`,
        0,
        undefined,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Pulls the service name back out of a built URL for clearer error messages. */
function service_label(url: string): string {
  const m = url.match(/\/(voyageforecast|portcalls)\//);
  return m ? m[1]! : "service";
}

/** A failure is retryable only if it's transient: 429, 5xx, timeout, or network. */
function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError || err instanceof TimeoutError) return true;
  if (err instanceof UpstreamError) return err.status === 0 || err.status >= 500;
  return false;
}
