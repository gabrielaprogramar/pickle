import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createComplianceReportRepository } from "@/lib/supabase/repositories/compliance_reports";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createMrvReportRepository } from "@/lib/supabase/repositories/mrv_reports";
import { createFuelEuRecordRepository } from "@/lib/supabase/repositories/fuel_eu_records";
import { createEuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";
import { createEnvironmentalZoneRepository } from "@/lib/supabase/repositories/environmental_zones";
import { createPortCallRepository } from "@/lib/supabase/repositories/port_calls";
import { createReportService } from "@/lib/reporting";
import { apiCreated, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";

const REPORT_TYPES = ["thetis_mrv", "fueleu", "green_zone", "fleet_summary"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<{
      report_type: string;
      vessel_id: string;
      year: number;
      season?: string;
      vessel_ids?: string[];
      generated_by?: string;
    }>(request);

    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    if (!REPORT_TYPES.includes(body.report_type as typeof REPORT_TYPES[number])) {
      return apiError("VALIDATION_ERROR", `Invalid report type. Must be one of: ${REPORT_TYPES.join(", ")}`, 400);
    }

    if (!body.vessel_id && body.report_type !== "fleet_summary") {
      return apiError("VALIDATION_ERROR", "vessel_id is required", 400);
    }

    if (!body.year && body.report_type !== "green_zone") {
      return apiError("VALIDATION_ERROR", "year is required", 400);
    }

    const client = getSupabaseClient();
    const reportRepo = createComplianceReportRepository({ client });
    const vesselRepo = createVesselRepository({ client });
    const mrvRepo = createMrvReportRepository({ client });
    const fuelEuRepo = createFuelEuRecordRepository({ client });
    const etsRepo = createEuEtsRecordRepository({ client });
    const zoneRepo = createEnvironmentalZoneRepository({ client });
    const portCallRepo = createPortCallRepository({ client });

    const service = createReportService({
      reportRepo,
      getVessel: async (id) => vesselRepo.findById(id),
      getMrvReport: async (id, year) => mrvRepo.findByVesselAndYear(id, year) as unknown as Record<string, unknown> | null,
      getMrvReportList: async (id) => mrvRepo.listByVessel(id) as unknown as ReadonlyArray<Record<string, unknown>>,
      getFuelEuRecord: async (id, year) => fuelEuRepo.findByVesselAndYear(id, year) as unknown as Record<string, unknown> | null,
      getFuelEuRecordList: async (id) => fuelEuRepo.listByVessel(id) as unknown as ReadonlyArray<Record<string, unknown>>,
      getEtsRecord: async (id, year) => etsRepo.findByVesselAndYear(id, year) as unknown as Record<string, unknown> | null,
      getZoneEvents: async (id) => [],
      getPortCalls: async (id) => portCallRepo.findByVesselId(id) as unknown as ReadonlyArray<Record<string, unknown>>,
    });

    let result;
    switch (body.report_type) {
      case "thetis_mrv":
        result = await service.generateThetisMrrReport(body.vessel_id!, body.year, body.generated_by);
        break;
      case "fueleu":
        result = await service.generateFuelEuReport(body.vessel_id!, body.year, body.generated_by);
        break;
      case "green_zone":
        result = await service.generateGreenZoneReport(body.vessel_id!, body.season, body.generated_by);
        break;
      case "fleet_summary":
        result = await service.generateFleetSummaryReport(body.year, body.vessel_ids ?? [], body.generated_by);
        break;
      default:
        return apiError("VALIDATION_ERROR", `Unsupported report type: ${body.report_type}`, 400);
    }

    return apiCreated({ report: result.report, traces: result.traces });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
