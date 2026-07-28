/**
 * config.ts — environment-driven configuration for the MarineTraffic module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Centralizes every external value the module depends on (API key, base URL,
 * rate limits, timeouts) in one validated place. Two hard rules from the plan:
 *   1. Secrets come only from environment variables — never hardcoded.
 *   2. Today we run fully mocked; a single env flag flips us to live later.
 *
 * THE MOCK/REAL SEAM
 * `MARINETRAFFIC_USE_MOCK` is the ONE toggle that decides whether client.ts
 * wires up MockTransport or RealTransport. Default is `true` (mocked). The
 * moment the API key is purchased you set:
 *
 *     MARINETRAFFIC_USE_MOCK=false
 *     MARINETRAFFIC_API_KEY=<40-char key>
 *
 * …and nothing else changes. That is the only future change the plan allows.
 *
 * HOW IT FITS
 * client.ts calls loadConfig() once, then picks the transport based on
 * config.useMock. RealTransport reads config.apiKey / config.baseUrl. A missing
 * key is only an error when useMock === false (we don't demand a key we won't
 * use yet), which keeps Phase 1A runnable with zero secrets.
 */

import { ConfigurationError } from "./errors";

export interface MarineTrafficConfig {
  /**
   * When true, the client uses MockTransport and never touches the network.
   * Defaults to true so the app runs out-of-the-box without a key.
   */
  readonly useMock: boolean;
  /** 40-char MarineTraffic API key. Required only when useMock === false. */
  readonly apiKey: string | null;
  /** Base URL for MarineTraffic services. */
  readonly baseUrl: string;
  /** Per-call request timeout in ms. */
  readonly timeoutMs: number;
  /** Max requests per minute the client is allowed to send. */
  readonly rateLimitPerMin: number;
  /** How many times to retry a transient failure (429/5xx/timeout). */
  readonly maxRetries: number;
}

const SERVICE_DOCS_BASE_URL = "https://services.marinetraffic.com/api";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function parseIntPositive(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Reads and validates configuration from the process environment.
 * Throws ConfigurationError only for a HARD misconfiguration: live mode without
 * an API key. In mock mode, missing values fall back to safe defaults.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): MarineTrafficConfig {
  const useMock = parseBoolean(env.MARINETRAFFIC_USE_MOCK, true);
  const apiKey = env.MARINETRAFFIC_API_KEY?.trim() || null;

  // The single hard gate: live mode requires a key. Mock mode never needs one.
  if (!useMock && !apiKey) {
    throw new ConfigurationError(
      "MARINETRAFFIC_USE_MOCK is false but MARINETRAFFIC_API_KEY is not set. " +
        "Either set the key or leave mock mode on.",
    );
  }

  // Light validation in live mode: MarineTraffic keys are 40 hex chars. Warn-only
  // (not fatal) so we don't block on a format that may differ by plan.
  if (!useMock && apiKey && !/^[a-f0-9]{40}$/i.test(apiKey)) {
    // Non-fatal — we surface it but still proceed; the real API will reject it
    // with an UpstreamError if it's genuinely wrong.
    // eslint-disable-next-line no-console
    console.warn(
      "[marinetraffic] MARINETRAFFIC_API_KEY does not match the expected 40-char hex format.",
    );
  }

  return {
    useMock,
    apiKey,
    baseUrl: env.MARINETRAFFIC_BASE_URL?.trim() || SERVICE_DOCS_BASE_URL,
    timeoutMs: parseIntPositive(env.MARINETRAFFIC_TIMEOUT_MS, 10_000),
    rateLimitPerMin: parseIntPositive(env.MARINETRAFFIC_RATE_LIMIT_PER_MIN, 30),
    maxRetries: parseIntPositive(env.MARINETRAFFIC_MAX_RETRIES, 3),
  };
}
