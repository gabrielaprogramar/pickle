import { z } from "zod";
import type { ToolDefinition } from "@/lib/assistant/types";
import type {
  CertificateRecord,
  CharterCalendarEntry,
  ClassSocietyRecord,
  MaintenanceContext,
  MaintenanceDeadline,
  MaintenanceVessel,
  MonitoringPlanReview,
  SurveyScheduleItem,
  SurveyStatus,
  SurveyType,
} from "./types";
import type { MaintenanceMockState } from "./mock-data";
import { MAINTENANCE_MOCK_NOW } from "./mock-data";
import type { StatusEngine } from "./status-engine";
import { createStatusEngine } from "./status-engine";
import type { ClassSocietyService } from "./class-society";

export const TOOL_GET_CERTIFICATES = "get_certificates" as const;
export const TOOL_GET_PLAN_STATUS = "get_plan_status" as const;
export const TOOL_GET_SURVEY_SCHEDULE = "get_survey_schedule" as const;
export const TOOL_GET_CLASS_SOCIETY = "get_class_society" as const;
export const TOOL_GET_CHARTER_CALENDAR = "get_charter_calendar" as const;
export const TOOL_GET_DEADLINES = "get_deadlines" as const;

export const MAINTENANCE_TOOL_NAMES: ReadonlyArray<string> = [
  TOOL_GET_CERTIFICATES,
  TOOL_GET_PLAN_STATUS,
  TOOL_GET_SURVEY_SCHEDULE,
  TOOL_GET_CLASS_SOCIETY,
  TOOL_GET_CHARTER_CALENDAR,
  TOOL_GET_DEADLINES,
];

export class MaintenanceVesselScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceVesselScopeError";
  }
}

export interface MaintenanceToolContext {
  readonly context: MaintenanceContext;
  readonly state: MaintenanceMockState;
}

export interface MaintenanceToolResult<T> {
  readonly tool: string;
  readonly data: T;
  readonly vessel: MaintenanceVessel;
}

export interface MaintenanceToolRegistry {
  getCertificates(
    ctx: MaintenanceToolContext,
    input?: Readonly<{ certificateType?: string }>,
  ): MaintenanceToolResult<ReadonlyArray<CertificateRecord>>;
  getPlanStatus(ctx: MaintenanceToolContext): MaintenanceToolResult<MonitoringPlanReview | null>;
  getSurveySchedule(
    ctx: MaintenanceToolContext,
    input?: Readonly<{ surveyType?: SurveyType; status?: SurveyStatus }>,
  ): MaintenanceToolResult<ReadonlyArray<SurveyScheduleItem>>;
  getClassSociety(ctx: MaintenanceToolContext): MaintenanceToolResult<ClassSocietyRecord | null>;
  getCharterCalendar(
    ctx: MaintenanceToolContext,
    input?: Readonly<{ includeWindowsOnly?: boolean }>,
  ): MaintenanceToolResult<ReadonlyArray<CharterCalendarEntry>>;
  getDeadlines(
    ctx: MaintenanceToolContext,
    input?: Readonly<{ blockingOnly?: boolean }>,
  ): MaintenanceToolResult<ReadonlyArray<MaintenanceDeadline>>;
}

const vesselIdSchema = z.object({
  vesselId: z.string().optional(),
});

const scheduleInputSchema = z.object({
  vesselId: z.string().optional(),
  surveyType: z.enum(["ANNUAL", "INTERMEDIATE", "SPECIAL", "RENEWAL", "ISM", "ISPS", "OTHER"]).optional(),
  status: z
    .enum(["CURRENT", "UPCOMING", "DUE_SOON", "OVERDUE", "BLOCKING", "UNKNOWN"])
    .optional(),
});

const certificateInputSchema = z.object({
  vesselId: z.string().optional(),
  certificateType: z.string().optional(),
});

const charterInputSchema = z.object({
  vesselId: z.string().optional(),
  includeWindowsOnly: z.boolean().optional(),
});

const deadlineInputSchema = z.object({
  vesselId: z.string().optional(),
  blockingOnly: z.boolean().optional(),
});

export function assertVesselScope(ctx: MaintenanceToolContext): void {
  const ctxVessel = ctx.context.vessel;
  const stateVessel = ctx.state.vessel;
  if (ctxVessel.vesselId !== stateVessel.vesselId || ctxVessel.imo !== stateVessel.imo) {
    throw new MaintenanceVesselScopeError(
      `Vessel scope mismatch: context is scoped to ${ctxVessel.name} (${ctxVessel.imo}) but data source is ${stateVessel.name} (${stateVessel.imo}). Refusing to return another vessel's data.`,
    );
  }
}

function resolveNow(ctx: MaintenanceToolContext): string {
  return ctx.context.now ?? MAINTENANCE_MOCK_NOW;
}

export function createMaintenanceToolRegistry(
  engine?: StatusEngine,
  classSocietyService?: ClassSocietyService,
): MaintenanceToolRegistry {
  const status = engine ?? createStatusEngine();

  return {
    getCertificates(ctx, input) {
      assertVesselScope(ctx);
      const parsed = certificateInputSchema.parse(input ?? {});
      const now = resolveNow(ctx);
      let data = status.evaluateCertificates(ctx.state.certificates, now);
      if (parsed.certificateType) {
        data = data.filter((c) => c.certificateType === parsed.certificateType);
      }
      return { tool: TOOL_GET_CERTIFICATES, data, vessel: ctx.state.vessel };
    },

    getPlanStatus(ctx) {
      assertVesselScope(ctx);
      const now = resolveNow(ctx);
      const plan = ctx.state.plan;
      let data: MonitoringPlanReview | null = null;
      if (plan) {
        data = {
          ...plan,
          reviewStatus:
            plan.nextReviewDue === null
              ? "UNKNOWN"
              : status.surveyStatus(plan.nextReviewDue, true, now),
        };
      }
      return { tool: TOOL_GET_PLAN_STATUS, data, vessel: ctx.state.vessel };
    },

    getSurveySchedule(ctx, input) {
      assertVesselScope(ctx);
      const parsed = scheduleInputSchema.parse(input ?? {});
      const now = resolveNow(ctx);
      let data = status.evaluateSchedule(ctx.state.schedule, now);
      if (parsed.surveyType) {
        data = data.filter((s) => s.surveyType === parsed.surveyType);
      }
      if (parsed.status) {
        data = data.filter((s) => s.status === parsed.status);
      }
      return { tool: TOOL_GET_SURVEY_SCHEDULE, data, vessel: ctx.state.vessel };
    },

    getClassSociety(ctx) {
      assertVesselScope(ctx);
      const record = classSocietyService
        ? classSocietyService.getRecord(ctx.state.vessel) ?? ctx.state.classSociety
        : ctx.state.classSociety;
      return { tool: TOOL_GET_CLASS_SOCIETY, data: record, vessel: ctx.state.vessel };
    },

    getCharterCalendar(ctx, input) {
      assertVesselScope(ctx);
      const parsed = charterInputSchema.parse(input ?? {});
      let data = ctx.state.charterCalendar;
      if (parsed.includeWindowsOnly) {
        data = data.filter((e) => e.maintenanceWindow);
      }
      return { tool: TOOL_GET_CHARTER_CALENDAR, data, vessel: ctx.state.vessel };
    },

    getDeadlines(ctx, input) {
      assertVesselScope(ctx);
      const parsed = deadlineInputSchema.parse(input ?? {});
      const now = resolveNow(ctx);
      const schedule = status.evaluateSchedule(ctx.state.schedule, now);
      const certificates = status.evaluateCertificates(ctx.state.certificates, now);
      let data = status.buildDeadlines(schedule, certificates, ctx.state.plan, now);
      if (parsed.blockingOnly) {
        data = data.filter((d) => d.blocking);
      }
      return { tool: TOOL_GET_DEADLINES, data, vessel: ctx.state.vessel };
    },
  };
}

export function validateMaintenanceToolInput(
  toolName: string,
  input: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schemas: Record<string, z.ZodType> = {
    [TOOL_GET_CERTIFICATES]: certificateInputSchema,
    [TOOL_GET_PLAN_STATUS]: vesselIdSchema,
    [TOOL_GET_SURVEY_SCHEDULE]: scheduleInputSchema,
    [TOOL_GET_CLASS_SOCIETY]: vesselIdSchema,
    [TOOL_GET_CHARTER_CALENDAR]: charterInputSchema,
    [TOOL_GET_DEADLINES]: deadlineInputSchema,
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

function defineTool(
  name: string,
  description: string,
  category: "compliance" | "voyage" | "document" | "regulatory" | "fleet" | "notification",
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
): ToolDefinition {
  return { name, description, category, permission: READ, inputSchema, outputSchema, requiresConfirmation: false };
}

export const MAINTENANCE_TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  defineTool(
    TOOL_GET_CERTIFICATES,
    "Get certificate records and derived validity status for a vessel",
    "document",
    {
      type: "object",
      properties: { vesselId: { type: "string" }, certificateType: { type: "string" } },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          certificateType: { type: "string" },
          title: { type: "string" },
          expiresAt: { type: ["string", "null"] },
          status: { type: "string" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_PLAN_STATUS,
    "Get the monitoring plan review status for a vessel",
    "compliance",
    { type: "object", properties: { vesselId: { type: "string" } } },
    {
      type: "object",
      properties: {
        planVersion: { type: "string" },
        nextReviewDue: { type: ["string", "null"] },
        reviewStatus: { type: "string" },
      },
    },
  ),
  defineTool(
    TOOL_GET_SURVEY_SCHEDULE,
    "Get the class and statutory survey schedule for a vessel with derived status",
    "compliance",
    {
      type: "object",
      properties: {
        vesselId: { type: "string" },
        surveyType: { type: "string" },
        status: { type: "string" },
      },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          surveyType: { type: "string" },
          dueDate: { type: "string" },
          status: { type: "string" },
          source: { type: "string" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_CLASS_SOCIETY,
    "Get the class society record for a vessel",
    "regulatory",
    { type: "object", properties: { vesselId: { type: "string" } } },
    {
      type: "object",
      properties: {
        classSociety: { type: "string" },
        status: { type: "string" },
        known: { type: "boolean" },
      },
    },
  ),
  defineTool(
    TOOL_GET_CHARTER_CALENDAR,
    "Get charter calendar entries including maintenance windows for a vessel",
    "voyage",
    {
      type: "object",
      properties: { vesselId: { type: "string" }, includeWindowsOnly: { type: "boolean" } },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          period: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          maintenanceWindow: { type: "boolean" },
        },
      },
    },
  ),
  defineTool(
    TOOL_GET_DEADLINES,
    "Get derived survey, certificate and monitoring plan deadlines for a vessel",
    "compliance",
    {
      type: "object",
      properties: { vesselId: { type: "string" }, blockingOnly: { type: "boolean" } },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          dueDate: { type: "string" },
          daysRemaining: { type: "number" },
          status: { type: "string" },
          blocking: { type: "boolean" },
          impact: { type: "string" },
        },
      },
    },
  ),
];
