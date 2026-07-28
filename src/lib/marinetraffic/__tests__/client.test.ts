/**
 * client.test.ts — unit tests for the public MarineTrafficClient
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the client against the real (default) MockTransport wiring, plus a
 * custom fake transport to verify fusion logic and error handling:
 *   1. End-to-end happy path: IMO → normalized Voyage (fuses forecast + portcall).
 *   2. Provenance stamping (mock flag flows into Voyage.source).
 *   3. Invalid IMO is rejected before any transport call.
 *   4. Unknown IMO raises VesselNotFoundError.
 *   5. Port-call arrival timestamp overrides forecast ETA in the fused Voyage.
 *   6. Port-call enrichment failure degrades gracefully (forecast-only result).
 *
 * Run via: npx tsx src/lib/marinetraffic/__tests__/client.test.ts
 */

import { describe, it, expect, run } from "./_testRunner";
import { createMarineTrafficClient } from "../client";
import { InvalidIMOError, VesselNotFoundError } from "../errors";
import type { Transport, TransportResponse } from "../http";
import type {
  RawPortCallResponse,
  RawVoyageForecastResponse,
  Voyage,
} from "../types";

// A fake transport lets us feed exact raw responses to test fusion logic.
function fakeTransport(
  forecast: RawVoyageForecastResponse,
  portCalls: RawPortCallResponse = [],
  opts: { portCallsThrow?: boolean; mock?: boolean } = {},
): Transport {
  const mock = opts.mock ?? true;
  const stamp = (): string => "2026-06-29T00:00:00.000Z";
  return {
    async getVoyageForecast(): Promise<TransportResponse<RawVoyageForecastResponse>> {
      return { data: forecast, mock, fetchedAt: stamp() };
    },
    async getPortCalls(): Promise<TransportResponse<RawPortCallResponse>> {
      if (opts.portCallsThrow) throw new Error("boom");
      return { data: portCalls, mock, fetchedAt: stamp() };
    },
  };
}

describe("MarineTrafficClient — happy path (mock wiring)", () => {
  const client = createMarineTrafficClient();

  it("returns a fully populated Voyage for IMO 9074729", async () => {
    const voyage = await client.getVoyageByIMO("9074729");

    expect(voyage.vessel.name).toBe("Aurelia");
    expect(voyage.vessel.imo).toBe("9074729");
    expect(voyage.departure.port.name).toBe("Antibes");
    expect(voyage.arrival.port.name).toBe("Palma de Mallorca");
    expect(voyage.departure.timestamp).toBe("2026-06-26T07:40:00.000Z");
  });

  it("fuses the port-call arrival timestamp over the forecast ETA", async () => {
    // Forecast ETA_CALC is 08:15; port-call arrival timestamp is also 08:15 in the
    // fixture, so the fused value is the verified port-call one.
    const voyage = await client.getVoyageByIMO("9074729");
    expect(voyage.arrival.timestamp).toBe("2026-06-29T08:15:00.000Z");
  });

  it("stamps the fused Voyage with mock provenance", async () => {
    const voyage = await client.getVoyageByIMO("9074729");
    expect(voyage.source.mock).toBe(true);
  });

  it("carries the per-leg distance from the port-call arrival row", async () => {
    const voyage = await client.getVoyageByIMO("9074729");
    expect(voyage.distanceNm).toBe(254);
  });
});

describe("MarineTrafficClient — input validation", () => {
  const client = createMarineTrafficClient();

  it("rejects an invalid IMO before any transport call", async () => {
    await expect(async () => client.getVoyageByIMO("not-an-imo")).toThrow(
      InvalidIMOError,
    );
  });

  it("rejects a valid-format IMO with a bad check digit", async () => {
    await expect(async () => client.getVoyageByIMO("9707212")).toThrow(
      InvalidIMOError,
    );
  });
});

describe("MarineTrafficClient — error & degradation paths", () => {
  it("throws VesselNotFoundError when the forecast returns no rows", async () => {
    const client = createMarineTrafficClient({
      transport: fakeTransport([]),
    });
    await expect(async () => client.getVoyageByIMO("9074729")).toThrow(
      VesselNotFoundError,
    );
  });

  it("degrades gracefully when port-call enrichment fails", async () => {
    const forecast = [
      {
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
      },
    ];
    const client = createMarineTrafficClient({
      transport: fakeTransport(forecast, [], { portCallsThrow: true }),
    });

    const voyage = await client.getVoyageByIMO("9074729");
    // Forecast-only result still fully usable.
    expect(voyage.arrival.port.name).toBe("Palma de Mallorca");
    expect(voyage.arrival.timestamp).toBe("2026-06-29T08:15:00.000Z");
  });

  it("fuses a port-call arrival timestamp over the forecast ETA", async () => {
    const forecast = [
      {
        SHIPNAME: "Test",
        IMO: "9074729",
        LAST_PORT: "Antibes",
        LAST_PORT_ID: "37",
        LAST_PORT_TIME: "2026-06-26 07:40:00",
        NEXT_PORT_NAME: "Palma de Mallorca",
        NEXT_PORT_ID: "10",
        ETA: "2026-06-29 08:00:00", // forecast says 08:00
        DISTANCE_TRAVELLED: 100,
      },
    ];
    const portCalls: RawPortCallResponse = [
      {
        SHIPNAME: "Test",
        IMO: "9074729",
        PORT_NAME: "Palma de Mallorca",
        MOVE_TYPE: 0 as const,
        TIMESTAMP: "2026-06-29 09:30:00", // verified port-call says 09:30
        DISTANCE_FROM_PREV_PORT: 254,
      },
      {
        SHIPNAME: "Test",
        IMO: "9074729",
        PORT_NAME: "Antibes",
        MOVE_TYPE: 1 as const,
        TIMESTAMP: "2026-06-26 07:40:00",
      },
    ];

    const client = createMarineTrafficClient({
      transport: fakeTransport(forecast, portCalls),
    });
    const voyage: Voyage = await client.getVoyageByIMO("9074729");
    expect(voyage.arrival.timestamp).toBe("2026-06-29T09:30:00.000Z");
  });
});

run();
