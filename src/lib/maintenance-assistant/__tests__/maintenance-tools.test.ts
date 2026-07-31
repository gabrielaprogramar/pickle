import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  createMaintenanceToolRegistry,
  MaintenanceVesselScopeError,
  validateMaintenanceToolInput,
  MAINTENANCE_TOOL_DEFINITIONS,
  MAINTENANCE_TOOL_NAMES,
  TOOL_GET_CERTIFICATES,
  TOOL_GET_PLAN_STATUS,
  TOOL_GET_SURVEY_SCHEDULE,
  TOOL_GET_CLASS_SOCIETY,
  TOOL_GET_CHARTER_CALENDAR,
  TOOL_GET_DEADLINES,
} from "../maintenance-tools";
import { createMockClassSocietyService, SUPPORTED_CLASS_SOCIETIES } from "../class-society";
import { createMockMaintenanceState } from "../mock-data";
import { makeContext, otherVesselContext } from "./_factory";

describe("Maintenance Assistant — tool registry and scope", () => {
  const registry = createMaintenanceToolRegistry();
  const state = createMockMaintenanceState("all-current");

  it("scopes all six tools to the assigned vessel", () => {
    const context = makeContext();
    const certs = registry.getCertificates({ context, state });
    const plan = registry.getPlanStatus({ context, state });
    const schedule = registry.getSurveySchedule({ context, state });
    const cls = registry.getClassSociety({ context, state });
    const charter = registry.getCharterCalendar({ context, state });
    const deadlines = registry.getDeadlines({ context, state });

    expect(certs.vessel.name).toBe("Aurelia");
    expect(plan.vessel.imo).toBe("9074729");
    expect(schedule.vessel.vesselId).toBe("vsl-aurelia");
    expect(cls.vessel.name).toBe("Aurelia");
    expect(charter.vessel.name).toBe("Aurelia");
    expect(deadlines.vessel.name).toBe("Aurelia");
  });

  it("throws MaintenanceVesselScopeError for another vessel's context", () => {
    const foreign = otherVesselContext();
    let threw = false;
    let isScopeError = false;
    try {
      registry.getSurveySchedule({ context: foreign, state });
    } catch (err) {
      threw = true;
      isScopeError = err instanceof MaintenanceVesselScopeError;
    }
    expect(threw).toBe(true);
    expect(isScopeError).toBe(true);
  });

  it("never returns another vessel's data on scope mismatch", () => {
    const foreign = otherVesselContext();
    try {
      registry.getCertificates({ context: foreign, state });
    } catch (err) {
      expect(err instanceof MaintenanceVesselScopeError).toBe(true);
    }
  });

  it("filters the survey schedule by survey type", () => {
    const context = makeContext();
    const renewal = registry.getSurveySchedule({ context, state }, { surveyType: "RENEWAL" });
    expect(renewal.data.length).toBeGreaterThan(0);
    expect(renewal.data.every((s) => s.surveyType === "RENEWAL")).toBe(true);
  });

  it("filters deadlines to blocking items on request", () => {
    const context = makeContext();
    const blocking = registry.getDeadlines({ context, state }, { blockingOnly: true });
    expect(blocking.data.every((d) => d.blocking)).toBe(true);
  });

  it("returns no schedule data for the no-schedule scenario", () => {
    const context = makeContext();
    const empty = registry.getSurveySchedule({ context, state: createMockMaintenanceState("no-schedule") });
    expect(empty.data.length).toBe(0);
  });

  it("reports an unknown class society without asserting a status", () => {
    const context = makeContext();
    const cls = registry.getClassSociety({
      context,
      state: createMockMaintenanceState("unknown-class"),
    });
    expect(cls.data && cls.data.known).toBe(false);
    expect(cls.data && cls.data.status).toBe("UNKNOWN");
  });

  it("validates tool inputs with Zod and rejects malformed input", () => {
    const good = validateMaintenanceToolInput(TOOL_GET_SURVEY_SCHEDULE, { surveyType: "RENEWAL" });
    expect(good.ok).toBe(true);
    const bad = validateMaintenanceToolInput(TOOL_GET_SURVEY_SCHEDULE, { surveyType: "NOT_A_TYPE" });
    expect(bad.ok).toBe(false);
    if (bad.ok === false) {
      expect(bad.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown tool names", () => {
    const result = validateMaintenanceToolInput("not_a_tool", {});
    expect(result.ok).toBe(false);
  });

  it("exposes gateway-compatible read-only tool definitions", () => {
    expect(MAINTENANCE_TOOL_DEFINITIONS.length).toBe(6);
    for (const def of MAINTENANCE_TOOL_DEFINITIONS) {
      expect(def.permission).toBe("read");
      expect(def.requiresConfirmation).toBe(false);
      expect(def.inputSchema).toBeTruthy();
      expect(def.outputSchema).toBeTruthy();
    }
    for (const name of MAINTENANCE_TOOL_NAMES) {
      expect(MAINTENANCE_TOOL_DEFINITIONS.some((d) => d.name === name)).toBe(true);
    }
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_CERTIFICATES)).toBe(true);
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_PLAN_STATUS)).toBe(true);
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_SURVEY_SCHEDULE)).toBe(true);
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_CLASS_SOCIETY)).toBe(true);
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_CHARTER_CALENDAR)).toBe(true);
    expect(MAINTENANCE_TOOL_NAMES.includes(TOOL_GET_DEADLINES)).toBe(true);
  });

  it("class society provider is a seam, not a live API", () => {
    const record = createMockMaintenanceState("all-current").classSociety;
    const service = createMockClassSocietyService(record);
    expect(service.isLive()).toBe(false);
    expect(service.supportedSocieties().length).toBe(7);
    expect(SUPPORTED_CLASS_SOCIETIES.includes("DNV")).toBe(true);
    expect(SUPPORTED_CLASS_SOCIETIES.includes("OTHER")).toBe(true);

    const context = makeContext();
    const viaSeam = createMaintenanceToolRegistry(undefined, service).getClassSociety({
      context,
      state,
    });
    expect(viaSeam.data && viaSeam.data.classSociety).toBe("RINA");
  });
});

run();
