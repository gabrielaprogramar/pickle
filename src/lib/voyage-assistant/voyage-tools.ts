import { z } from "zod";
import type { ToolDefinition } from "@/lib/assistant/types";
import { TIER_ORDER, worstTier } from "./gap-ladder";
import type {
  AisGap,
  AisGapTier,
  AisPosition,
  AisSyncRequest,
  ManualVoyageDraft,
  PortCall,
  Violation,
  VoyageComplianceContext,
  VoyageContext,
  VoyageRecord,
  VoyageVessel,
} from "./types";
import type { VoyageMockState } from "./mock-data";
import { VOYAGE_MOCK_NOW } from "./mock-data";

export const TOOL_GET_VOYAGE_LOG = "get_voyage_log" as const;
export const TOOL_GET_AIS_POSITIONS = "get_ais_positions" as const;
export const TOOL_GET_DATA_GAPS = "get_data_gaps" as const;
export const TOOL_GET_PORT_INFO = "get_port_info" as const;
export const TOOL_EXPLAIN_VIOLATION = "explain_violation" as const;
export const TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT = "get_voyage_compliance_context" as const;
export const TOOL_DRAFT_MANUAL_VOYAGE = "draft_manual_voyage" as const;
export const TOOL_QUEUE_AIS_SYNC = "queue_ais_sync" as const;

export const VOYAGE_TOOL_NAMES: ReadonlyArray<string> = [
  TOOL_GET_VOYAGE_LOG,
  TOOL_GET_AIS_POSITIONS,
  TOOL_GET_DATA_GAPS,
  TOOL_GET_PORT_INFO,
  TOOL_EXPLAIN_VIOLATION,
  TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT,
  TOOL_DRAFT_MANUAL_VOYAGE,
  TOOL_QUEUE_AIS_SYNC,
];

export class VoyageVesselScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoyageVesselScopeError";
  }
}

export interface VoyageToolContext {
  readonly context: VoyageContext;
  readonly state: VoyageMockState;
}

export interface VoyageToolResult<T> {
  readonly tool: string;
  readonly data: T;
  readonly vessel: VoyageVessel;
}

export interface VoyageToolRegistry {
  getVoyageLog(
    ctx: VoyageToolContext,
    input?: Readonly<{ voyageId?: string; voyageNumber?: string }>,
  ): VoyageToolResult<ReadonlyArray<VoyageRecord>>;
  getAisPositions(
    ctx: VoyageToolContext,
    input?: Readonly<{ voyageId?: string; from?: string; to?: string }>,
  ): VoyageToolResult<ReadonlyArray<AisPosition>>;
  getDataGaps(
    ctx: VoyageToolContext,
    input?: Readonly<{ voyageId?: string; tier?: AisGapTier }>,
  ): VoyageToolResult<ReadonlyArray<AisGap>>;
  getPortInfo(
    ctx: VoyageToolContext,
    input?: Readonly<{ portName?: string; locode?: string; greenZoneOnly?: boolean }>,
  ): VoyageToolResult<ReadonlyArray<PortCall>>;
  explainViolation(
    ctx: VoyageToolContext,
    input?: Readonly<{ voyageId?: string; code?: string }>,
  ): VoyageToolResult<ReadonlyArray<Violation>>;
  getComplianceContext(
    ctx: VoyageToolContext,
    input?: Readonly<{ voyageId?: string }>,
  ): VoyageToolResult<VoyageComplianceContext | null>;
  draftManualVoyage(
    ctx: VoyageToolContext,
    input: Readonly<{ voyageId: string; confirm?: boolean; reason?: string }>,
  ): VoyageToolResult<ManualVoyageDraft | null>;
  queueAisSync(
    ctx: VoyageToolContext,
    input: Readonly<{ voyageId: string; confirm?: boolean; reason?: string }>,
  ): VoyageToolResult<AisSyncRequest | null>;
}

const voyageIdSchema = z.object({
  voyageId: z.string().optional(),
});

const voyageLogInputSchema = z.object({
  voyageId: z.string().optional(),
  voyageNumber: z.string().optional(),
});

const positionsInputSchema = z.object({
  voyageId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const gapsInputSchema = z.object({
  voyageId: z.string().optional(),
  tier: z
    .enum(["INTERPOLATION_OK", "FLAGGED", "MANUAL_REQUIRED", "CRITICAL_ESCALATION"])
    .optional(),
});

const portInfoInputSchema = z.object({
  portName: z.string().optional(),
  locode: z.string().optional(),
  greenZoneOnly: z.boolean().optional(),
});

const violationInputSchema = z.object({
  voyageId: z.string().optional(),
  code: z.string().optional(),
});

const writeInputSchema = z.object({
  voyageId: z.string(),
  confirm: z.boolean().optional(),
  reason: z.string().optional(),
});

export function assertVoyageScope(ctx: VoyageToolContext): void {
  const ctxVessel = ctx.context.vessel;
  const stateVessel = ctx.state.vessel;
  if (ctxVessel.vesselId !== stateVessel.vesselId || ctxVessel.imo !== stateVessel.imo) {
    throw new VoyageVesselScopeError(
      `Vessel scope mismatch: context is scoped to ${ctxVessel.name} (${ctxVessel.imo}) but data source is ${stateVessel.name} (${stateVessel.imo}). Refusing to return another vessel's data.`,
    );
  }
}

function resolveNow(ctx: VoyageToolContext): string {
  return ctx.context.now ?? VOYAGE_MOCK_NOW;
}

function findVoyage(state: VoyageMockState, voyageId: string): VoyageRecord {
  const voyage = state.voyages.find((v) => v.id === voyageId);
  if (!voyage) {
    throw new Error(`Voyage not found: ${voyageId}`);
  }
  return voyage;
}

export function createVoyageToolRegistry(): VoyageToolRegistry {
  return {
    getVoyageLog(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = voyageLogInputSchema.parse(input ?? {});
      let data = ctx.state.voyages;
      if (parsed.voyageId) data = data.filter((v) => v.id === parsed.voyageId);
      if (parsed.voyageNumber) data = data.filter((v) => v.voyageNumber === parsed.voyageNumber);
      return { tool: TOOL_GET_VOYAGE_LOG, data, vessel: ctx.state.vessel };
    },

    getAisPositions(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = positionsInputSchema.parse(input ?? {});
      let data = ctx.state.aisPositions;
      if (parsed.voyageId) data = data.filter((p) => p.voyageId === parsed.voyageId);
      if (parsed.from) data = data.filter((p) => p.ts >= parsed.from!);
      if (parsed.to) data = data.filter((p) => p.ts <= parsed.to!);
      return {
        tool: TOOL_GET_AIS_POSITIONS,
        data: data.slice().sort((a, b) => a.ts.localeCompare(b.ts)),
        vessel: ctx.state.vessel,
      };
    },

    getDataGaps(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = gapsInputSchema.parse(input ?? {});
      let data = ctx.state.gaps;
      if (parsed.voyageId) data = data.filter((g) => g.voyageId === parsed.voyageId);
      if (parsed.tier) data = data.filter((g) => g.tier === parsed.tier);
      return { tool: TOOL_GET_DATA_GAPS, data, vessel: ctx.state.vessel };
    },

    getPortInfo(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = portInfoInputSchema.parse(input ?? {});
      let data = ctx.state.portCalls;
      if (parsed.portName) {
        const normalized = parsed.portName.toLowerCase();
        data = data.filter((p) => p.portName.toLowerCase().includes(normalized));
      }
      if (parsed.locode) {
        const normalized = parsed.locode.toUpperCase();
        data = data.filter((p) => p.locode === normalized || p.locode.includes(normalized));
      }
      if (parsed.greenZoneOnly) {
        data = data.filter((p) => p.greenZone);
      }
      return { tool: TOOL_GET_PORT_INFO, data, vessel: ctx.state.vessel };
    },

    explainViolation(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = violationInputSchema.parse(input ?? {});
      let data = ctx.state.violations;
      if (parsed.voyageId) data = data.filter((v) => v.voyageId === parsed.voyageId);
      if (parsed.code) {
        const normalized = parsed.code.toUpperCase();
        data = data.filter((v) => v.code === normalized);
      }
      return { tool: TOOL_EXPLAIN_VIOLATION, data, vessel: ctx.state.vessel };
    },

    getComplianceContext(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = voyageIdSchema.parse(input ?? {});
      const voyage = parsed.voyageId
        ? findVoyage(ctx.state, parsed.voyageId)
        : ctx.state.voyages[0];
      if (!voyage) return { tool: TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT, data: null, vessel: ctx.state.vessel };
      const violations = ctx.state.violations.filter((v) => v.voyageId === voyage.id);
      const actionableItems = violations.map((v) => ({
        id: v.id,
        label: v.title,
        severity: v.severity,
      }));
      return {
        tool: TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT,
        data: {
          vessel: ctx.state.vessel,
          voyage,
          etsCoverageRate: voyage.etsCoverageRate,
          classification: voyage.classification,
          violations,
          actionableItems,
        },
        vessel: ctx.state.vessel,
      };
    },

    draftManualVoyage(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = writeInputSchema.parse(input ?? {});
      const voyage = findVoyage(ctx.state, parsed.voyageId);
      const gaps = ctx.state.gaps.filter((g) => g.voyageId === voyage.id);
      const worst = worstTier(gaps);
      if (worst !== "MANUAL_REQUIRED" && worst !== "CRITICAL_ESCALATION") {
        return { tool: TOOL_DRAFT_MANUAL_VOYAGE, data: null, vessel: ctx.state.vessel };
      }
      const target = gaps.find((g) => g.tier === worst) ?? gaps[0];
      const confirmed = parsed.confirm === true;
      const draft: ManualVoyageDraft = {
        id: `draft-${voyage.id}-1`,
        vesselId: voyage.vesselId,
        voyageId: voyage.id,
        departurePort: voyage.departurePort,
        arrivalPort: voyage.arrivalPort,
        departureTs: voyage.departureTs,
        arrivalTs: voyage.arrivalTs,
        distanceNm: voyage.distanceNm,
        reason: parsed.reason ?? "Substantiate the AIS data gap with a manual voyage draft.",
        supportingEvidence:
          "Source records held for verifier inspection: logbook extracts and noon reports for the covered segment.",
        verifierDefensibility:
          "The draft reproduces the stored voyage record values only; it adds no fabricated positions.",
        status: confirmed ? "CONFIRMED" : "DRAFT",
        source: "Manual voyage draft workflow",
      };
      void target;
      return { tool: TOOL_DRAFT_MANUAL_VOYAGE, data: draft, vessel: ctx.state.vessel };
    },

    queueAisSync(ctx, input) {
      assertVoyageScope(ctx);
      const parsed = writeInputSchema.parse(input ?? {});
      const voyage = findVoyage(ctx.state, parsed.voyageId);
      const gaps = ctx.state.gaps.filter((g) => g.voyageId === voyage.id);
      const worst = worstTier(gaps);
      if (TIER_ORDER[worst] < TIER_ORDER.FLAGGED) {
        return { tool: TOOL_QUEUE_AIS_SYNC, data: null, vessel: ctx.state.vessel };
      }
      const target = gaps.find((g) => TIER_ORDER[g.tier] === TIER_ORDER[worst]) ?? gaps[0];
      if (!target) {
        return { tool: TOOL_QUEUE_AIS_SYNC, data: null, vessel: ctx.state.vessel };
      }
      const confirmed = parsed.confirm === true;
      const request: AisSyncRequest = {
        id: `sync-${voyage.id}-1`,
        vesselId: voyage.vesselId,
        voyageId: voyage.id,
        from: target.from,
        to: target.to,
        reason:
          parsed.reason ??
          `AIS backfill request for the ${target.durationMinutes}-minute data gap on ${voyage.voyageNumber}.`,
        status: confirmed ? "CONFIRMED" : "DRAFT",
        source: "AIS backfill workflow",
      };
      return { tool: TOOL_QUEUE_AIS_SYNC, data: request, vessel: ctx.state.vessel };
    },
  };
}

export function validateVoyageToolInput(
  toolName: string,
  input: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schemas: Record<string, z.ZodType> = {
    [TOOL_GET_VOYAGE_LOG]: voyageLogInputSchema,
    [TOOL_GET_AIS_POSITIONS]: positionsInputSchema,
    [TOOL_GET_DATA_GAPS]: gapsInputSchema,
    [TOOL_GET_PORT_INFO]: portInfoInputSchema,
    [TOOL_EXPLAIN_VIOLATION]: violationInputSchema,
    [TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT]: voyageIdSchema,
    [TOOL_DRAFT_MANUAL_VOYAGE]: writeInputSchema,
    [TOOL_QUEUE_AIS_SYNC]: writeInputSchema,
  };
  const schema = schemas[toolName];
  if (!schema) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid input for ${toolName}: ${parsed.error.message}` };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

const READ: "read" = "read";
const WRITE: "write" = "write";

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

export const VOYAGE_TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  defineTool(
    TOOL_GET_VOYAGE_LOG,
    "Get voyage ledger records with classification, ETS coverage, distance and data quality for a vessel",
    "voyage",
    {
      type: "object",
      properties: { voyageId: { type: "string" }, voyageNumber: { type: "string" } },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          voyageNumber: { type: "string" },
          departurePort: { type: "object" },
          arrivalPort: { type: "object" },
          classification: { type: "string" },
          etsCoverageRate: { type: "number" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_AIS_POSITIONS,
    "Get stored AIS positions for a vessel, optionally filtered by voyage and time window",
    "voyage",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        voyageId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          ts: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          source: { type: "string" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_DATA_GAPS,
    "Get AIS data gaps classified against the deterministic gap ladder for a vessel",
    "voyage",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        voyageId: { type: "string" },
        tier: { type: "string" },
      },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          durationMinutes: { type: "number" },
          tier: { type: "string" },
          escalation: { type: "boolean" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_PORT_INFO,
    "Get port calls with LOCODE, country and Green Zone status for a vessel",
    "voyage",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        portName: { type: "string" },
        locode: { type: "string" },
        greenZoneOnly: { type: "boolean" },
      },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          portName: { type: "string" },
          locode: { type: "string" },
          country: { type: "string" },
          greenZone: { type: "boolean" },
        },
      },
    },
  ),
  defineTool(
    TOOL_EXPLAIN_VIOLATION,
    "Get stored consistency and coverage violations with rule references and recommendations",
    "compliance",
    {
      type: "object",
      properties: { vesselId: { type: "string" }, voyageId: { type: "string" }, code: { type: "string" } },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          severity: { type: "string" },
          title: { type: "string" },
          recommendation: { type: "string" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_VOYAGE_COMPLIANCE_CONTEXT,
    "Get stored ETS coverage rate, voyage classification and actionable items for a voyage",
    "compliance",
    { type: "object", properties: { vesselId: { type: "string" }, voyageId: { type: "string" } } },
    {
      type: "object",
      properties: {
        etsCoverageRate: { type: "number" },
        classification: { type: "string" },
        actionableItems: { type: "array" },
      },
    },
  ),
  defineTool(
    TOOL_DRAFT_MANUAL_VOYAGE,
    "Draft a manual voyage to substantiate an AIS gap on the MANUAL_REQUIRED or CRITICAL_ESCALATION tier",
    "voyage",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        voyageId: { type: "string" },
        confirm: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["voyageId"],
    },
    {
      type: "object",
      properties: {
        id: { type: "string" },
        voyageId: { type: "string" },
        status: { type: "string" },
        supportingEvidence: { type: "string" },
      },
    },
    WRITE,
    true,
  ),
  defineTool(
    TOOL_QUEUE_AIS_SYNC,
    "Queue an AIS backfill request for a data gap on the FLAGGED tier or above",
    "voyage",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        voyageId: { type: "string" },
        confirm: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["voyageId"],
    },
    {
      type: "object",
      properties: {
        id: { type: "string" },
        voyageId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        status: { type: "string" },
      },
    },
    WRITE,
    true,
  ),
];
