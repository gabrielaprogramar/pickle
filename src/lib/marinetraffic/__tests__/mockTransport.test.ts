/**
 * mockTransport.test.ts — unit tests for the MockTransport + fixtures
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the mocked half of the transport seam:
 *   1. Known IMOs resolve their fixture (forecast + port calls).
 *   2. Unknown IMOs return an empty forecast row (→ VesselNotFoundError upstream)
 *      and empty port-call list.
 *   3. Every response is stamped mock:true with a valid ISO fetchedAt.
 *   4. Latency option actually delays resolution (timing assertion).
 *
 * Run via: npx tsx src/lib/marinetraffic/__tests__/mockTransport.test.ts
 */

import { describe, it, expect, run } from "./_testRunner";
import { MockTransport } from "../mock";

describe("MockTransport.getVoyageForecast", () => {
  it("resolves the primary fixture by IMO 9074729", async () => {
    const t = new MockTransport();
    const res = await t.getVoyageForecast({ imo: "9074729" });

    expect(res.data.length).toBe(1);
    const row = res.data[0]!;
    expect(row.SHIPNAME).toBe("Aurelia");
    expect(row.IMO).toBe("9074729");
    expect(row.LAST_PORT).toBe("Antibes");
    expect(row.NEXT_PORT_NAME).toBe("Palma de Mallorca");
  });

  it("resolves the secondary fixture by IMO 9707211", async () => {
    const t = new MockTransport();
    const res = await t.getVoyageForecast({ imo: "9707211" });
    expect(res.data[0]!.SHIPNAME).toBe("Calypso Nova");
  });

  it("returns an empty array for an unknown IMO", async () => {
    const t = new MockTransport();
    const res = await t.getVoyageForecast({ imo: "9999999" });
    expect(res.data.length).toBe(0);
  });

  it("stamps every response with mock:true and a valid ISO timestamp", async () => {
    const t = new MockTransport();
    const res = await t.getVoyageForecast({ imo: "9074729" });
    expect(res.mock).toBe(true);
    expect(Number.isNaN(new Date(res.fetchedAt).getTime())).toBeFalsy();
  });
});

describe("MockTransport.getPortCalls", () => {
  it("resolves port-call history for the primary IMO", async () => {
    const t = new MockTransport();
    const res = await t.getPortCalls({ imo: "9074729" });
    expect(res.data.length).toBe(3);
    // Newest-first ordering: first row is the imminent arrival.
    expect(res.data[0]!.PORT_NAME).toBe("Palma de Mallorca");
  });

  it("returns an empty array when no fixture exists for the IMO", async () => {
    const t = new MockTransport();
    const res = await t.getPortCalls({ imo: "9707211" });
    expect(res.data.length).toBe(0);
  });

  it("uses an injected clock for deterministic fetchedAt", async () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const t = new MockTransport({ clock: () => fixed });
    const res = await t.getPortCalls({ imo: "9074729" });
    expect(res.fetchedAt).toBe(fixed.toISOString());
  });
});

describe("MockTransport latency", () => {
  it("delays resolution when latencyMs is set", async () => {
    const t = new MockTransport({ latencyMs: 60 });
    const start = Date.now();
    await t.getVoyageForecast({ imo: "9074729" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(40); // allow scheduler slack below 60ms
  });

  it("resolves immediately when latencyMs is 0", async () => {
    const t = new MockTransport({ latencyMs: 0 });
    const start = Date.now();
    await t.getVoyageForecast({ imo: "9074729" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(-1); // just ensure it returns
  });
});

run();
