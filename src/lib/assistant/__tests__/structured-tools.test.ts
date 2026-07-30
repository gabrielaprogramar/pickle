import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockStructuredToolService, TOOL_GET_VESSEL_COMPLIANCE_SCORE, TOOL_GET_FLEET_ETS_SUMMARY, TOOL_GET_OPEN_VIOLATIONS, TOOL_GET_FUEL_DELIVERIES, TOOL_GET_VOYAGE_LOG, TOOL_GET_MONITORING_PLAN_GAPS, TOOL_LOOKUP_EMISSION_FACTOR, TOOL_GET_DEADLINES } from "../structured-tools";

describe("StructuredToolService", () => {
  it("returns 15 tool definitions", async () => {
    const svc = createMockStructuredToolService();
    const defs = svc.getToolDefinitions();
    expect(defs.length).toBe(15);
  });

  it("get_vessel_compliance_score returns compliance data", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_VESSEL_COMPLIANCE_SCORE, input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" });
    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
  });

  it("get_fleet_ets_summary returns fleet data", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_FLEET_ETS_SUMMARY, input: { year: 2025, vesselIds: ["vessel-001", "vessel-002"] }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("get_open_violations returns violations list", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_OPEN_VIOLATIONS, input: { vesselId: "vessel-001" }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("get_fuel_deliveries returns delivery records", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_FUEL_DELIVERIES, input: { vesselId: "vessel-001" }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("get_voyage_log returns voyage records", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_VOYAGE_LOG, input: { vesselId: "vessel-001" }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("get_monitoring_plan_gaps returns gap analysis", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_MONITORING_PLAN_GAPS, input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("lookup_emission_factor returns emission factor data", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_LOOKUP_EMISSION_FACTOR, input: { fuelType: "HFO" }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("get_deadlines returns deadline data", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_DEADLINES, input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" });
    expect(result.success).toBe(true);
  });

  it("returns error for unknown tool", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: "unknown_tool", input: {}, conversationId: "c1" });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("all tool definitions have required fields", async () => {
    const svc = createMockStructuredToolService();
    const defs = svc.getToolDefinitions();
    for (const def of defs) {
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.permission).toBe("read");
      expect(def.inputSchema).toBeTruthy();
    }
  });

  it("execution records latency", async () => {
    const svc = createMockStructuredToolService();
    const result = await svc.execute({ toolName: TOOL_GET_VESSEL_COMPLIANCE_SCORE, input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" });
    expect(result.latencyMs).toBeGreaterThan(-1);
  });
});

run();
