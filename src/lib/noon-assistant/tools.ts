import { z } from "zod";
import type { ToolDefinition } from "@/lib/assistant/types";
import type { NoonReportDomain } from "@/lib/noon-report";
import type {
  NoonAssistantState,
  NoonContext,
  NoonReportSnapshot,
  NoonVessel,
} from "./types";

export const TOOL_GET_NOON_LATEST = "get_noon_latest" as const;
export const TOOL_GET_NOON_HISTORY = "get_noon_history" as const;
export const TOOL_GET_NOON_ANALYSIS = "get_noon_analysis" as const;
export const TOOL_GET_NOON_FINDINGS = "get_noon_findings" as const;
export const TOOL_GET_NOON_FUEL = "get_noon_fuel" as const;
export const TOOL_GET_NOON_VOYAGE = "get_noon_voyage" as const;
export const TOOL_GET_NOON_FUELEU = "get_noon_fueleu" as const;
export const TOOL_GET_NOON_ETS = "get_noon_ets" as const;
export const TOOL_GET_NOON_OPERATIONAL_STATE = "get_noon_operational_state" as const;
export const TOOL_GET_NOON_DEVIATIONS = "get_noon_deviations" as const;

export const NOON_TOOL_NAMES: ReadonlyArray<string> = [
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
];

export class NoonVesselScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoonVesselScopeError";
  }
}

export interface NoonToolContext {
  readonly context: NoonContext;
  readonly state: NoonAssistantState;
}

export interface NoonToolResult<T> {
  readonly tool: string;
  readonly data: T;
  readonly vessel: NoonVessel;
}

export interface NoonToolRegistry {
  getLatest(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot | null>;
  getHistory(ctx: NoonToolContext): NoonToolResult<ReadonlyArray<NoonReportDomain>>;
  getAnalysis(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["analysis"] | null>;
  getFindings(ctx: NoonToolContext): NoonToolResult<ReadonlyArray<NoonReportSnapshot["findings"][number]>>;
  getFuel(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["fuel"] | null>;
  getVoyage(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["voyage"] | null>;
  getFuelEu(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["fueleu"] | null>;
  getEts(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["ets"] | null>;
  getOperationalState(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["analysis"]["operationalState"] | null>;
  getDeviations(ctx: NoonToolContext): NoonToolResult<NoonReportSnapshot["analysis"]["deviations"]>;
}

const noneSchema = z.object({}).strict();

export function assertNoonScope(ctx: NoonToolContext): void {
  const ctxVessel = ctx.context.vessel;
  const stateVessel = ctx.state.vessel;
  if (ctxVessel.vesselId !== stateVessel.vesselId || ctxVessel.imo !== stateVessel.imo) {
    throw new NoonVesselScopeError(
      `Vessel scope mismatch: context is scoped to ${ctxVessel.name} (${ctxVessel.imo}) but data source is ${stateVessel.name} (${stateVessel.imo}). Refusing to return another vessel's data.`,
    );
  }
}

export function createNoonToolRegistry(): NoonToolRegistry {
  return {
    getLatest(ctx) {
      assertNoonScope(ctx);
      return { tool: TOOL_GET_NOON_LATEST, data: ctx.state.latest, vessel: ctx.state.vessel };
    },

    getHistory(ctx) {
      assertNoonScope(ctx);
      return {
        tool: TOOL_GET_NOON_HISTORY,
        data: ctx.state.reports,
        vessel: ctx.state.vessel,
      };
    },

    getAnalysis(ctx) {
      assertNoonScope(ctx);
      return {
        tool: TOOL_GET_NOON_ANALYSIS,
        data: ctx.state.latest?.analysis ?? null,
        vessel: ctx.state.vessel,
      };
    },

    getFindings(ctx) {
      assertNoonScope(ctx);
      return {
        tool: TOOL_GET_NOON_FINDINGS,
        data: ctx.state.latest?.findings ?? [],
        vessel: ctx.state.vessel,
      };
    },

    getFuel(ctx) {
      assertNoonScope(ctx);
      return { tool: TOOL_GET_NOON_FUEL, data: ctx.state.latest?.fuel ?? null, vessel: ctx.state.vessel };
    },

    getVoyage(ctx) {
      assertNoonScope(ctx);
      return { tool: TOOL_GET_NOON_VOYAGE, data: ctx.state.latest?.voyage ?? null, vessel: ctx.state.vessel };
    },

    getFuelEu(ctx) {
      assertNoonScope(ctx);
      return { tool: TOOL_GET_NOON_FUELEU, data: ctx.state.latest?.fueleu ?? null, vessel: ctx.state.vessel };
    },

    getEts(ctx) {
      assertNoonScope(ctx);
      return { tool: TOOL_GET_NOON_ETS, data: ctx.state.latest?.ets ?? null, vessel: ctx.state.vessel };
    },

    getOperationalState(ctx) {
      assertNoonScope(ctx);
      return {
        tool: TOOL_GET_NOON_OPERATIONAL_STATE,
        data: ctx.state.latest?.analysis.operationalState ?? null,
        vessel: ctx.state.vessel,
      };
    },

    getDeviations(ctx) {
      assertNoonScope(ctx);
      return {
        tool: TOOL_GET_NOON_DEVIATIONS,
        data: ctx.state.latest?.analysis.deviations ?? [],
        vessel: ctx.state.vessel,
      };
    },
  };
}

export function validateNoonToolInput(
  toolName: string,
  input: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!NOON_TOOL_NAMES.includes(toolName)) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }
  const parsed = noneSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid input for ${toolName}: ${parsed.error.message}` };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

const READ: "read" = "read";

function defineTool(
  name: string,
  description: string,
  category: "compliance" | "voyage" | "document" | "regulatory" | "fleet" | "notification",
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  permission: "read" | "write" = READ,
  requiresConfirmation = false,
): ToolDefinition {
  return {
    name,
    description,
    category,
    permission,
    inputSchema,
    outputSchema,
    requiresConfirmation,
  };
}

const vesselOnly = {
  type: "object",
  properties: { vesselId: { type: "string" } },
} as const;

export const NOON_TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  defineTool(
    TOOL_GET_NOON_LATEST,
    "Get the latest noon report with its deterministic analysis, findings and correlations for a vessel",
    "voyage",
    vesselOnly,
    {
      type: "object",
      properties: {
        reportDate: { type: "string" },
        operationalState: { type: "string" },
        speedKnots: { type: "number" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_HISTORY,
    "Get the noon report history (newest first) for a vessel",
    "voyage",
    vesselOnly,
    {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, reportDate: { type: "string" } },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_ANALYSIS,
    "Get the deterministic noon analysis: consumption, engine performance, slip, speed, weather and voyage deviations",
    "voyage",
    vesselOnly,
    {
      type: "object",
      properties: {
        operationalState: { type: "string" },
        consumption: { type: "object" },
        engine: { type: "object" },
        slip: { type: "object" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_FINDINGS,
    "Get all deterministic noon findings across validation, fuel, voyage, FuelEU and ETS correlations",
    "compliance",
    vesselOnly,
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          severity: { type: "string" },
          reason: { type: "string" },
          remediation: { type: "string" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_FUEL,
    "Get the fuel correlation for the latest noon report (attribution, consistency, discrepancy)",
    "compliance",
    vesselOnly,
    {
      type: "object",
      properties: {
        status: { type: "string" },
        attribution: { type: "array" },
        findings: { type: "array" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_VOYAGE,
    "Get the voyage correlation for the latest noon report (schedule posture, ETA, progress)",
    "voyage",
    vesselOnly,
    {
      type: "object",
      properties: {
        status: { type: "string" },
        eta: { type: "string" },
        distanceToGoNm: { type: "number" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_FUELEU,
    "Get the FuelEU operational input derived from the latest noon report",
    "compliance",
    vesselOnly,
    {
      type: "object",
      properties: {
        fuelType: { type: "string" },
        lhv: { type: "number" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_ETS,
    "Get the EU ETS operational input derived from the latest noon report",
    "compliance",
    vesselOnly,
    {
      type: "object",
      properties: {
        fuelType: { type: "string" },
        co2Factor: { type: "number" },
      },
    },
  ),
  defineTool(
    TOOL_GET_NOON_OPERATIONAL_STATE,
    "Get the resolved operational state of the latest noon report (AT_SEA, IN_PORT, WAITING, UNKNOWN)",
    "voyage",
    vesselOnly,
    { type: "string" },
  ),
  defineTool(
    TOOL_GET_NOON_DEVIATIONS,
    "Get the deterministic voyage deviation analysis for the latest noon report",
    "voyage",
    vesselOnly,
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string" },
          severity: { type: "string" },
        },
      },
    },
  ),
];
