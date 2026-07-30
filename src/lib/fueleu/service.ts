import type { FuelDeliveryRow } from "@/lib/supabase/types";
import type { FuelEuCalculationInput, FuelEuCalculationResult, FuelEuRecordInsert } from "@/lib/fueleu/types";
import { FUELEU_CALCULATION_VERSION } from "@/lib/fueleu/types";
import { CURRENT_PARAMETER_VERSION } from "@/lib/fueleu/parameters";
import { computeEnergyContributions } from "@/lib/fueleu/energy";
import { computeWtwEmissions } from "@/lib/fueleu/emissions";
import { computeGhgIntensity } from "@/lib/fueleu/intensity";
import { analyseBiofuels } from "@/lib/fueleu/biofuels";
import { computeCompliance } from "@/lib/fueleu/compliance";
import { estimatePenalty } from "@/lib/fueleu/penalty";
import { processOpsData } from "@/lib/fueleu/ops";
import type { FuelEuRecordRepository } from "@/lib/supabase/repositories/fuel_eu_records";

export class FuelEUComplianceService {
  constructor(private readonly repo: FuelEuRecordRepository) {}

  /**
   * Run a complete FuelEU compliance calculation for a vessel × year.
   */
  async calculate(input: FuelEuCalculationInput): Promise<FuelEuCalculationResult> {
    const paramVer = input.parameter_version_override ?? CURRENT_PARAMETER_VERSION;
    const ts = new Date().toISOString();

    // 1. Energy
    const energyRes = computeEnergyContributions(input.deliveries);

    // 2. WtW Emissions
    const emissionsRes = computeWtwEmissions(energyRes.contributions);

    // 3. Intensity
    const intensityRes = computeGhgIntensity(
      energyRes.total_energy_mj,
      emissionsRes.total_wtw_emissions_gco2e,
    );

    // 4. Compliance
    const complianceRes = computeCompliance(
      intensityRes.ghg_intensity_gco2e_per_mj,
      input.reporting_year,
    );

    // 5. Biofuels / ISCC
    const isccMissingSet = new Set(input.iscc_missing_delivery_ids ?? []);
    const bioRes = analyseBiofuels(emissionsRes.contributions, isccMissingSet);

    // 6. Penalty
    const penaltyRes = estimatePenalty(
      complianceRes.compliance_balance,
      energyRes.total_energy_mj,
    );

    // 7. OPS
    const opsRes = processOpsData(input.ops_energy_mj, input.ops_energy_mj != null);

    const deliveriesUsed = emissionsRes.contributions.filter((c) => c.wtw_emissions_gco2e > 0 || c.energy_mj > 0).length;

    const fuelDeliveryIds = input.deliveries.map((d) => d.id);

    // Build contributions with all fields
    const finalContributions = emissionsRes.contributions.map((c) => ({
      ...c,
    }));

    // Resolve unresolved fuel types from energy + emissions steps
    const unresolvedSet = new Set<string>();
    for (const u of energyRes.unresolved_fuel_types) unresolvedSet.add(u.fuel_type);
    for (const u of emissionsRes.unresolved_fuel_types) unresolvedSet.add(u.fuel_type);

    const result: FuelEuCalculationResult = {
      calculation_version: FUELEU_CALCULATION_VERSION,
      parameter_version: paramVer,
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,
      status: "draft",
      deliveries_used: deliveriesUsed,
      deliveries_total: input.deliveries.length,
      energy_input_mj: Math.round(energyRes.total_energy_mj * 10000) / 10000,
      total_wtw_emissions_gco2e: Math.round(emissionsRes.total_wtw_emissions_gco2e * 10000) / 10000,
      ghg_intensity_gco2e_per_mj: intensityRes.ghg_intensity_gco2e_per_mj,
      target_gco2e_per_mj: complianceRes.target_gco2e_per_mj,
      reduction_pct: complianceRes.reduction_pct,
      compliance_balance: complianceRes.compliance_balance,
      surplus_or_deficit: complianceRes.surplus_or_deficit,
      biofuel_energy_mj: Math.round(bioRes.biofuel_energy_mj * 10000) / 10000,
      fossil_energy_mj: Math.round(bioRes.fossil_energy_mj * 10000) / 10000,
      iscc_missing_flag: bioRes.iscc_missing_flag,
      iscc_missing_details: bioRes.iscc_missing_details.map((d) => ({ ...d })),
      ops_energy_mj: opsRes.ops_energy_mj,
      ops_data_available: opsRes.ops_data_available,
      penalty_exposure_estimate: penaltyRes.penalty_estimate_eur,
      penalty_formula_version: penaltyRes.penalty_formula_version,
      penalty_is_estimate: penaltyRes.is_estimate,
      contributions: finalContributions,
      fuel_delivery_ids: fuelDeliveryIds,
      calculated_at: ts,
    };

    return result;
  }

  /**
   * Calculate and persist a FuelEU result.
   */
  async calculateAndSave(input: FuelEuCalculationInput): Promise<FuelEuCalculationResult> {
    const result = await this.calculate(input);

    const record: FuelEuRecordInsert = {
      vessel_id: result.vessel_id,
      reporting_year: result.reporting_year,
      calculation_version: result.calculation_version,
      status: result.status,
      energy_input_mj: result.energy_input_mj,
      total_wtw_emissions_gco2e: result.total_wtw_emissions_gco2e,
      ghg_intensity_gco2e_per_mj: result.ghg_intensity_gco2e_per_mj,
      target_gco2e_per_mj: result.target_gco2e_per_mj,
      compliance_balance: result.compliance_balance,
      surplus_or_deficit: result.surplus_or_deficit,
      penalty_exposure_estimate: result.penalty_exposure_estimate,
      penalty_formula_version: result.penalty_formula_version,
      biofuel_energy_mj: result.biofuel_energy_mj,
      fossil_energy_mj: result.fossil_energy_mj,
      iscc_missing_flag: result.iscc_missing_flag,
      iscc_missing_details: result.iscc_missing_details as unknown[],
      ops_energy_mj: result.ops_energy_mj,
      ops_data_available: result.ops_data_available,
      parameter_version: result.parameter_version,
      calculation_details: {
        calculation_version: result.calculation_version,
        contributions: result.contributions.map((c) => ({
          fuel_delivery_id: c.fuel_delivery_id,
          fuel_type: c.fuel_type,
          energy_mj: c.energy_mj,
          wtw_factor_source: c.wtw_factor_source,
          wtw_emissions_gco2e: c.wtw_emissions_gco2e,
        })),
        unresolved_fuel_types: [],
        parameter_version: result.parameter_version,
        calculated_at: result.calculated_at,
      },
      calculated_at: result.calculated_at,
    };

    await this.repo.upsert(record);
    return result;
  }

  /**
   * Retrieve a previously calculated FuelEU record for a vessel × year.
   */
  async getRecord(vesselId: string, year: number): Promise<FuelEuCalculationResult | null> {
    const row = await this.repo.findByVesselAndYear(vesselId, year);
    if (!row) return null;

    return {
      calculation_version: row.calculation_version,
      parameter_version: row.parameter_version,
      vessel_id: row.vessel_id,
      reporting_year: row.reporting_year,
      status: row.status as FuelEuCalculationResult["status"],
      deliveries_used: 0,
      deliveries_total: 0,
      energy_input_mj: row.energy_input_mj,
      total_wtw_emissions_gco2e: row.total_wtw_emissions_gco2e,
      ghg_intensity_gco2e_per_mj: row.ghg_intensity_gco2e_per_mj,
      target_gco2e_per_mj: row.target_gco2e_per_mj,
      reduction_pct: 1 - row.target_gco2e_per_mj / 91.16,
      compliance_balance: row.compliance_balance,
      surplus_or_deficit: row.surplus_or_deficit as FuelEuCalculationResult["surplus_or_deficit"],
      biofuel_energy_mj: row.biofuel_energy_mj,
      fossil_energy_mj: row.fossil_energy_mj,
      iscc_missing_flag: row.iscc_missing_flag,
      iscc_missing_details: (row.iscc_missing_details as unknown as Array<{ fuel_delivery_id: string; fuel_type: string; supplier: string }>) ?? [],
      ops_energy_mj: row.ops_energy_mj,
      ops_data_available: row.ops_data_available,
      penalty_exposure_estimate: row.penalty_exposure_estimate,
      penalty_formula_version: row.penalty_formula_version,
      penalty_is_estimate: true,
      contributions: [],
      fuel_delivery_ids: [],
      calculated_at: row.calculated_at,
    };
  }
}
