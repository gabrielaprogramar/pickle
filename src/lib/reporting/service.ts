import type {
  ReportRow,
  ReportInsert,
  ReportType,
  ComplianceReportRepository,
  VesselRow,
} from "@/lib/supabase";
import type {
  ThetisMrvReportContent,
  FuelEuReportContent,
  GreenZoneReportContent,
  FleetSummaryReportContent,
} from "./types";
import { REPORTING_VERSION } from "./types";

export class ReportGenerationError extends Error {
  constructor(
    message: string,
    public readonly reportType: string,
    public readonly vesselId: string,
    public readonly reportingYear: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ReportGenerationError";
  }
}

export class ReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Compliance report not found: ${reportId}`);
    this.name = "ReportNotFoundError";
  }
}

export interface ReportGenerationResult {
  readonly report: ReportRow;
  readonly traces: ReadonlyArray<{ source: string; sourceId: string }>;
}

export interface ReportServiceOptions {
  readonly reportRepo: ComplianceReportRepository;
  readonly getVessel: (vesselId: string) => Promise<VesselRow | null>;
  readonly getMrvReport: (vesselId: string, year: number) => Promise<Record<string, unknown> | null>;
  readonly getMrvReportList: (vesselId: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly getFuelEuRecord: (vesselId: string, year: number) => Promise<Record<string, unknown> | null>;
  readonly getFuelEuRecordList: (vesselId: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly getEtsRecord: (vesselId: string, year: number) => Promise<Record<string, unknown> | null>;
  readonly getZoneEvents: (vesselId: string, season?: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly getPortCalls: (vesselId: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly getFuelEuComplianceRecords?: (vesselId: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
}

export interface ReportService {
  getReport(reportId: string): Promise<ReportRow>;
  listReports(limit?: number, offset?: number): Promise<ReadonlyArray<ReportRow>>;
  listByVessel(vesselId: string): Promise<ReadonlyArray<ReportRow>>;
  generateThetisMrrReport(vesselId: string, year: number, generatedBy?: string): Promise<ReportGenerationResult>;
  generateFuelEuReport(vesselId: string, year: number, generatedBy?: string): Promise<ReportGenerationResult>;
  generateGreenZoneReport(vesselId: string, season?: string, generatedBy?: string): Promise<ReportGenerationResult>;
  generateFleetSummaryReport(year: number, vesselIds: ReadonlyArray<string>, generatedBy?: string): Promise<ReportGenerationResult>;
}

export function createReportService(opts: ReportServiceOptions): ReportService {
  const buildInsert = (
    reportType: ReportType,
    vesselId: string | null,
    title: string,
    year: number,
    season: string | null,
    content: Record<string, unknown>,
    sourceDataRefs: Record<string, unknown>,
    generatedBy?: string,
  ): ReportInsert => ({
    report_type: reportType,
    vessel_id: vesselId,
    title,
    reporting_year: year,
    season,
    status: "GENERATED",
    calculation_version: REPORTING_VERSION,
    source_data_refs: sourceDataRefs,
    content,
    generated_at: new Date().toISOString(),
    generated_by: generatedBy ?? "system",
    metadata: {},
  });

  return {
    async getReport(reportId: string): Promise<ReportRow> {
      const report = await opts.reportRepo.findById(reportId);
      if (!report) throw new ReportNotFoundError(reportId);
      return report;
    },

    async listReports(limit = 50, offset = 0): Promise<ReadonlyArray<ReportRow>> {
      return opts.reportRepo.list(limit, offset);
    },

    async listByVessel(vesselId: string): Promise<ReadonlyArray<ReportRow>> {
      return opts.reportRepo.listByVessel(vesselId);
    },

    async generateThetisMrrReport(vesselId: string, year: number, generatedBy?: string): Promise<ReportGenerationResult> {
      const vessel = await opts.getVessel(vesselId);
      if (!vessel) throw new ReportGenerationError("Vessel not found", "thetis_mrv", vesselId, year);

      const mrvReport = await opts.getMrvReport(vesselId, year);
      if (!mrvReport) throw new ReportGenerationError("No MRV report data found", "thetis_mrv", vesselId, year, new Error("MrvReportRepository returned null"));

      const traces: Array<{ source: string; sourceId: string }> = [];
      if (mrvReport.id) traces.push({ source: "mrv_reports", sourceId: mrvReport.id as string });

      const content: ThetisMrvReportContent = {
        vessel_id: vesselId,
        vessel_name: vessel.name,
        imo: vessel.imo,
        reporting_year: year,
        total_voyages: (mrvReport.total_voyages as number) ?? 0,
        total_fuel_mt: (mrvReport.total_fuel_mt as number) ?? 0,
        total_co2_tonnes: (mrvReport.total_co2_tonnes as number) ?? 0,
        methodology: (mrvReport.methodology as string) ?? "",
        monitoring_plan_version: mrvReport.monitoring_plan_version as string | null,
        mrv_report_id: mrvReport.id as string,
        source_report: mrvReport as Record<string, unknown>,
        generated_at: new Date().toISOString(),
      };

      const insert = buildInsert(
        "thetis_mrv", vesselId,
        `THETIS-MRV Report — ${vessel.name} (${year})`,
        year, null,
        content as Record<string, unknown>,
        { source_mrv_report_id: mrvReport.id },
        generatedBy,
      );

      const report = await opts.reportRepo.insert(insert);
      return { report, traces };
    },

    async generateFuelEuReport(vesselId: string, year: number, generatedBy?: string): Promise<ReportGenerationResult> {
      const vessel = await opts.getVessel(vesselId);
      if (!vessel) throw new ReportGenerationError("Vessel not found", "fueleu", vesselId, year);

      const fuelEuRecord = await opts.getFuelEuRecord(vesselId, year);
      if (!fuelEuRecord) throw new ReportGenerationError("No FuelEU record found", "fueleu", vesselId, year, new Error("FuelEuRecordRepository returned null"));

      const traces: Array<{ source: string; sourceId: string }> = [];
      if (fuelEuRecord.id) traces.push({ source: "fuel_eu_records", sourceId: fuelEuRecord.id as string });

      const content: FuelEuReportContent = {
        vessel_id: vesselId,
        vessel_name: vessel.name,
        imo: vessel.imo,
        reporting_year: year,
        ghg_intensity: (fuelEuRecord.ghg_intensity_gco2e_per_mj as number) ?? 0,
        target_intensity: (fuelEuRecord.target_gco2e_per_mj as number) ?? 0,
        compliance_balance: (fuelEuRecord.compliance_balance as number) ?? 0,
        surplus_or_deficit: (fuelEuRecord.surplus_or_deficit as string) ?? "zero",
        penalty_estimate: fuelEuRecord.penalty_exposure_estimate as number | null,
        biofuel_energy_mj: (fuelEuRecord.biofuel_energy_mj as number) ?? 0,
        ops_energy_mj: (fuelEuRecord.ops_energy_mj as number) ?? 0,
        source_record_id: fuelEuRecord.id as string,
        source_calculation: fuelEuRecord as Record<string, unknown>,
        generated_at: new Date().toISOString(),
      };

      const insert = buildInsert(
        "fueleu", vesselId,
        `FuelEU Report — ${vessel.name} (${year})`,
        year, null,
        content as Record<string, unknown>,
        { source_fuel_eu_record_id: fuelEuRecord.id },
        generatedBy,
      );

      const report = await opts.reportRepo.insert(insert);
      return { report, traces };
    },

    async generateGreenZoneReport(vesselId: string, season?: string, generatedBy?: string): Promise<ReportGenerationResult> {
      const vessel = await opts.getVessel(vesselId);
      if (!vessel) throw new ReportGenerationError("Vessel not found", "green_zone", vesselId, 0);

      const zoneEvents = await opts.getZoneEvents(vesselId, season);
      const portCalls = await opts.getPortCalls(vesselId);

      const zoneMap = new Map<string, { zone_code: string; zone_name: string; category: string; entry_count: number; total_duration_minutes: number }>();
      for (const ev of zoneEvents) {
        const zoneCode = (ev.zone_code ?? ev.zone_id ?? "unknown") as string;
        const existing = zoneMap.get(zoneCode);
        const duration = (ev.duration_minutes as number) ?? 0;
        if (existing) {
          existing.entry_count++;
          existing.total_duration_minutes += duration;
        } else {
          zoneMap.set(zoneCode, {
            zone_code: zoneCode,
            zone_name: (ev.zone_name as string) ?? zoneCode,
            category: (ev.category as string) ?? "unknown",
            entry_count: 1,
            total_duration_minutes: duration,
          });
        }
      }

      const traces = zoneEvents
        .filter((ev) => ev.id)
        .map((ev) => ({ source: "zone_events" as const, sourceId: ev.id as string }));

      const content: GreenZoneReportContent = {
        vessel_id: vesselId,
        vessel_name: vessel.name,
        imo: vessel.imo,
        season: season ?? null,
        zone_events_count: zoneEvents.length,
        zones_entered: Array.from(zoneMap.values()),
        port_call_count: portCalls.length,
        source_event_ids: traces.map((t) => t.sourceId),
        generated_at: new Date().toISOString(),
      };

      const insert = buildInsert(
        "green_zone", vesselId,
        `Green Zone Report — ${vessel.name}${season ? ` (${season})` : ""}`,
        new Date().getFullYear(), season ?? null,
        content as Record<string, unknown>,
        { source_event_count: zoneEvents.length, source_port_call_count: portCalls.length },
        generatedBy,
      );

      const report = await opts.reportRepo.insert(insert);
      return { report, traces };
    },

    async generateFleetSummaryReport(year: number, vesselIds: ReadonlyArray<string>, generatedBy?: string): Promise<ReportGenerationResult> {
      const summaries: Array<FleetSummaryReportContent["vessel_summaries"][number]> = [];
      const traces: Array<{ source: string; sourceId: string }> = [];

      for (const vid of vesselIds) {
        const vessel = await opts.getVessel(vid);
        if (!vessel) continue;

        const mrvReport = await opts.getMrvReport(vid, year);
        const fuelEuRecord = await opts.getFuelEuRecord(vid, year);
        const etsRecord = await opts.getEtsRecord(vid, year);

        if (mrvReport?.id) traces.push({ source: "mrv_reports", sourceId: mrvReport.id as string });
        if (fuelEuRecord?.id) traces.push({ source: "fuel_eu_records", sourceId: fuelEuRecord.id as string });
        if (etsRecord?.id) traces.push({ source: "eu_ets_records", sourceId: etsRecord.id as string });

        summaries.push({
          vessel_id: vid,
          vessel_name: vessel.name,
          imo: vessel.imo,
          mrv_status: (mrvReport?.status as string | null) ?? null,
          fueleu_status: (fuelEuRecord?.status as string | null) ?? null,
          ets_status: (etsRecord?.status as string | null) ?? null,
          mrv_co2_tonnes: (mrvReport?.total_co2_tonnes as number | null) ?? null,
          fueleu_balance: (fuelEuRecord?.compliance_balance as number | null) ?? null,
        });
      }

      const content: FleetSummaryReportContent = {
        fleet_name: "Managed Fleet",
        reporting_year: year,
        vessel_count: summaries.length,
        vessel_summaries: summaries,
        generated_at: new Date().toISOString(),
      };

      const insert = buildInsert(
        "fleet_summary", null,
        `Fleet Compliance Summary (${year})`,
        year, null,
        content as Record<string, unknown>,
        { vessel_count: vesselIds.length, summarized_count: summaries.length },
        generatedBy,
      );

      const report = await opts.reportRepo.insert(insert);
      return { report, traces };
    },
  };
}
