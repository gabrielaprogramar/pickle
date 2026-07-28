/**
 * parse.ts — translation from MarineTraffic raw fields to Poseidon domain types
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * This is the ONLY module that knows MarineTraffic's field spelling. It maps
 * raw rows (SHIPNAME, IMO, LAST_PORT, LAST_PORT_TIME, ETA, MOVE_TYPE,
 * DISTANCE_*) onto Poseidon's stable domain model (Vessel, Voyage, PortEvent).
 *
 * Encapsulating the mapping here means:
 *   - The domain model and the rest of the app never import raw types.
 *   - If MarineTraffic renames a field, exactly ONE file changes.
 *   - Validation (IMO checksum, timestamp parsing) lives next to the data it
 *     guards, so malformed upstream data is rejected before it enters the model.
 *
 * HOW IT FITS
 * client.ts calls the transport, hands the raw response to parse.ts, and
 * returns the resulting domain Voyage. parse.ts throws InvalidIMOError /
 * MalformedResponseError for bad inputs; client.ts surfaces those to callers.
 */

import {
  InvalidIMOError,
  MalformedResponseError,
} from "./errors";
import type {
  Port,
  PortEvent,
  RawPortCallResponse,
  RawPortCallRow,
  RawVoyageForecastRow,
  Vessel,
  Voyage,
  VoyageSource,
} from "./types";

// ── 1. IMO VALIDATION ─────────────────────────────────────────────────────────

/**
 * Normalizes an IMO to a 7-digit string AND validates its check digit.
 *
 * IMO check-sum (IMO/SN.1/Circ.229): for digits d7 d6 d5 d4 d3 d2 d1 (d1 = check
 * digit), sum(d_i * (8 - i)) for i in 1..6 must end in d1. We reject anything
 * that isn't a valid 7-digit IMO. This guards the app against typos at the
 * boundary, before any network call.
 */
export function normalizeImo(input: string | number): string {
  const digits = String(input).replace(/\D/g, "");
  if (digits.length !== 7) {
    throw new InvalidIMOError(`IMO must be 7 digits, got "${input}".`);
  }
  // Validate check digit: digits[0..5] weighted 7..2, last digit = units.
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += Number.parseInt(digits[i]!, 10) * (7 - i);
  }
  const check = sum % 10;
  const given = Number.parseInt(digits[6]!, 10);
  if (check !== given) {
    throw new InvalidIMOError(`IMO "${digits}" failed checksum verification.`);
  }
  return digits;
}

// ── 2. FIELD COERCION HELPERS ─────────────────────────────────────────────────

/** MarineTraffic timestamps are "YYYY-MM-DD HH:MM:SS" UTC; convert to ISO. */
function toIsoTimestamp(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  // MT uses a space between date and time; ISO needs 'T' + 'Z' (it's UTC).
  const normalized = raw.trim().replace(" ", "T") + "Z";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new MalformedResponseError(`Unparseable timestamp from upstream: "${raw}".`);
  }
  return parsed.toISOString();
}

/** Coerce a numeric-ish field to a number, or null if absent/garbage. */
function toNumber(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** First non-empty string from a list of candidate raw fields. */
function firstString(...values: Array<string | undefined>): string | null {
  for (const v of values) {
    if (v !== undefined && v.trim() !== "") return v.trim();
  }
  return null;
}

function toPort(name: string | undefined, id: string | number | undefined): Port | null {
  const portName = firstString(name);
  if (!portName) return null;
  return { name: portName, id: toNumber(id) };
}

function toVessel(row: Pick<RawVoyageForecastRow, "SHIPNAME" | "IMO">): Vessel {
  const name = firstString(row.SHIPNAME);
  if (!name) {
    throw new MalformedResponseError("Vessel response is missing SHIPNAME.");
  }
  const imo = row.IMO !== undefined ? normalizeImo(row.IMO) : null;
  if (!imo) {
    throw new MalformedResponseError("Vessel response is missing IMO.");
  }
  return { name, imo };
}

// ── 3. RAW → DOMAIN MAPPING ───────────────────────────────────────────────────

/**
 * Assemble a single Voyage from a Voyage Forecast row.
 *
 * This is the "live leg" view: the vessel's current departure (LAST_PORT +
 * LAST_PORT_TIME) and its pending arrival (NEXT_PORT_NAME + ETA/ETA_CALC).
 * Distance is DISTANCE_TRAVELLED (NM since last port) — the most complete
 * per-leg figure available when a voyage is in progress.
 */
export function parseVoyageFromForecast(
  row: RawVoyageForecastRow,
  source: VoyageSource,
): Voyage {
  const vessel = toVessel(row);

  const departurePort = toPort(row.LAST_PORT, row.LAST_PORT_ID);
  if (!departurePort) {
    throw new MalformedResponseError(
      "Voyage Forecast row is missing LAST_PORT — cannot build departure event.",
    );
  }
  const arrivalPort = toPort(row.NEXT_PORT_NAME, row.NEXT_PORT_ID);
  if (!arrivalPort) {
    throw new MalformedResponseError(
      "Voyage Forecast row is missing NEXT_PORT_NAME — cannot build arrival event.",
    );
  }

  return {
    vessel,
    departure: {
      port: departurePort,
      timestamp: toIsoTimestamp(row.LAST_PORT_TIME),
    },
    arrival: {
      port: arrivalPort,
      // Prefer ETA_CALC (computed) when present, fall back to declared ETA.
      timestamp: toIsoTimestamp(row.ETA_CALC ?? row.ETA),
    },
    // Prefer DISTANCE_TRAVELLED (actual so far); null if the API omitted it.
    distanceNm: toNumber(row.DISTANCE_TRAVELLED),
    source,
  };
}

/**
 * Pull the most recent departure→arrival pair out of a Port Calls response.
 *
 * Strategy: take the latest departure (MOVE_TYPE 1) and the matching arrival
 * (MOVE_TYPE 0) at the NEXT port. This complements the forecast when historical
 * legs are needed and is the canonical source for completed-voyage distance
 * (DISTANCE_FROM_PREV_PORT on the arrival row).
 *
 * Returns null when there is not enough data to build a complete Voyage — the
 * caller (client.ts) treats this as "use forecast only".
 */
export function parseVoyageFromPortCalls(
  rows: RawPortCallResponse,
  source: VoyageSource,
): Voyage | null {
  if (rows.length === 0) return null;

  const vessel = pickVesselFromPortCalls(rows);
  if (!vessel) return null;

  // Most-recent departure (MOVE_TYPE === 1). MT returns newest-first.
  const departureRow = rows.find((r) => moveType(r) === 1);
  if (!departureRow) return null;

  // Matching arrival: the next MOVE_TYPE 0 event chronologically after the
  // departure. In MT's newest-first ordering, search for an arrival whose
  // timestamp is at-or-after the departure time.
  const departureTime = toIsoTimestamp(departureRow.TIMESTAMP);
  const arrivalRow = rows.find((r) => {
    if (moveType(r) !== 0) return false;
    const t = toIsoTimestamp(r.TIMESTAMP);
    // Allow null timestamps (scheduled ETA) to match as the pending arrival.
    if (t === null || departureTime === null) return true;
    return t >= departureTime;
  });

  const departurePort = toPort(departureRow.PORT_NAME, departureRow.PORT_ID);
  if (!departurePort) return null;

  // Arrival may be unknown if the vessel hasn't arrived yet — still build the
  // voyage with a null arrival timestamp where possible, else bail.
  const arrivalPort = arrivalRow
    ? toPort(arrivalRow.PORT_NAME, arrivalRow.PORT_ID)
    : null;
  if (!arrivalPort) return null;

  return {
    vessel,
    departure: {
      port: departurePort,
      timestamp: departureTime,
    },
    arrival: {
      port: arrivalPort,
      timestamp: arrivalRow ? toIsoTimestamp(arrivalRow.TIMESTAMP) : null,
    },
    // Per-leg distance lives on the arrival row in extended mode.
    distanceNm: arrivalRow ? toNumber(arrivalRow.DISTANCE_FROM_PREV_PORT) : null,
    source,
  };
}

/** MOVE_TYPE comes through as number or string; normalize to 0 | 1. */
function moveType(row: RawPortCallRow): 0 | 1 {
  const v = row.MOVE_TYPE;
  if (v === undefined) return 0;
  return Number(v) === 1 ? 1 : 0;
}

function pickVesselFromPortCalls(rows: RawPortCallResponse): Vessel | null {
  const row = rows.find((r) => r.IMO !== undefined || r.SHIPNAME !== undefined);
  if (!row) return null;
  try {
    return toVessel(row);
  } catch {
    return null;
  }
}
