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
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const report = await service.getReport(id);
    return apiSuccess({ report });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
