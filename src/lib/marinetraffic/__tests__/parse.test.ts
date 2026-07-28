/**
 * parse.test.ts — unit tests for parse.ts (IMO validation + raw→domain mapping)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Covers the three core responsibilities of parse.ts:
 *   1. IMO normalization + check-digit validation (accept valid, reject bad).
 *   2. Voyage Forecast row → Voyage mapping (field names, timestamp conversion,
 *      distance coercion, missing-field rejection).
 *   3. Port Calls → Voyage pairing (departure/arrival matching, distance source,
 *      empty-response handling).
 *
 * Run via: npx tsx src/lib/marinetraffic/__tests__/parse.test.ts
 */

import { describe, it, expect, run } from "./_testRunner";
import {
  normalizeImo,
  parseVoyageFromForecast,
  parseVoyageFromPortCalls,
} from "../parse";
import { InvalidIMOError, MalformedResponseError } from "../errors";
import type {
  RawPortCallRow,
  RawVoyageForecastRow,
} from "../types";

const SOURCE = Object.freeze({ fetchedAt: "2026-06-29T00:00:00.000Z", mock: true });

describe("normalizeImo", () => {
  it("accepts a valid 7-digit IMO with correct check digit", () => {
    expect(normalizeImo("9074729")).toBe("9074729");
  });

  it("accepts numeric input and normalizes to string", () => {
    expect(normalizeImo(9074729)).toBe("9074729");
  });

  it("strips non-digit characters", () => {
    expect(normalizeImo("IMO 9074729")).toBe("9074729");
  });

  it("rejects an IMO with too few digits", () => {
    expect(() => normalizeImo("123456")).toThrow(InvalidIMOError);
  });

  it("rejects an IMO with too many digits", () => {
    expect(() => normalizeImo("12345678")).toThrow(InvalidIMOError);
  });

  it("rejects a 7-digit value with a wrong check digit", () => {
    // 9707212 is invalid (correct check digit is 1 → 9707211).
    expect(() => normalizeImo("9707212")).toThrow(InvalidIMOError);
  });

  it("accepts the secondary fixture IMO with correct check digit", () => {
    expect(normalizeImo("9707211")).toBe("9707211");
  });
});

describe("parseVoyageFromForecast", () => {
  const baseRow: RawVoyageForecastRow = {
    SHIPNAME: "Aurelia",
    IMO: "9074729",
    LAST_PORT: "Antibes",
    LAST_PORT_ID: "37",
    LAST_PORT_TIME: "2026-06-26 07:40:00",
    NEXT_PORT_NAME: "Palma de Mallorca",
    NEXT_PORT_ID: "10",
    ETA: "2026-06-29 08:00:00",
    ETA_CALC: "2026-06-29 08:15:00",
    DISTANCE_TRAVELLED: 196,
  };

  it("maps a full forecast row to a normalized Voyage", () => {
    const voyage = parseVoyageFromForecast(baseRow, SOURCE);

    expect(voyage.vessel.name).toBe("Aurelia");
    expect(voyage.vessel.imo).toBe("9074729");
    expect(voyage.departure.port.name).toBe("Antibes");
    expect(voyage.departure.port.id).toBe(37);
    expect(voyage.arrival.port.name).toBe("Palma de Mallorca");
  });

  it("prefers ETA_CALC over ETA for arrival timestamp", () => {
    const voyage = parseVoyageFromForecast(baseRow, SOURCE);
    expect(voyage.arrival.timestamp).toBe("2026-06-29T08:15:00.000Z");
  });

  it("falls back to ETA when ETA_CALC is absent", () => {
    const voyage = parseVoyageFromForecast(
      { ...baseRow, ETA_CALC: undefined },
      SOURCE,
    );
    expect(voyage.arrival.timestamp).toBe("2026-06-29T08:00:00.000Z");
  });

  it("converts departure timestamp to ISO-8601 UTC", () => {
    const voyage = parseVoyageFromForecast(baseRow, SOURCE);
    expect(voyage.departure.timestamp).toBe("2026-06-26T07:40:00.000Z");
  });

  it("carries distance in nautical miles", () => {
    const voyage = parseVoyageFromForecast(baseRow, SOURCE);
    expect(voyage.distanceNm).toBe(196);
  });

  it("nulls distance when the upstream omits it", () => {
    const voyage = parseVoyageFromForecast(
      { ...baseRow, DISTANCE_TRAVELLED: undefined },
      SOURCE,
    );
    expect(voyage.distanceNm).toBeNull();
  });

  it("stamps provenance from the source argument", () => {
    const voyage = parseVoyageFromForecast(baseRow, SOURCE);
    expect(voyage.source.mock).toBe(true);
    expect(voyage.source.fetchedAt).toBe(SOURCE.fetchedAt);
  });

  it("throws MalformedResponseError when LAST_PORT is missing", () => {
    expect(() =>
      parseVoyageFromForecast({ ...baseRow, LAST_PORT: undefined }, SOURCE),
    ).toThrow(MalformedResponseError);
  });

  it("throws MalformedResponseError when SHIPNAME is missing", () => {
    expect(() =>
      parseVoyageFromForecast({ ...baseRow, SHIPNAME: undefined }, SOURCE),
    ).toThrow(MalformedResponseError);
  });

  it("throws InvalidIMOError when IMO has a bad check digit", () => {
    expect(() =>
      parseVoyageFromForecast({ ...baseRow, IMO: "9707212" }, SOURCE),
    ).toThrow(InvalidIMOError);
  });
});

describe("parseVoyageFromPortCalls", () => {
  it("returns null for an empty response", () => {
    expect(parseVoyageFromPortCalls([], SOURCE)).toBeNull();
  });

  it("pairs the latest departure with the matching arrival", () => {
    const rows: RawPortCallRow[] = [
      {
        SHIPNAME: "Aurelia",
        IMO: "9074729",
        PORT_NAME: "Palma de Mallorca",
        MOVE_TYPE: 0,
        TIMESTAMP: "2026-06-29 08:15:00",
        DISTANCE_FROM_PREV_PORT: 254,
      },
      {
        SHIPNAME: "Aurelia",
        IMO: "9074729",
        PORT_NAME: "Antibes",
        MOVE_TYPE: 1,
        TIMESTAMP: "2026-06-26 07:40:00",
        DISTANCE_FROM_PREV_PORT: 0,
      },
    ];

    const voyage = parseVoyageFromPortCalls(rows, SOURCE);
    expect(voyage).toBeTruthy();
    expect(voyage!.departure.port.name).toBe("Antibes");
    expect(voyage!.arrival.port.name).toBe("Palma de Mallorca");
    // Distance comes from the arrival row in extended mode.
    expect(voyage!.distanceNm).toBe(254);
  });

  it("normalizes string MOVE_TYPE values to 0/1", () => {
    const rows: RawPortCallRow[] = [
      {
        SHIPNAME: "Aurelia",
        IMO: "9074729",
        PORT_NAME: "Palma de Mallorca",
        MOVE_TYPE: "0" as unknown as 0,
        TIMESTAMP: "2026-06-29 08:15:00",
        DISTANCE_FROM_PREV_PORT: 254,
      },
      {
        SHIPNAME: "Aurelia",
        IMO: "9074729",
        PORT_NAME: "Antibes",
        MOVE_TYPE: "1" as unknown as 1,
        TIMESTAMP: "2026-06-26 07:40:00",
      },
    ];
    const voyage = parseVoyageFromPortCalls(rows, SOURCE);
    expect(voyage!.departure.port.name).toBe("Antibes");
  });
});

run();
