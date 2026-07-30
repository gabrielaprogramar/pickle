import { getPenaltyFormula } from "@/lib/fueleu/parameters";
import { getReductionTarget } from "@/lib/fueleu/parameters";

export interface PenaltyResult {
  readonly penalty_estimate_eur: number | null;
  readonly penalty_formula_version: string | null;
  readonly is_estimate: boolean;
}

/**
 * Estimate FuelEU penalty exposure.
 *
 * Penalty applies only when the vessel is in deficit:
 *   deficit_gco2e_per_mj × total_energy_mj = total_excess_gco2e
 *   tonnes_vlsfoe = total_excess_gco2e / vlsfo_factor_gco2e_per_mj / 1000000
 *   penalty = tonnes_vlsfoe × penalty_rate_eur_per_tonne
 *
 * All penalty calculations are ESTIMATES. The result is marked accordingly
 * and the formula version is persisted for auditability.
 */
export function estimatePenalty(
  complianceBalance: number,
  totalEnergyMj: number,
  formulaVersion: string = "2025.1",
): PenaltyResult {
  if (complianceBalance >= 0) {
    return { penalty_estimate_eur: null, penalty_formula_version: null, is_estimate: true };
  }

  const formula = getPenaltyFormula(formulaVersion);
  if (!formula) {
    return { penalty_estimate_eur: null, penalty_formula_version: null, is_estimate: true };
  }

  const deficit_gco2e_per_mj = Math.abs(complianceBalance);
  const total_excess_gco2e = deficit_gco2e_per_mj * totalEnergyMj;
  const deficit_mj = total_excess_gco2e / formula.vlsfo_emission_factor_gco2e_per_mj;
  const tonnes_vlsfoe = deficit_mj / formula.vlsfo_energy_mj_per_tonne;
  const penalty = tonnes_vlsfoe * formula.penalty_eur_per_tonne;

  return {
    penalty_estimate_eur: Math.round(penalty * 100) / 100,
    penalty_formula_version: formula.version,
    is_estimate: formula.is_estimate,
  };
}
