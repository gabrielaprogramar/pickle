/**
 * client.ts — the public MarineTraffic client (the module's front door)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the single entry point the rest of Poseidon uses to ask for AIS data.
 * It hides three things behind one method:
 *   1. WHICH services to call (Voyage Forecast + Port Calls) and with what params.
 *   2. WHICH transport to use — MockTransport today, RealTransport when the key
 *      is purchased. That swap is the ONLY future change the plan permits.
 *   3. HOW to fuse the two responses into one clean Voyage (via parse.ts).
 *
 * THE MOCK/REAL SEAM, APPLIED
 * createMarineTrafficClient() reads config once. If config.useMock === true it
 * wires MockTransport; otherwise it wires RealTransport with the key. Either way
 * it exposes the identical `getVoyageByIMO(imo)` method, so callers never change.
 *
 * HOW IT FITS
 * Future phases (Supabase persistence, the API route, the UI) import only what
 * `index.ts` re-exports: createMarineTrafficClient, the domain types, and the
 * error classes. Nothing outside this folder imports http/mock/parse directly.
 */

import { loadConfig, type MarineTrafficConfig } from "./config";
import { VesselNotFoundError } from "./errors";
import { MockTransport, type MockTransportOptions } from "./mock";
import { RealTransport, type Transport } from "./http";
import {
  parseVoyageFromForecast,
  parseVoyageFromPortCalls,
  normalizeImo,
} from "./parse";
import type { Voyage } from "./types";

export interface MarineTrafficClient {
  /**
   * Fetch a single vessel's current voyage by IMO number.
   *
   * Always calls the Voyage Forecast service (the live leg). Also calls Port
   * Calls to enrich with a verified arrival timestamp and per-leg distance when
   * available. Returns ONE normalized Voyage.
   *
   * Throws:
   *   - InvalidIMOError       — the IMO failed format/checksum validation.
   *   - VesselNotFoundError   — no vessel exists for that IMO.
   *   - RateLimitError        — upstream throttled us (live mode).
   *   - UpstreamError/TimeoutError — transport failures (live mode).
   */
  getVoyageByIMO(imo: string | number): Promise<Voyage>;
}

export interface CreateClientOptions {
  /** Inject config explicitly (tests). Defaults to loadConfig(). */
  readonly config?: MarineTrafficConfig;
  /** Inject a transport explicitly (tests / future providers). */
  readonly transport?: Transport;
  /** Options forwarded to MockTransport when mock mode is auto-selected. */
  readonly mockOptions?: MockTransportOptions;
}

// Shared default params required by MarineTraffic jsono services.
const JSONO_V = "4"; // jsono protocol version documented by MarineTraffic.

/**
 * Factory that builds a ready-to-use client. Wiring the transport HERE (and only
 * here) is what keeps the mock→real swap to a single conditional.
 */
export function createMarineTrafficClient(opts: CreateClientOptions = {}): MarineTrafficClient {
  const config = opts.config ?? loadConfig();
  const transport = opts.transport ?? buildTransport(config, opts.mockOptions);

  return { getVoyageByIMO };

  async function getVoyageByIMO(imoInput: string | number): Promise<Voyage> {
    // 1. Validate + normalize the IMO before any I/O. Cheap, fast, defensive.
    const imo = normalizeImo(imoInput);

    // 2. Fetch the live leg from Voyage Forecast.
    const forecastRes = await transport.getVoyageForecast({
      imo,
      v: JSONO_V,
      protocol: "jsono",
    });

    const forecastRow = forecastRes.data[0];
    if (!forecastRow) {
      throw new VesselNotFoundError(`No vessel found for IMO ${imo}.`);
    }

    // 3. Enrich with Port Calls (verified arrival + distance). Non-fatal: if it
    //    fails or returns nothing, we still return the forecast-based voyage.
    let portCallVoyage: Awaited<ReturnType<typeof parseVoyageFromPortCalls>> = null;
    try {
      const portCallsRes = await transport.getPortCalls({
        imo,
        v: JSONO_V,
        protocol: "jsono",
        msgtype: "extended",
      });
      portCallVoyage = parseVoyageFromPortCalls(portCallsRes.data, {
        fetchedAt: portCallsRes.fetchedAt,
        mock: portCallsRes.mock,
      });
    } catch {
      // Port Calls is enrichment, not authoritative — degrade gracefully.
      portCallVoyage = null;
    }

    // 4. Build the canonical source stamp from the forecast response.
    const source = { fetchedAt: forecastRes.fetchedAt, mock: forecastRes.mock };

    // 5. Fuse: prefer the forecast as the base, then patch in richer arrival
    //    timestamp / distance from the port-call pair when they're present.
    const base = parseVoyageFromForecast(forecastRow, source);

    if (portCallVoyage?.arrival.timestamp) {
      // Port call gives a verified/extended arrival time — prefer it.
      return {
        ...base,
        arrival: { ...base.arrival, timestamp: portCallVoyage.arrival.timestamp },
        distanceNm: portCallVoyage.distanceNm ?? base.distanceNm,
      };
    }
    return base;
  }
}

/**
 * Picks the transport from config. This is the one place mock vs real diverges.
 * Adding a new provider later = one more branch here; the client is untouched.
 */
function buildTransport(
  config: MarineTrafficConfig,
  mockOptions?: MockTransportOptions,
): Transport {
  if (config.useMock) return new MockTransport(mockOptions);
  // useMock === false implies config.apiKey is non-null (guaranteed by loadConfig).
  return new RealTransport({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey as string,
    timeoutMs: config.timeoutMs,
    rateLimitPerMin: config.rateLimitPerMin,
    maxRetries: config.maxRetries,
  });
}
