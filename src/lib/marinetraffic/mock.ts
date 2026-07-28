/**
 * mock.ts — MockTransport + realistic fixtures (the mock/real seam, mock side)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the mocked half of the seam declared in http.ts. It implements the
 * exact same `Transport` interface as RealTransport, but returns canned data
 * shaped EXACTLY like MarineTraffic's real jsono responses (same field names,
 * same SHIPNAME/IMO/LAST_PORT/ETA/... spelling). This guarantees:
 *
 *   - client.ts and parse.ts are exercised against realistic shapes TODAY,
 *     with no API key and no network.
 *   - The day the key is purchased, client.ts swaps MockTransport→RealTransport
 *     and parse.ts is ALREADY proven correct against the same field names.
 *
 * HOW IT FITS
 * client.ts constructs MockTransport whenever config.useMock === true (the
 * default). parse.ts consumes what this file emits exactly as it would consume
 * a live response. The `mock: true` flag flows into VoyageSource so callers
 * can always tell mocked data from live data.
 *
 * FIXTURE FIDELITY
 * Field names mirror the documented jsono output (see types.ts). Timestamps
 * follow MarineTraffic's "YYYY-MM-DD HH:MM:SS" UTC convention. Distances are in
 * nautical miles. IMO numbers used (9074729 = "SILVER CLOUD") are real-format
 * 7-digit values so validation code paths are exercised against real checksums.
 */

import type { Transport, TransportResponse, QueryParams } from "./http";
import type {
  RawPortCallResponse,
  RawPortCallRow,
  RawVoyageForecastResponse,
  RawVoyageForecastRow,
} from "./types";

// ── 1. FIXTURES (shaped exactly like MarineTraffic jsono output) ──────────────

/**
 * Voyage Forecast fixture for IMO 9074729 ("SILVER CLOUD"-format yacht).
 * One currently-in-progress leg: departed Antibes, bound for Palma de Mallorca.
 */
const voyageForecastFixture: RawVoyageForecastRow = {
  SHIPNAME: "Aurelia",
  IMO: "9074729",
  MMSI: "310625000",
  SHIP_ID: "371663",
  LAST_PORT: "Antibes",
  LAST_PORT_ID: "37",
  LAST_PORT_TIME: "2026-06-26 07:40:00",
  NEXT_PORT_NAME: "Palma de Mallorca",
  NEXT_PORT_ID: "10",
  ETA: "2026-06-29 08:00:00",
  ETA_CALC: "2026-06-29 08:15:00",
  DESTINATION: "Palma de Mallorca",
  DISTANCE_TRAVELLED: 196,
  DISTANCE_TO_GO: 58,
  SPEED: 11.2,
  STATUS: 0,
  TIMESTAMP: "2026-06-28 19:05:00",
};

/**
 * Port Calls fixture (msgtype=extended) for the same IMO — historical legs.
 * MOVE_TYPE: 0 = arrival, 1 = departure. Ordered most-recent-first as the API
 * returns them. The departure from Antibes + arrival at Palma pair corresponds
 * to the live leg in the voyage forecast above, demonstrating how the two
 * services combine into one Voyage.
 */
const portCallsFixture: RawPortCallRow[] = [
  {
    SHIPNAME: "Aurelia",
    IMO: "9074729",
    MMSI: "310625000",
    PORT_NAME: "Palma de Mallorca",
    PORT_ID: "10",
    MOVE_TYPE: 0, // arrival (scheduled / imminent)
    TIMESTAMP: "2026-06-29 08:15:00",
    DISTANCE_FROM_PREV_PORT: 254,
    TYPE_NAME: "Yacht",
  },
  {
    SHIPNAME: "Aurelia",
    IMO: "9074729",
    MMSI: "310625000",
    PORT_NAME: "Antibes",
    PORT_ID: "37",
    MOVE_TYPE: 1, // departure
    TIMESTAMP: "2026-06-26 07:40:00",
    DISTANCE_FROM_PREV_PORT: 0,
    TYPE_NAME: "Yacht",
  },
  {
    SHIPNAME: "Aurelia",
    IMO: "9074729",
    MMSI: "310625000",
    PORT_NAME: "Antibes",
    PORT_ID: "37",
    MOVE_TYPE: 0, // prior arrival
    TIMESTAMP: "2026-06-23 18:20:00",
    DISTANCE_FROM_PREV_PORT: 138,
    TYPE_NAME: "Yacht",
  },
];

/** A second vessel for multi-vessel testing / future fleet work. */
const secondaryFixture: RawVoyageForecastRow = {
  SHIPNAME: "Calypso Nova",
  IMO: "9707211",
  MMSI: "311045000",
  SHIP_ID: "451982",
  LAST_PORT: "Piraeus",
  LAST_PORT_ID: "1",
  LAST_PORT_TIME: "2026-06-27 06:10:00",
  NEXT_PORT_NAME: "Mykonos",
  NEXT_PORT_ID: "92",
  ETA: "2026-06-29 14:00:00",
  ETA_CALC: "2026-06-29 13:45:00",
  DESTINATION: "Mykonos",
  DISTANCE_TRAVELLED: 87,
  DISTANCE_TO_GO: 42,
  SPEED: 9.5,
  STATUS: 0,
  TIMESTAMP: "2026-06-28 20:30:00",
};

// Lookup tables keyed by IMO (string) — mirrors how the real API would answer
// a single-vessel query. queryFixture() selects the right one by `imo` param.
const voyageForecastByImo: Record<string, RawVoyageForecastRow> = {
  "9074729": voyageForecastFixture,
  "9707211": secondaryFixture,
};

const portCallsByImo: Record<string, RawPortCallRow[]> = {
  "9074729": portCallsFixture,
  // Secondary vessel has no port-call history fixture → getPortCalls returns []
  // to exercise the empty-response path in parse.ts.
};

// ── 2. MOCK TRANSPORT ─────────────────────────────────────────────────────────

export interface MockTransportOptions {
  /** Artificial latency in ms to mimic real network round-trips. */
  readonly latencyMs?: number;
  /** Optional override to force-flush tests without waiting. */
  readonly clock?: () => Date;
}

/**
 * MockTransport: a Transport that resolves fixture data. Same interface as
 * RealTransport, no network, no key. Used by client.ts when useMock === true.
 */
export class MockTransport implements Transport {
  private readonly latencyMs: number;
  private readonly clock: () => Date;

  constructor(opts: MockTransportOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 0;
    this.clock = opts.clock ?? (() => new Date());
  }

  async getVoyageForecast(
    params: QueryParams,
  ): Promise<TransportResponse<RawVoyageForecastResponse>> {
    await this.delay();
    const imo = String(params.imo ?? "");
    const row = voyageForecastByImo[imo];
    const data: RawVoyageForecastResponse = row ? [row] : [];
    return { data, mock: true, fetchedAt: this.clock().toISOString() };
  }

  async getPortCalls(
    params: QueryParams,
  ): Promise<TransportResponse<RawPortCallResponse>> {
    await this.delay();
    const imo = String(params.imo ?? "");
    const rows = portCallsByImo[imo] ?? [];
    return { data: rows, mock: true, fetchedAt: this.clock().toISOString() };
  }

  private delay(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
