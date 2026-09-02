import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createReportService, ReportGenerationError, ReportNotFoundError } from "../service";
import type { ReportRow, ReportInsert } from "@/lib/supabase";
import { REPORTING_VERSION } from "../types";

function createMockReportRepo() {
  const store = new Map<string, ReportRow>();

  function buildRow(insert: ReportInsert): ReportRow {
    return {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      report_type: insert.report_type as ReportRow["report_type"],
      vessel_id: insert.vessel_id ?? null,
      vessel_ids: null,
      title: insert.title,
      reporting_year: insert.reporting_year,
      season: null,
      status: (insert.status ?? "DRAFT") as ReportRow["status"],
      calculation_version: insert.calculation_version ?? REPORTING_VERSION,
      source_data_refs: insert.source_data_refs ?? null,
      storage_path: null,
      file_size: null,
      checksum: null,
      content: insert.content ?? null,
      generated_at: insert.generated_at ?? null,
      generated_by: insert.generated_by ?? null,
      submitted_at: null,
      verified_at: null,
      verification_notes: null,
      metadata: insert.metadata ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return {
    store,

    findById: async (id: string) => store.get(id) ?? null,

    findByVesselAndYear: async (vesselId: string, year: number) =>
      Array.from(store.values()).filter((r) => r.vessel_id === vesselId && r.reporting_year === year),

    listByType: async () => [] as ReportRow[],

    listByVessel: async (vesselId: string) =>
      Array.from(store.values()).filter((r) => r.vessel_id === vesselId),

    insert: async (insert: ReportInsert) => {
      const row = buildRow(insert);
      store.set(row.id, row);
      return row;
    },

    update: async (_id: string, _changes: Partial<ReportInsert>) => {
      throw new Error("Not implemented");
    },

    list: async (limit = 50, offset = 0) =>
      Array.from(store.values()).slice(offset, offset + limit),

    delete: async (_id: string) => {},
  };
}

describe("ReportService", () => {
  describe("getReport", () => {
    it("returns a report by ID", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      const row = await repo.insert({
        report_type: "thetis_mrv",
        vessel_id: "v1",
        title: "Test",
        reporting_year: 2025,
        status: "GENERATED",
        content: { foo: "bar" },
        metadata: {},
        calculation_version: REPORTING_VERSION,
      });

      const result = await svc.getReport(row.id);
      expect(result.id).toBe(row.id);
      expect(result.title).toBe("Test");
    });

    it("throws ReportNotFoundError for missing report", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      let threw = false;
      try {
        await svc.getReport("nonexistent");
      } catch (e) {
        if (e instanceof ReportNotFoundError) threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("generateThetisMrrReport", () => {
    it("generates a THETIS-MRV report from existing MRV data", async () => {
      const repo = createMockReportRepo();
      const vessel = { id: "v1", imo: "1234567", name: "Test Vessel", mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };
      const mrvReport = { id: "mrv1", total_voyages: 12, total_fuel_mt: 5000, total_co2_tonnes: 15750, methodology: "A", monitoring_plan_version: "2.0", status: "approved" };

      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => vessel,
        getMrvReport: async () => mrvReport,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      const result = await svc.generateThetisMrrReport("v1", 2025, "test-user");

      expect(result.report.report_type).toBe("thetis_mrv");
      expect(result.report.title).toContainString("Test Vessel");
      expect(result.report.status).toBe("GENERATED");
      expect(result.report.generated_by).toBe("test-user");
      expect(result.traces.length).toBe(1);
      expect(result.traces[0]?.source).toBe("mrv_reports");
      expect(result.traces[0]?.sourceId).toBe("mrv1");

      const content = result.report.content as Record<string, unknown>;
      expect(content.total_voyages).toBe(12);
      expect(content.total_fuel_mt).toBe(5000);
      expect(content.total_co2_tonnes).toBe(15750);
    });

    it("throws ReportGenerationError when vessel not found", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      let threw = false;
      try {
        await svc.generateThetisMrrReport("nonexistent", 2025);
      } catch (e) {
        if (e instanceof ReportGenerationError) threw = true;
      }
      expect(threw).toBe(true);
    });

    it("throws ReportGenerationError when MRV report not found", async () => {
      const repo = createMockReportRepo();
      const vessel = { id: "v1", imo: "1234567", name: "Test", mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => vessel,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      let threw = false;
      try {
        await svc.generateThetisMrrReport("v1", 2025);
      } catch (e) {
        if (e instanceof ReportGenerationError) threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("generateFuelEuReport", () => {
    it("generates a FuelEU report from existing FuelEU record", async () => {
      const repo = createMockReportRepo();
      const vessel = { id: "v1", imo: "1234567", name: "FuelEU Vessel", mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };
      const fuelEuRecord = { id: "fe1", ghg_intensity_gco2e_per_mj: 85, target_gco2e_per_mj: 91, compliance_balance: 6, surplus_or_deficit: "surplus", penalty_exposure_estimate: null, biofuel_energy_mj: 5000, ops_energy_mj: 1000, status: "final" };

      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => vessel,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => fuelEuRecord,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      const result = await svc.generateFuelEuReport("v1", 2025, "test-user");

      expect(result.report.report_type).toBe("fueleu");
      expect(result.report.title).toContainString("FuelEU Vessel");
      expect(result.report.status).toBe("GENERATED");
      expect(result.traces.length).toBe(1);
      expect(result.traces[0]?.source).toBe("fuel_eu_records");
      expect(result.traces[0]?.sourceId).toBe("fe1");

      const content = result.report.content as Record<string, unknown>;
      expect(content.ghg_intensity).toBe(85);
      expect(content.compliance_balance).toBe(6);
      expect(content.surplus_or_deficit).toBe("surplus");
    });

    it("throws when FuelEU record not found", async () => {
      const repo = createMockReportRepo();
      const vessel = { id: "v1", imo: "1234567", name: "Test", mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => vessel,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      let threw = false;
      try {
        await svc.generateFuelEuReport("v1", 2025);
      } catch (e) {
        if (e instanceof ReportGenerationError) threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("generateGreenZoneReport", () => {
    it("generates a Green Zone report aggregating zone events", async () => {
      const repo = createMockReportRepo();
      const vessel = { id: "v1", imo: "1234567", name: "Zone Vessel", mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };

      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => vessel,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [
          { id: "ze1", zone_code: "ECA_SOX_NA", zone_name: "North American ECA", category: "ECA_SOX", duration_minutes: 120 },
          { id: "ze2", zone_code: "ECA_SOX_NA", zone_name: "North American ECA", category: "ECA_SOX", duration_minutes: 180 },
        ],
        getPortCalls: async () => [
          { id: "pc1", port_name: "Rotterdam" },
          { id: "pc2", port_name: "Hamburg" },
        ],
      });

      const result = await svc.generateGreenZoneReport("v1", "Summer", "test-user");

      expect(result.report.report_type).toBe("green_zone");
      expect(result.report.title).toContainString("Zone Vessel");
      expect(result.report.status).toBe("GENERATED");
      expect(result.report.generated_by).toBe("test-user");

      const content = result.report.content as Record<string, unknown>;
      expect(content.zone_events_count).toBe(2);
      expect(content.port_call_count).toBe(2);
      expect(content.season).toBe("Summer");
      expect(result.traces.length).toBe(2);
    });

    it("throws when vessel not found", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      let threw = false;
      try {
        await svc.generateGreenZoneReport("nonexistent");
      } catch (e) {
        if (e instanceof ReportGenerationError) threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("generateFleetSummaryReport", () => {
    it("generates a fleet summary with multiple vessels", async () => {
      const repo = createMockReportRepo();
      const vessels: Record<string, { id: string; imo: string; name: string }> = {
        v1: { id: "v1", imo: "1111111", name: "Alpha" },
        v2: { id: "v2", imo: "2222222", name: "Bravo" },
      };

      const svc = createReportService({
        reportRepo: repo,
        getVessel: async (id: string) => {
          const v = vessels[id];
          if (!v) return null;
          return { ...v, mmsi: null as string | null, ship_id: null as string | null, gross_tonnage: null as number | null, flag: null as string | null, vessel_type: null as string | null, vessel_category: null as string | null, created_at: "", updated_at: "" };
        },
        getMrvReport: async (id: string) => {
          if (id === "v1") return { id: "mrv1", status: "approved", total_co2_tonnes: 10000 };
          return null;
        },
        getFuelEuRecord: async (id: string) => {
          if (id === "v1") return { id: "fe1", status: "final", compliance_balance: 5 };
          return null;
        },
        getEtsRecord: async (id: string) => {
          if (id === "v1") return { id: "ets1", status: "compliant" };
          return null;
        },
        getMrvReportList: async () => [],
        getFuelEuRecordList: async () => [],
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      const result = await svc.generateFleetSummaryReport(2025, ["v1", "v2", "nonexistent"], "admin");

      expect(result.report.report_type).toBe("fleet_summary");
      expect(result.report.status).toBe("GENERATED");
      expect(result.report.generated_by).toBe("admin");

      const content = result.report.content as Record<string, unknown>;
      expect(content.vessel_count).toBe(2);
      expect(content.reporting_year).toBe(2025);

      const summaries = content.vessel_summaries as Array<Record<string, unknown>>;
      expect(summaries.length).toBe(2);
      expect(summaries[0]?.vessel_name).toBe("Alpha");
      expect(summaries[0]?.mrv_co2_tonnes).toBe(10000);
      expect(summaries[0]?.fueleu_balance).toBe(5);
      expect(summaries[1]?.vessel_name).toBe("Bravo");
      expect(summaries[1]?.mrv_co2_tonnes).toBeNull();
    });
  });

  describe("listReports / listByVessel", () => {
    it("lists all reports", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      await repo.insert({ report_type: "thetis_mrv", vessel_id: "v1", title: "R1", reporting_year: 2025, status: "GENERATED", content: {}, metadata: {}, calculation_version: REPORTING_VERSION });
      await repo.insert({ report_type: "fueleu", vessel_id: "v2", title: "R2", reporting_year: 2025, status: "GENERATED", content: {}, metadata: {}, calculation_version: REPORTING_VERSION });

      const all = await svc.listReports();
      expect(all.length).toBe(2);
    });

    it("lists reports by vessel", async () => {
      const repo = createMockReportRepo();
      const svc = createReportService({
        reportRepo: repo,
        getVessel: async () => null,
        getMrvReport: async () => null,
        getMrvReportList: async () => [],
        getFuelEuRecord: async () => null,
        getFuelEuRecordList: async () => [],
        getEtsRecord: async () => null,
        getZoneEvents: async () => [],
        getPortCalls: async () => [],
      });

      await repo.insert({ report_type: "thetis_mrv", vessel_id: "v1", title: "R1", reporting_year: 2025, status: "GENERATED", content: {}, metadata: {}, calculation_version: REPORTING_VERSION });
      await repo.insert({ report_type: "fueleu", vessel_id: "v2", title: "R2", reporting_year: 2025, status: "GENERATED", content: {}, metadata: {}, calculation_version: REPORTING_VERSION });

      const vesselReports = await svc.listByVessel("v1");
      expect(vesselReports.length).toBe(1);
      expect(vesselReports[0]?.title).toBe("R1");
    });
  });
});

run();
