/**
 * types.ts — MarineTraffic wire-format + Poseidon domain types
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Two distinct type layers live here on purpose, and never bleed into each other:
 *
 *   1. "Raw" types (RawVoyageForecastRow, RawPortCallRow, ...) mirror the exact
 *      field names MarineTraffic returns when called with `protocol=jsono`.
 *      These are the ONLY place in the codebase that knows MT's field spelling.
 *
 *   2. "Domain" types (Vessel, Voyage, PortEvent, ...) are Poseidon's clean,
 *      stable internal model. The rest of the app (and future phases) talks to
 *      these, never to the raw API shape.
 *
 * The translation between the two happens in parse.ts. If MarineTraffic ever
 * renames a field, only parse.ts changes — nothing downstream breaks.
 *
 * HOW IT FITS
 * This is the shared vocabulary for the whole module. config/errors/http/mock
 * are generic; parse/client import these types to stay consistent.
 *
 * NOTE ON RAW FIELD NAMES
 * The raw field names below are taken from the official MarineTraffic service
 * docs (jsono protocol). The `extended` portcalls distance field naming will be
 * confirmed against a live response when the API key is purchased; until then
 * parse.ts treats every raw field as optional and degrades gracefully.
 */

// ── 1. RAW WIRE FORMAT (mirrors MarineTraffic jsono responses) ────────────────

/**
 * One row of the Single Vessel Voyage Forecast response.
 * Field names match MarineTraffic's documented jsono output exactly.
 * Every field is optional: the API may omit fields per vessel/service tier.
 */
export interface RawVoyageForecastRow {
  readonly SHIPNAME?: string;
  readonly IMO?: string | number;
  readonly MMSI?: string | number;
  readonly SHIP_ID?: string | number;
  readonly LAST_PORT?: string;
  readonly LAST_PORT_ID?: string | number;
  readonly LAST_PORT_TIME?: string; // "YYYY-MM-DD HH:MM:SS" (UTC) per MT
  readonly NEXT_PORT_NAME?: string;
  readonly NEXT_PORT_ID?: string | number;
  readonly ETA?: string; // Estimated time of arrival (UTC)
  readonly ETA_CALC?: string; // Computed ETA (UTC)
  readonly DESTINATION?: string;
  readonly DISTANCE_TRAVELLED?: number; // NM since last port
  readonly DISTANCE_TO_GO?: number; // NM remaining to next port
  readonly SPEED?: number; // knots
  readonly STATUS?: number;
  readonly TIMESTAMP?: string;
}

/**
 * One row of the Single Vessel Port Calls response (msgtype=extended).
 * MOVE_TYPE: 0 = arrival, 1 = departure (per MarineTraffic docs).
 */
export interface RawPortCallRow {
  readonly SHIPNAME?: string;
  readonly IMO?: string | number;
  readonly MMSI?: string | number;
  readonly PORT_NAME?: string;
  readonly PORT_ID?: string | number;
  readonly MOVE_TYPE?: 0 | 1 | "0" | "1"; // 0 arrival, 1 departure
  readonly TIMESTAMP?: string; // event time (UTC)
  readonly DISTANCE_FROM_PREV_PORT?: number; // NM (extended mode — verify on live data)
  readonly TYPE_NAME?: string;
}

// Raw responses are arrays of rows under the jsono protocol.
export type RawVoyageForecastResponse = readonly RawVoyageForecastRow[];
export type RawPortCallResponse = readonly RawPortCallRow[];

// ── 2. POSEIDON DOMAIN MODEL (stable, API-agnostic) ───────────────────────────

/** A vessel identifier pair. IMO is the canonical key (7-digit, checksummed). */
export interface Vessel {
  readonly name: string;
  readonly imo: string;
}

/** A MarineTraffic port reference. id is null when only a name is available. */
export interface Port {
  readonly name: string;
  readonly id: number | null;
}

/**
 * A port event — a departure or an arrival.
 * timestamp is ISO-8601 UTC (e.g. "2026-06-29T08:15:00.000Z") or null when the
 * API has no value for it (e.g. ETA unknown for a vessel still in transit).
 */
export interface PortEvent {
  readonly port: Port;
  readonly timestamp: string | null;
}

/**
 * The normalized voyage Poseidon stores. This single object carries every field
 * Phase 1 needs: name, IMO, departure port, arrival port, both timestamps, and
 * voyage distance. It is what client.ts returns and what Supabase will persist.
 */
export interface Voyage {
  readonly vessel: Vessel;
  readonly departure: PortEvent;
  readonly arrival: PortEvent;
  /** Voyage distance in nautical miles, or null if the API returned none. */
  readonly distanceNm: number | null;
  /** Provenance — lets callers tell mocked data from live data. */
  readonly source: VoyageSource;
}

export interface VoyageSource {
  /** ISO timestamp of when this voyage was assembled. */
  readonly fetchedAt: string;
  /** True when the data came from the mock transport (not a live API call). */
  readonly mock: boolean;
}
