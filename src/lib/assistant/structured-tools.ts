import type { ToolDefinition, ToolCallResult, ToolCallRequest, ToolCategory, ToolPermission } from "./types";

export const TOOL_GET_VESSEL_COMPLIANCE_SCORE = "get_vessel_compliance_score" as const;
export const TOOL_GET_FLEET_ETS_SUMMARY = "get_fleet_ets_summary" as const;
export const TOOL_GET_OPEN_VIOLATIONS = "get_open_violations" as const;
export const TOOL_GET_FUEL_DELIVERIES = "get_fuel_deliveries" as const;
export const TOOL_GET_VOYAGE_LOG = "get_voyage_log" as const;
export const TOOL_GET_MONITORING_PLAN_GAPS = "get_monitoring_plan_gaps" as const;
export const TOOL_LOOKUP_EMISSION_FACTOR = "lookup_emission_factor" as const;
export const TOOL_GET_DEADLINES = "get_deadlines" as const;
export const TOOL_GET_COMPLIANCE_REPORTS = "get_compliance_reports" as const;
export const TOOL_GET_VESSEL_INFO = "get_vessel_info" as const;

const READ: ToolPermission = "read";

export interface StructuredToolContext {
  readonly fuelEuRepo: { findByVesselAndYear(vesselId: string, year: number): Promise<unknown | null> };
  readonly etsRepo: { findByVesselAndYear(vesselId: string, year: number): Promise<unknown | null> };
  readonly mrvRepo: { findByVesselAndYear(vesselId: string, year: number): Promise<unknown | null> };
  readonly vesselRepo: { findById(id: string): Promise<unknown | null>; findByImo(imo: string): Promise<unknown | null> };
  readonly fuelDeliveryRepo: { findByVessel(vesselId: string): Promise<ReadonlyArray<unknown>> };
  readonly voyageRepo: { findByVessel(vesselId: string): Promise<ReadonlyArray<unknown>> };
  readonly reportRepo: { findByVesselAndYear(vesselId: string, year: number): Promise<ReadonlyArray<unknown>> };
  readonly notificationRepo: { listByRecipient(recipientId: string): Promise<ReadonlyArray<unknown>> };
}

function defineTool(
  name: string,
  description: string,
  category: ToolCategory,
  permission: ToolPermission,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  requiresConfirmation: boolean,
): ToolDefinition {
  return { name, description, category, permission, inputSchema, outputSchema, requiresConfirmation };
}

const TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  defineTool(
    TOOL_GET_VESSEL_COMPLIANCE_SCORE,
    "Get combined FuelEU and EU ETS compliance score for a vessel in a given year",
    "compliance",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, year: { type: "number" } }, required: ["vesselId", "year"] },
    { type: "object", properties: { fuelEuStatus: { type: "string" }, etsStatus: { type: "string" }, combinedScore: { type: "number" } } },
    false,
  ),
  defineTool(
    TOOL_GET_FLEET_ETS_SUMMARY,
    "Get a fleet-level summary of EU ETS obligations and costs for a given year",
    "fleet",
    READ,
    { type: "object", properties: { year: { type: "number" }, vesselIds: { type: "array", items: { type: "string" } } }, required: ["year"] },
    { type: "object", properties: { totalCoveredCO2: { type: "number" }, totalEstimatedCost: { type: "number" }, vesselCount: { type: "number" } } },
    false,
  ),
  defineTool(
    TOOL_GET_OPEN_VIOLATIONS,
    "Get open compliance violations for a vessel or organization",
    "compliance",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, organizationId: { type: "string" } } },
    { type: "array", items: { type: "object", properties: { type: { type: "string" }, severity: { type: "string" }, description: { type: "string" } } } },
    false,
  ),
  defineTool(
    TOOL_GET_FUEL_DELIVERIES,
    "Get fuel delivery records (BDN data) for a vessel",
    "document",
    READ,
    { type: "object", properties: { vesselId: { type: "string" } }, required: ["vesselId"] },
    { type: "array", items: { type: "object" } },
    false,
  ),
  defineTool(
    TOOL_GET_VOYAGE_LOG,
    "Get voyage log entries for a vessel",
    "voyage",
    READ,
    { type: "object", properties: { vesselId: { type: "string" } }, required: ["vesselId"] },
    { type: "array", items: { type: "object" } },
    false,
  ),
  defineTool(
    TOOL_GET_MONITORING_PLAN_GAPS,
    "Identify gaps or missing elements in a vessel's monitoring plan",
    "compliance",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, year: { type: "number" } }, required: ["vesselId", "year"] },
    { type: "array", items: { type: "string" } },
    false,
  ),
  defineTool(
    TOOL_LOOKUP_EMISSION_FACTOR,
    "Look up emission factors for a fuel type",
    "regulatory",
    READ,
    { type: "object", properties: { fuelType: { type: "string" } }, required: ["fuelType"] },
    { type: "object", properties: { co2Factor: { type: "number" }, soxFactor: { type: "number" }, pmFactor: { type: "number" } } },
    false,
  ),
  defineTool(
    TOOL_GET_DEADLINES,
    "Get regulatory deadlines for a vessel in a given year",
    "compliance",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, year: { type: "number" } }, required: ["vesselId", "year"] },
    { type: "array", items: { type: "object", properties: { deadlineType: { type: "string" }, dueDate: { type: "string" }, status: { type: "string" } } } },
    false,
  ),
  defineTool(
    TOOL_GET_COMPLIANCE_REPORTS,
    "Get generated compliance reports for a vessel and year",
    "compliance",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, year: { type: "number" } }, required: ["vesselId", "year"] },
    { type: "array", items: { type: "object" } },
    false,
  ),
  defineTool(
    TOOL_GET_VESSEL_INFO,
    "Get vessel details by ID or IMO number",
    "regulatory",
    READ,
    { type: "object", properties: { vesselId: { type: "string" }, imo: { type: "string" } } },
    { type: "object", properties: { id: { type: "string" }, imo: { type: "string" }, name: { type: "string" } } },
    false,
  ),
];

export interface StructuredToolService {
  getToolDefinitions(): ReadonlyArray<ToolDefinition>;
  execute(request: ToolCallRequest): Promise<ToolCallResult>;
}

export function createStructuredToolService(context: StructuredToolContext): StructuredToolService {
  async function executeHandler(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case TOOL_GET_VESSEL_COMPLIANCE_SCORE: {
        const vesselId = input.vesselId as string;
        const year = input.year as number;
        const [fuelEu, ets] = await Promise.all([
          context.fuelEuRepo.findByVesselAndYear(vesselId, year),
          context.etsRepo.findByVesselAndYear(vesselId, year),
        ]);
        const calcScore = (record: unknown | null): string =>
          record ? "COMPLIANT" : "NO_DATA";

        let combinedScore = 100;
        if (!fuelEu) combinedScore -= 25;
        if (!ets) combinedScore -= 25;

        return {
          fuelEuStatus: calcScore(fuelEu),
          etsStatus: calcScore(ets),
          combinedScore: Math.max(0, combinedScore),
          fuelEuRecord: fuelEu,
          etsRecord: ets,
        };
      }

      case TOOL_GET_FLEET_ETS_SUMMARY: {
        const year = input.year as number;
        const vesselIds = (input.vesselIds as ReadonlyArray<string>) ?? [];
        const records = await Promise.all(
          vesselIds.map((vid) => context.etsRepo.findByVesselAndYear(vid, year)),
        );
        const valid = records.filter(Boolean);
        const totalCO2 = valid.reduce((sum, r: any) => sum + (r.covered_co2_tonnes ?? 0), 0);
        const totalCost = valid.reduce((sum, r: any) => sum + (r.estimated_cost_eur ?? 0), 0);
        return {
          totalCoveredCO2: totalCO2,
          totalEstimatedCost: totalCost,
          vesselCount: valid.length,
        };
      }

      case TOOL_GET_OPEN_VIOLATIONS: {
        const vesselId = input.vesselId as string | undefined;
        const organizationId = input.organizationId as string | undefined;
        const notifications = await context.notificationRepo.listByRecipient(vesselId ?? organizationId ?? "");
        return (notifications as any[])
          .filter((n) => n.severity === "HIGH" || n.severity === "CRITICAL")
          .map((n) => ({
            type: n.notification_type,
            severity: n.severity,
            description: n.message,
            createdAt: n.created_at,
          }));
      }

      case TOOL_GET_FUEL_DELIVERIES: {
        const vesselId = input.vesselId as string;
        return context.fuelDeliveryRepo.findByVessel(vesselId);
      }

      case TOOL_GET_VOYAGE_LOG: {
        const vesselId = input.vesselId as string;
        return context.voyageRepo.findByVessel(vesselId);
      }

      case TOOL_GET_MONITORING_PLAN_GAPS: {
        const vesselId = input.vesselId as string;
        const year = input.year as number;
        const reports = await context.reportRepo.findByVesselAndYear(vesselId, year);
        const gaps: string[] = [];
        if (!reports || reports.length === 0) {
          gaps.push("No monitoring reports found for this vessel/year");
        }
        return gaps;
      }

      case TOOL_LOOKUP_EMISSION_FACTOR: {
        const fuelType = (input.fuelType as string)?.toLowerCase() ?? "";
        const factors: Record<string, { co2Factor: number; soxFactor: number; pmFactor: number }> = {
          "hfo": { co2Factor: 3.114, soxFactor: 0.005, pmFactor: 0.001 },
          "mgo": { co2Factor: 3.206, soxFactor: 0.001, pmFactor: 0.0005 },
          "lng": { co2Factor: 2.750, soxFactor: 0.000, pmFactor: 0.0001 },
          "methanol": { co2Factor: 1.375, soxFactor: 0.000, pmFactor: 0.0001 },
          "ammonia": { co2Factor: 0.000, soxFactor: 0.000, pmFactor: 0.0000 },
        };
        const result = factors[fuelType];
        if (!result) {
          return { co2Factor: 0, soxFactor: 0, pmFactor: 0, note: `Unknown fuel type: ${fuelType}` };
        }
        return result;
      }

      case TOOL_GET_DEADLINES: {
        const vesselId = input.vesselId as string;
        const year = input.year as number;
        const deadlines = [
          { deadlineType: "MRV_Submission", dueDate: `${year + 1}-03-31`, status: "PENDING" },
          { deadlineType: "EU_ETS_Surrender", dueDate: `${year + 1}-09-30`, status: "PENDING" },
          { deadlineType: "FuelEU_Compliance", dueDate: `${year + 1}-04-30`, status: "PENDING" },
        ];
        const [ets, fuelEu] = await Promise.all([
          context.etsRepo.findByVesselAndYear(vesselId, year),
          context.fuelEuRepo.findByVesselAndYear(vesselId, year),
        ]);
        if (ets && (ets as any).surrender_status) {
          const d = deadlines[1]!;
          deadlines[1] = { deadlineType: d.deadlineType, dueDate: d.dueDate, status: (ets as any).surrender_status };
        }
        return deadlines;
      }

      case TOOL_GET_COMPLIANCE_REPORTS: {
        const vesselId = input.vesselId as string;
        const year = input.year as number;
        return context.reportRepo.findByVesselAndYear(vesselId, year);
      }

      case TOOL_GET_VESSEL_INFO: {
        const vesselId = input.vesselId as string | undefined;
        const imo = input.imo as string | undefined;
        if (vesselId) return context.vesselRepo.findById(vesselId);
        if (imo) return context.vesselRepo.findByImo(imo);
        return null;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  return {
    getToolDefinitions(): ReadonlyArray<ToolDefinition> {
      return TOOL_DEFINITIONS;
    },

    async execute(request: ToolCallRequest): Promise<ToolCallResult> {
      const start = Date.now();
      try {
        const def = TOOL_DEFINITIONS.find((d) => d.name === request.toolName);
        if (!def) {
          return { success: false, data: null, error: `Tool not found: ${request.toolName}`, latencyMs: Date.now() - start };
        }
        const data = await executeHandler(request.toolName, request.input);
        return { success: true, data, latencyMs: Date.now() - start };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, data: null, error: msg, latencyMs: Date.now() - start };
      }
    },
  };
}

export function createMockStructuredToolService(): StructuredToolService {
  const mockVesselData = {
    "vessel-001": { id: "vessel-001", imo: "9876543", name: "MV Poseidon Voyager", gross_tonnage: 85000 },
    "vessel-002": { id: "vessel-002", imo: "9876544", name: "MV Ocean Guardian", gross_tonnage: 72000 },
    "vessel-003": { id: "vessel-003", imo: "9876545", name: "MV Baltic Trader", gross_tonnage: 45000 },
  };

  const mockEtsRecords: Record<string, any> = {
    "vessel-001-2025": {
      id: "ets-001", vessel_id: "vessel-001", reporting_year: 2025,
      total_ttw_co2_tonnes: 12500, covered_co2_tonnes: 8750,
      coverage_rate: 0.70, eua_obligation_tonnes: 8750,
      eua_price_eur: 75.50, estimated_cost_eur: 660625,
      surrender_status: "PENDING", parameter_version: "1.0",
    },
  };

  const mockFuelEuRecords: Record<string, any> = {
    "vessel-001-2025": {
      id: "fueleu-001", vessel_id: "vessel-001", reporting_year: 2025,
      ghg_intensity_gco2e_per_mj: 85.2, target_gco2e_per_mj: 89.3,
      compliance_balance: 4.1, surplus_or_deficit: "SURPLUS",
      penalty_exposure_estimate: 0, parameter_version: "1.0",
    },
  };

  const mockRepo: StructuredToolContext = {
    fuelEuRepo: {
      async findByVesselAndYear(vesselId: string, year: number) {
        return mockFuelEuRecords[`${vesselId}-${year}`] ?? null;
      },
    },
    etsRepo: {
      async findByVesselAndYear(vesselId: string, year: number) {
        return mockEtsRecords[`${vesselId}-${year}`] ?? { id: "ets-mock", vessel_id: vesselId, reporting_year: year, surrender_status: "PENDING", estimated_cost_eur: 0, covered_co2_tonnes: 0 };
      },
    },
    mrvRepo: {
      async findByVesselAndYear() { return null; },
    },
    vesselRepo: {
      async findById(id: string) { return mockVesselData[id as keyof typeof mockVesselData] ?? null; },
      async findByImo(imo: string) {
        return Object.values(mockVesselData).find((v) => v.imo === imo) ?? null;
      },
    },
    fuelDeliveryRepo: {
      async findByVessel() { return []; },
    },
    voyageRepo: {
      async findByVessel() { return []; },
    },
    reportRepo: {
      async findByVesselAndYear() { return []; },
    },
    notificationRepo: {
      async listByRecipient() { return []; },
    },
  };

  return createStructuredToolService(mockRepo);
}
