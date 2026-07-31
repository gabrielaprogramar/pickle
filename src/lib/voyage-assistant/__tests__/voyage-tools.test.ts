import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  createVoyageToolRegistry,
  VoyageVesselScopeError,
  validateVoyageToolInput,
  VOYAGE_TOOL_DEFINITIONS,
  VOYAGE_TOOL_NAMES,
  TOOL_GET_VOYAGE_LOG,
  TOOL_GET_AIS_POSITIONS,
  TOOL_GET_DATA_GAPS,
  TOOL_GET_PORT_INFO,
  TOOL_EXPLAIN_VIOLATION,
  TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT,
  TOOL_DRAFT_MANUAL_VOYAGE,
  TOOL_QUEUE_AIS_SYNC,
} from "../voyage-tools";
import { createMockVoyageState } from "../mock-data";
import { makeContext, otherVesselContext } from "./_factory";

describe("Voyage Assistant — tool registry and scope", () => {
  const registry = createVoyageToolRegistry();
  const state = createMockVoyageState("clean-voyage");

  it("scopes all tools to the assigned vessel", () => {
    const context = makeContext();
    const log = registry.getVoyageLog({ context, state });
    const positions = registry.getAisPositions({ context, state });
    const gaps = registry.getDataGaps({ context, state });
    const ports = registry.getPortInfo({ context, state });
    const violations = registry.explainViolation({ context, state });
    const ctx = registry.getComplianceContext({ context, state });
    const draft = registry.draftManualVoyage({ context, state }, { voyageId: "voy-clean" });
    const sync = registry.queueAisSync({ context, state }, { voyageId: "voy-clean" });

    expect(log.vessel.name).toBe("Aurelia");
    expect(positions.vessel.imo).toBe("9074729");
    expect(gaps.vessel.vesselId).toBe("vsl-aurelia");
    expect(ports.vessel.name).toBe("Aurelia");
    expect(violations.vessel.name).toBe("Aurelia");
    expect(ctx.vessel.name).toBe("Aurelia");
    expect(draft.vessel.name).toBe("Aurelia");
    expect(sync.vessel.name).toBe("Aurelia");
  });

  it("throws VoyageVesselScopeError for another vessel's context", () => {
    const foreign = otherVesselContext();
    let threw = false;
    let isScopeError = false;
    try {
      registry.getVoyageLog({ context: foreign, state });
    } catch (err) {
      threw = true;
      isScopeError = err instanceof VoyageVesselScopeError;
    }
    expect(threw).toBe(true);
    expect(isScopeError).toBe(true);
  });

  it("finds a voyage by voyageId and voyageNumber", () => {
    const context = makeContext();
    const byId = registry.getVoyageLog({ context, state }, { voyageId: "voy-clean" });
    expect(byId.data.length).toBe(1);
    expect(byId.data[0]!.voyageNumber).toBe("V-2026-011");

    const byNumber = registry.getVoyageLog({ context, state }, { voyageNumber: "V-2026-011" });
    expect(byNumber.data.length).toBe(1);
  });

  it("filters AIS positions by voyage", () => {
    const context = makeContext();
    const all = registry.getAisPositions({ context, state });
    const clean = registry.getAisPositions({ context, state }, { voyageId: "voy-clean" });
    expect(all.data.length).toBeGreaterThan(clean.data.length);
    expect(clean.data.every((p) => p.voyageId === "voy-clean")).toBe(true);
  });

  it("filters gaps by tier", () => {
    const context = makeContext();
    const flagged = registry.getDataGaps(
      { context, state: createMockVoyageState("gap-30m-to-6h") },
      { tier: "FLAGGED" },
    );
    expect(flagged.data.length).toBe(1);
    expect(flagged.data[0]!.tier).toBe("FLAGGED");
  });

  it("filters port info to green zone ports", () => {
    const context = makeContext();
    const green = registry.getPortInfo({ context, state }, { greenZoneOnly: true });
    expect(green.data.length).toBeGreaterThan(0);
    expect(green.data.every((p) => p.greenZone)).toBe(true);
  });

  it("returns stored ETS coverage and classification, not computed ones", () => {
    const context = makeContext();
    const ctx = registry.getComplianceContext({
      context,
      state: createMockVoyageState("eu-to-third-country"),
    });
    expect(ctx.data && ctx.data.etsCoverageRate).toBe(50);
    expect(ctx.data && ctx.data.classification).toBe("EU_TO_THIRD_COUNTRY");
  });

  it("refuses a manual voyage draft below the MANUAL_REQUIRED tier", () => {
    const context = makeContext();
    const clean = registry.draftManualVoyage(
      { context, state: createMockVoyageState("clean-voyage") },
      { voyageId: "voy-clean" },
    );
    expect(clean.data).toBeNull();

    const flagged = registry.draftManualVoyage(
      { context, state: createMockVoyageState("gap-30m-to-6h") },
      { voyageId: "voy-flagged" },
    );
    expect(flagged.data).toBeNull();
  });

  it("creates a DRAFT manual voyage on the 6h-48h tier without confirmation", () => {
    const context = makeContext();
    const state = createMockVoyageState("gap-6h-to-48h");
    const draft = registry.draftManualVoyage({ context, state }, { voyageId: "voy-manual" });
    expect(draft.data && draft.data.status).toBe("DRAFT");
  });

  it("confirms a manual voyage draft when confirm is true", () => {
    const context = makeContext();
    const state = createMockVoyageState("gap-6h-to-48h");
    const draft = registry.draftManualVoyage(
      { context, state },
      { voyageId: "voy-manual", confirm: true },
    );
    expect(draft.data && draft.data.status).toBe("CONFIRMED");
  });

  it("refuses an AIS sync below the FLAGGED tier", () => {
    const context = makeContext();
    const sync = registry.queueAisSync(
      { context, state: createMockVoyageState("clean-voyage") },
      { voyageId: "voy-clean" },
    );
    expect(sync.data).toBeNull();
  });

  it("queues a DRAFT AIS sync on the FLAGGED tier and confirms on request", () => {
    const context = makeContext();
    const state = createMockVoyageState("gap-30m-to-6h");
    const draft = registry.queueAisSync({ context, state }, { voyageId: "voy-flagged" });
    expect(draft.data && draft.data.status).toBe("DRAFT");
    const confirmed = registry.queueAisSync(
      { context, state },
      { voyageId: "voy-flagged", confirm: true },
    );
    expect(confirmed.data && confirmed.data.status).toBe("CONFIRMED");
  });

  it("validates tool inputs with Zod and rejects malformed input", () => {
    const good = validateVoyageToolInput(TOOL_GET_DATA_GAPS, { tier: "FLAGGED" });
    expect(good.ok).toBe(true);
    const bad = validateVoyageToolInput(TOOL_GET_DATA_GAPS, { tier: "NOT_A_TIER" });
    expect(bad.ok).toBe(false);
    if (bad.ok === false) {
      expect(bad.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown tool names", () => {
    const result = validateVoyageToolInput("not_a_tool", {});
    expect(result.ok).toBe(false);
  });

  it("exposes gateway-compatible tool definitions with write tools confirmation-gated", () => {
    expect(VOYAGE_TOOL_DEFINITIONS.length).toBe(8);
    for (const def of VOYAGE_TOOL_DEFINITIONS) {
      expect(def.inputSchema).toBeTruthy();
      expect(def.outputSchema).toBeTruthy();
    }
    const writeTools = VOYAGE_TOOL_DEFINITIONS.filter((d) => d.permission === "write");
    expect(writeTools.length).toBe(2);
    expect(writeTools.every((d) => d.requiresConfirmation === true)).toBe(true);
    const readTools = VOYAGE_TOOL_DEFINITIONS.filter((d) => d.permission === "read");
    expect(readTools.every((d) => d.requiresConfirmation === false)).toBe(true);
    for (const name of VOYAGE_TOOL_NAMES) {
      expect(VOYAGE_TOOL_DEFINITIONS.some((d) => d.name === name)).toBe(true);
    }
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_GET_VOYAGE_LOG)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_GET_AIS_POSITIONS)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_GET_DATA_GAPS)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_GET_PORT_INFO)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_EXPLAIN_VIOLATION)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_DRAFT_MANUAL_VOYAGE)).toBe(true);
    expect(VOYAGE_TOOL_NAMES.includes(TOOL_QUEUE_AIS_SYNC)).toBe(true);
  });
});

run();
