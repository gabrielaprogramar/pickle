import { computeTargetIntensity } from "@/lib/fueleu/parameters";
import type { ComplianceSign } from "@/lib/fueleu/types";

export interface ComplianceResult {
  readonly actual_intensity_gco2e_per_mj: number;
  readonly target_gco2e_per_mj: number;
  readonly reduction_pct: number;
  readonly compliance_balance: number;
  readonly surplus_or_deficit: ComplianceSign;
}

/**
 * Compute FuelEU compliance position.
 *
 * Sign convention:
 *   compliance_balance = target - actual
 *     positive → surplus (vessel is under target)
 *     negative → deficit (vessel exceeds target)
 *
 * @param actualIntensity — annual GHG intensity in gCO₂e/MJ
 * @param reportingYear — calendar year for target lookup
 */
export function computeCompliance(
  actualIntensity: number,
  reportingYear: number,
): ComplianceResult {
  const target = computeTargetIntensity(reportingYear);
  const reductionTarget = 1 - target / 91.16; // derive reduction from baseline
  const balance = target - actualIntensity;

  let sign: ComplianceSign = "zero";
  if (balance > 0) sign = "surplus";
  else if (balance < 0) sign = "deficit";

  return {
    actual_intensity_gco2e_per_mj: actualIntensity,
    target_gco2e_per_mj: target,
    reduction_pct: Math.round(reductionTarget * 10000) / 10000,
    compliance_balance: Math.round(balance * 1000000) / 1000000,
    surplus_or_deficit: sign,
  };
}
