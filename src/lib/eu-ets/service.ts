import type { EuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";
import type { EtsCalculationInput, EtsCalculationResult, EuEtsRecordInsert } from "@/lib/eu-ets/types";
import { ETS_CALCULATION_VERSION, etsScopeForGt, mrvScopeForGt } from "@/lib/eu-ets/types";
import { ETS_PARAMETER_VERSION_WITH_CLASSIFIER, getEtsCoverageRate } from "@/lib/eu-ets/parameters";
import { getVoyageCoverageFactor } from "@/lib/eu-ets/parameters";
import { classifyVoyagePortStatus, type VoyagePortStatus } from "@/lib/eu-ets/port-classifier";
import { computeEtsEmissions } from "@/lib/eu-ets/emissions";
import { computeDeadlines } from "@/lib/eu-ets/deadlines";
import { getEuaPrice } from "@/lib/eua-price/provider";
import type { EuaPriceProvider } from "@/lib/eua-price/provider";

export class EtsComplianceService {
  constructor(
    private readonly repo: EuEtsRecordRepository,
    private readonly euaPriceProvider?: EuaPriceProvider,
  ) {}

  async calculate(input: EtsCalculationInput): Promise<EtsCalculationResult> {
    const paramVer = input.parameter_version_override ?? ETS_PARAMETER_VERSION_WITH_CLASSIFIER;
    const ts = new Date().toISOString();

    const etsScope = etsScopeForGt(input.gt);
    const mrvScope = mrvScopeForGt(input.gt);
    const isInScope = etsScope === "IN_SCOPE";

    // 1. Emissions (TtW CO₂)
    const emissionRes = computeEtsEmissions(input.deliveries);

    // 2. Voyage coverage — surface unknown ports explicitly instead of silently
    //    treating them as NON_EU. UNKNOWN voyages get zero coverage factor but
    //    are flagged so the caller can warn/flag for manual resolution.
    const voyageContribs = input.voyages.map((v) => {
      const status = classifyVoyagePortStatus(v.departure_port, v.arrival_port);
      const coverageType = status.type === "UNKNOWN" ? "NON_EU" : status.type;
      const coverageFactor = getVoyageCoverageFactor(coverageType);
      return { ...v, coverageType, coverageFactor, __status: status };
    });

    // 3. Covered CO₂ (prorate by voyage — simplified: use delivery-based total)
    // For v1 we apply coverage by voyage proportion. Since we don't have per-voyage
    // emissions broken out, we use a simplified model: total CO₂ distributed
    // by equal share across voyages, each with its own coverage factor.
    const totalVoyages = voyageContribs.length || 1; // avoid div by 0
    const perVoyageCo2 = emissionRes.total_ttw_co2_tonnes / totalVoyages;
    let coveredCo2 = 0;
    for (const vc of voyageContribs) {
      coveredCo2 += perVoyageCo2 * vc.coverageFactor;
    }

    // 4. Coverage rate
    const coverageEntry = getEtsCoverageRate(input.reporting_year);

    // 5. EUA obligation
    const euaObligation = isInScope ? coveredCo2 * coverageEntry.rate : 0;

    // 6. EUA price
    const priceProvider = this.euaPriceProvider ?? { getPrice: getEuaPrice };
    const price = await priceProvider.getPrice();
    const priceAvailable = price !== null;

    // 7. Estimated cost
    const estimatedCost = priceAvailable && isInScope
      ? euaObligation * price!
      : null;

    // 8. Deadlines
    const deadlines = computeDeadlines(input.reporting_year);

    // 9. Unknown ports (explicit, not silently coerced to NON_EU)
    const unknownPorts = voyageContribs.flatMap((vc) => vc.__status.unknownPorts);

    const result: EtsCalculationResult = {
      calculation_version: ETS_CALCULATION_VERSION,
      parameter_version: paramVer,
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,

      gt: input.gt,
      ets_scope: etsScope,
      mrv_scope: mrvScope,
      is_in_scope: isInScope,

      total_ttw_co2_tonnes: Math.round(emissionRes.total_ttw_co2_tonnes * 10000) / 10000,
      covered_co2_tonnes: Math.round(coveredCo2 * 10000) / 10000,
      coverage_rate: coverageEntry.rate,
      coverage_rate_version: coverageEntry.source,

      eua_obligation_tonnes: Math.round(euaObligation * 10000) / 10000,
      eua_price_eur: price,
      eua_price_available: priceAvailable,
      estimated_cost_eur: estimatedCost !== null ? Math.round(estimatedCost * 100) / 100 : null,

      surrender_deadline: deadlines.surrender,
      mrv_deadline: deadlines.mrvReporting,

      voyage_contributions: voyageContribs.map((vc) => ({
        voyage_id: vc.id,
        departure_port: vc.departure_port,
        arrival_port: vc.arrival_port,
        coverage_type: vc.coverageType,
        coverage_factor: vc.coverageFactor,
        ttw_co2_tonnes: perVoyageCo2,
        covered_co2_tonnes: perVoyageCo2 * vc.coverageFactor,
      })),
      voyage_ids: input.voyages.map((v) => v.id),
      delivery_ids: input.deliveries.map((d) => d.id),

      unknown_ports: unknownPorts,

      calculated_at: ts,
    };

    return result;
  }

  async calculateAndSave(input: EtsCalculationInput): Promise<EtsCalculationResult> {
    const result = await this.calculate(input);
    const deadlines = computeDeadlines(input.reporting_year);

    const record: EuEtsRecordInsert = {
      vessel_id: result.vessel_id,
      reporting_year: result.reporting_year,
      calculation_version: result.calculation_version,
      gt: result.gt,
      ets_scope: result.ets_scope,
      mrv_scope: result.mrv_scope,
      total_ttw_co2_tonnes: result.total_ttw_co2_tonnes,
      covered_co2_tonnes: result.covered_co2_tonnes,
      coverage_rate: result.coverage_rate,
      coverage_rate_version: result.coverage_rate_version,
      eua_obligation_tonnes: result.eua_obligation_tonnes,
      eua_price_eur: result.eua_price_eur,
      eua_price_available: result.eua_price_available,
      estimated_cost_eur: result.estimated_cost_eur,
      surrender_deadline: deadlines.surrender?.deadline_date ?? null,
      surrender_status: deadlines.surrender?.status ?? null,
      mrv_deadline: deadlines.mrvReporting?.deadline_date ?? null,
      mrv_deadline_status: deadlines.mrvReporting?.status ?? null,
      parameter_version: result.parameter_version,
      calculation_details: {
        calculation_version: result.calculation_version,
        voyage_contributions: result.voyage_contributions.map((vc) => ({
          voyage_id: vc.voyage_id,
          coverage_type: vc.coverage_type,
          coverage_factor: vc.coverage_factor,
        })),
        parameter_version: result.parameter_version,
        calculated_at: result.calculated_at,
      },
      calculated_at: result.calculated_at,
    };

    const saved = await this.repo.upsert(record);
    return result;
  }

  async getRecord(vesselId: string, year: number): Promise<EtsCalculationResult | null> {
    const row = await this.repo.findByVesselAndYear(vesselId, year);
    if (!row) return null;

    return {
      calculation_version: row.calculation_version,
      parameter_version: row.parameter_version,
      vessel_id: row.vessel_id,
      reporting_year: row.reporting_year,
      gt: row.gt,
      ets_scope: row.ets_scope as EtsCalculationResult["ets_scope"],
      mrv_scope: row.mrv_scope as EtsCalculationResult["mrv_scope"],
      is_in_scope: row.ets_scope === "IN_SCOPE",
      total_ttw_co2_tonnes: row.total_ttw_co2_tonnes,
      covered_co2_tonnes: row.covered_co2_tonnes,
      coverage_rate: row.coverage_rate,
      coverage_rate_version: row.coverage_rate_version,
      eua_obligation_tonnes: row.eua_obligation_tonnes,
      eua_price_eur: row.eua_price_eur,
      eua_price_available: row.eua_price_available,
      estimated_cost_eur: row.estimated_cost_eur,
      surrender_deadline: null,
      mrv_deadline: null,
      voyage_contributions: [],
      voyage_ids: [],
      delivery_ids: [],
      unknown_ports: [],
      calculated_at: row.calculated_at,
    };
  }
}
