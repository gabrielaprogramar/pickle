/**
 * tools.test.ts — noon-assistant tool registry tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the deterministic tool registry over the noon snapshot, vessel
 * scope enforcement, and input validation.
 *
 * Run via: npx tsx src/lib/noon-assistant/__tests__/tools.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  createNoonToolRegistry,
  assertNoonScope,
  validateNoonToolInput,
  NoonVesselScopeError,
  NOON_TOOL_NAMES,
  NOON_TOOL_DEFINITIONS,
  TOOL_GET_NOON_LATEST,
  TOOL_GET_NOON_HISTORY,
  TOOL_GET_NOON_ANALYSIS,
  TOOL_GET_NOON_FINDINGS,
  TOOL_GET_NOON_FUEL,
  TOOL_GET_NOON_VOYAGE,
  TOOL_GET_NOON_FUELEU,
  TOOL_GET_NOON_ETS,
  TOOL_GET_NOON_OPERATIONAL_STATE,
  TOOL_GET_NOON_DEVIATIONS,
} from "../tools";
import { createMockNoonState, POSEIDON, NOON_MOCK_VESSELS } from "../mock-data";
import { makeContext } from "./_factory";

function ctxWith(context: ReturnType<typeof makeContext> = makeContext()) {
  const state = createMockNoonState("clean-at-sea");
  return { registry: createNoonToolRegistry(), context, state };
}

describe("Noon tool registry — data access", () => {
  it("returns the latest snapshot with its tool name", () => {
    const { registry, context, state } = ctxWith();
    const result = registry.getLatest({ context, state });
    expect(result.tool).toBe(TOOL_GET_NOON_LATEST);
    expect(result.vessel.vesselId).toBe(POSEIDON.vesselId);
    expect(result.data!.report.reportDate).toBe("2026-08-01T12:00:00.000Z");
    expect(result.data!.analysis.operationalState).toBe("AT_SEA");
  });

  it("returns analysis, fuel, voyage, fueleu, ets data", () => {
    const { registry, context, state } = ctxWith();
    expect(registry.getAnalysis({ context, state }).data!.consumption.rateTonnesPerDay).toBe(32.4);
    expect(registry.getFuel({ context, state }).data!.robState).toBe("CONSISTENT");
    expect(registry.getVoyage({ context, state }).data!.state).toBe("ON_SCHEDULE");
    expect(registry.getFuelEu({ context, state }).data!.dataAvailable).toBe(false);
    expect(registry.getEts({ context, state }).data!.dataAvailable).toBe(false);
  });

  it("returns findings, operational state, deviations and history", () => {
    const { registry, context, state } = ctxWith();
    expect(registry.getFindings({ context, state }).data.length).toBe(3);
    expect(registry.getOperationalState({ context, state }).data).toBe("AT_SEA");
    expect(registry.getDeviations({ context, state }).data).toEqual([]);
    expect(registry.getHistory({ context, state }).data.length).toBe(2);
  });
});

describe("Noon tool registry — vessel scope", () => {
  it("throws NoonVesselScopeError for a mismatched context vessel", () => {
    const { registry, state } = ctxWith();
    const other = makeContext({ vessel: NOON_MOCK_VESSELS[2]! });
    let thrown: unknown = null;
    try {
      registry.getLatest({ context: other, state });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeTruthy();
    expect(thrown instanceof NoonVesselScopeError).toBe(true);
    expect((thrown as Error).message).toContainString("Vessel scope mismatch");
  });

  it("assertNoonScope passes for the assigned vessel", () => {
    const { context, state } = ctxWith();
    let error: unknown = null;
    try {
      assertNoonScope({ context, state });
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
  });
});

describe("Noon tool input validation", () => {
  it("rejects unknown tools", () => {
    const result = validateNoonToolInput("get_noon_bogus", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Unknown tool: get_noon_bogus");
  });

  it("accepts known tools with an empty input object", () => {
    const result = validateNoonToolInput(TOOL_GET_NOON_LATEST, {});
    expect(result.ok).toBe(true);
  });

  it("rejects extra keys on strict tool schemas", () => {
    const result = validateNoonToolInput(TOOL_GET_NOON_LATEST, { extra: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContainString("Invalid input");
  });
});

describe("Noon tool definitions", () => {
  it("declares one definition per tool, all read-only", () => {
    expect(NOON_TOOL_NAMES.length).toBe(10);
    expect(NOON_TOOL_DEFINITIONS.length).toBe(10);
    expect(NOON_TOOL_DEFINITIONS.every((d) => d.permission === "read")).toBe(true);
    expect(NOON_TOOL_DEFINITIONS.every((d) => !d.requiresConfirmation)).toBe(true);
  });

  it("covers the expected tool names", () => {
    const names = NOON_TOOL_DEFINITIONS.map((d) => d.name);
    for (const name of [
      TOOL_GET_NOON_LATEST,
      TOOL_GET_NOON_HISTORY,
      TOOL_GET_NOON_ANALYSIS,
      TOOL_GET_NOON_FINDINGS,
      TOOL_GET_NOON_FUEL,
      TOOL_GET_NOON_VOYAGE,
      TOOL_GET_NOON_FUELEU,
      TOOL_GET_NOON_ETS,
      TOOL_GET_NOON_OPERATIONAL_STATE,
      TOOL_GET_NOON_DEVIATIONS,
    ]) {
      expect(names).toContain(name);
    }
  });
});

run();
