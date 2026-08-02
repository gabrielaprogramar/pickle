/**
 * mock-data.test.ts — noon-assistant mock scenario tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Verifies that each deterministic scenario fixture produces the expected
 * snapshot: engine values, validator posture, and findings.
 *
 * Run via: npx tsx src/lib/noon-assistant/__tests__/mock-data.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  createMockNoonState,
  NOON_MOCK_NOW,
  NOON_MOCK_VESSELS,
  POSEIDON,
  scenarioLabel,
  noonDestinationLabel,
} from "../mock-data";

describe("mock-data — vessel fixtures", () => {
  it("lists three vessels with POSEIDON first", () => {
    expect(NOON_MOCK_VESSELS.length).toBe(3);
    expect(POSEIDON.name).toBe("POSEIDON PIONEER");
    expect(POSEIDON.imo).toBe("9488754");
    expect(NOON_MOCK_VESSELS[1]!.name).toBe("Serenity");
    expect(NOON_MOCK_VESSELS[2]!.name).toBe("Marguerite");
  });

  it("exposes the fixed now and scenario labels", () => {
    expect(NOON_MOCK_NOW).toBe("2026-08-01T13:00:00.000Z");
    expect(scenarioLabel("clean-at-sea")).toBe("clean at sea");
    expect(scenarioLabel("in-port")).toBe("in port");
    expect(scenarioLabel("low-confidence")).toBe("low data confidence");
    expect(noonDestinationLabel()).toBe("ROTTERDAM");
  });
});

describe("mock-data — clean-at-sea", () => {
  const state = createMockNoonState("clean-at-sea");

  it("builds a two-report history newest first", () => {
    expect(state.vessel.vesselId).toBe(POSEIDON.vesselId);
    expect(state.reports.length).toBe(2);
    expect(state.reports[0]!.reportDate).toBe("2026-08-01T12:00:00.000Z");
    expect(state.reports[1]!.reportDate).toBe("2026-07-31T12:00:00.000Z");
  });

  it("snapshot carries the deterministic engine values", () => {
    const snap = state.latest!;
    expect(snap.analysis.operationalState).toBe("AT_SEA");
    expect(snap.analysis.consumption.rateTonnesPerDay).toBe(32.4);
    expect(snap.analysis.slip.slipPct).toBe(4.887);
    expect(snap.voyage.state).toBe("ON_SCHEDULE");
    expect(snap.fuel.robState).toBe("CONSISTENT");
    expect(snap.fuel.attributionResolved).toBe(false);
    expect(snap.fueleu.dataAvailable).toBe(false);
    expect(snap.ets.dataAvailable).toBe(false);
  });

  it("validator reports WARNING at score 95 with exactly three findings", () => {
    const snap = state.latest!;
    expect(snap.validator.status).toBe("WARNING");
    expect(snap.validator.score).toBe(95);
    expect(snap.validator.blocked).toBe(false);
    expect(snap.findings.map((f) => f.id).sort()).toEqual([
      "maritime.port_not_empty",
      "noon.ets.unattributed_consumption",
      "noon.fueleu.unattributed_consumption",
    ]);
  });
});

describe("mock-data — scenario variants", () => {
  it("heavy-weather adds the significant weather finding", () => {
    const snap = createMockNoonState("heavy-weather").latest!;
    expect(snap.validator.score).toBe(90);
    expect(snap.findings.some((f) => f.id === "noon.weather.significant")).toBe(true);
  });

  it("high-consumption flags consumption, rpm, slip and ROB inconsistency", () => {
    const snap = createMockNoonState("high-consumption").latest!;
    expect(snap.analysis.consumption.rateTonnesPerDay).toBe(46.2);
    expect(snap.fuel.robState).toBe("INCONSISTENT");
    const ids = snap.findings.map((f) => f.id);
    expect(ids).toContain("noon.deviation.consumption");
    expect(ids).toContain("noon.deviation.rpm");
    expect(ids).toContain("noon.deviation.slip");
    expect(ids).toContain("noon.fuel.rob_inconsistency");
  });

  it("behind-schedule flags speed and rpm deviations", () => {
    const snap = createMockNoonState("behind-schedule").latest!;
    const ids = snap.findings.map((f) => f.id);
    expect(ids).toContain("noon.deviation.speed");
    expect(ids).toContain("noon.deviation.rpm");
    expect(snap.analysis.slip.slipPct).toBe(-5.4);
  });

  it("low-confidence carries a low confidence score and data-quality findings", () => {
    const snap = createMockNoonState("low-confidence").latest!;
    expect(snap.report.confidence).toBe(0.42);
    expect(snap.validator.score).toBe(65);
    const ids = snap.findings.map((f) => f.id);
    expect(ids).toContain("noon.data_quality.low_confidence");
    expect(ids).toContain("confidence.ai_high");
  });

  it("in-port resolves IN_PORT with null slip and an AHEAD posture", () => {
    const snap = createMockNoonState("in-port").latest!;
    expect(snap.analysis.operationalState).toBe("IN_PORT");
    expect(snap.analysis.port!.inPort).toBe(true);
    expect(snap.analysis.slip.slipPct).toBeNull();
    expect(snap.voyage.state).toBe("AHEAD");
    const ids = snap.findings.map((f) => f.id);
    expect(ids).toContain("noon.deviation.speed");
  });
});

run();
