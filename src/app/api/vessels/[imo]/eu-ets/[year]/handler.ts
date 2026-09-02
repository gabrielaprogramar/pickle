import {
  apiSuccess,
  apiCreated,
  apiError,
  parseJsonBody,
  mapErrorResponse,
} from "@/app/api/_lib/http";
import { NOT_FOUND, VALIDATION_ERROR } from "@/app/api/_lib/errors";
import type { ApiDependencies } from "@/app/api/_lib/deps";
import { EtsComplianceService } from "@/lib/eu-ets/service";

interface RouteParams {
  imo: string;
  year: string;
}

export async function handleGetEuEtsRecord(
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2024) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2024.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    const service = new EtsComplianceService(deps.euEtsRecords);
    const record = await service.getRecord(vessel.id, yearNum);
    if (!record) {
      return apiError(NOT_FOUND, `No EU ETS record found for IMO ${imo}, year ${year}.`, 404);
    }

    return apiSuccess(record);
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function handlePostEuEtsCalculate(
  request: Request,
  paramsPromise: Promise<RouteParams>,
  deps: ApiDependencies,
): Promise<Response> {
  try {
    const { imo, year } = await paramsPromise;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2024) {
      return apiError(VALIDATION_ERROR, "year must be a valid integer >= 2024.", 400);
    }

    const vessel = await deps.vessels.findByImo(imo);
    if (!vessel) {
      return apiError(NOT_FOUND, `No vessel found for IMO ${imo}.`, 404);
    }

    const body = await parseJsonBody<{
      parameter_version?: string;
      eua_price_eur?: number | null;
    }>(request);

    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const deliveries = await deps.fuelDeliveries.findByVesselAndYear(vessel.id, yearNum);
    const voyageRows = await deps.voyages.findByVesselAndYear(vessel.id, yearNum);
    const applicability = await deps.regulationApplicability.find(
      vessel.id,
      "EU_ETS",
      yearNum,
    );
    const consumption = await deps.voyageConsumption.listByVessel(vessel.id, yearNum);
    const coverageRule = await deps.regulatoryRules.findEffective(
      "EU_ETS",
      "ets_coverage",
      `${yearNum}-01-01`,
    );
    const coverageParams = (coverageRule?.parameters ?? {}) as { rate?: number };
    const coverageRate =
      typeof coverageParams.rate === "number" ? coverageParams.rate : undefined;

    const service = new EtsComplianceService(deps.euEtsRecords);
    const result = await service.calculateAndSave({
      vessel_id: vessel.id,
      reporting_year: yearNum,
      gt: vessel.gross_tonnage ?? null,
      vessel_profile: {
        flag: vessel.flag ?? null,
        vessel_type: vessel.vessel_type ?? null,
        vessel_category: vessel.vessel_category ?? null,
      },
      applicability: applicability
        ? {
            status: applicability.applicability as
              | "APPLICABLE"
              | "NOT_APPLICABLE"
              | "UNKNOWN"
              | "REQUIRES_REVIEW",
            is_decision_final: applicability.is_decision_final,
            rule_version: applicability.rule_version,
            rule_effective_from: applicability.rule_effective_from,
            rule_effective_until: applicability.rule_effective_until,
            basis: applicability.basis,
            notes: applicability.notes,
          }
        : null,
      consumption,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        fuel_type: d.fuel_type,
        quantity_mt: d.quantity_mt,
        delivery_date: d.delivery_date,
      })),
      voyages: voyageRows.map((v) => ({
        id: v.id,
        departure_port: v.departure_port_name,
        arrival_port: v.arrival_port_name,
      })),
      parameter_version_override: body.parameter_version,
      eua_price_eur: body.eua_price_eur,
      coverage_rate: coverageRate,
      coverage_rate_source: coverageRule
        ? coverageRule.source_reference ?? "regulatory_rules.ets_coverage"
        : undefined,
    });

    return apiCreated(result);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
