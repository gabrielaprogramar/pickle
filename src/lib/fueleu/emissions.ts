/**
 * fuelEu/emissions.ts — well-to-wake GHG emissions for FuelEU
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WtW gCO₂e/MJ factors are the versioned FuelEU MRV factors. A fuel without a
 * defined WtW factor contributes zero emissions but is surfaced as unresolved
 * (never silently assumed to be fossil at the default intensity).
 */

import { getWtwFactor } from "@/lib/fueleu/parameters";
import type { FuelEuEnergyContribution } from "@/lib/fueleu/types";

export interface FuelEuEmissionsResult {
  readonly contributions: ReadonlyArray<FuelEuEnergyContribution>;
  readonly total_wtw_emissions_gco2e: number;
  readonly unresolved_fuel_types: ReadonlyArray<string>;
}

export function computeFuelEuEmissions(
  contributions: ReadonlyArray<FuelEuEnergyContribution>,
): FuelEuEmissionsResult {
  const updated: FuelEuEnergyContribution[] = [];
  const unresolvedSet = new Set<string>();
  let total = 0;

  for (const c of contributions) {
    if (c.energy_mj <= 0) {
      updated.push({ ...c });
      continue;
    }
    const factor = getWtwFactor(c.fuel_type);
    if (!factor) {
      unresolvedSet.add(c.fuel_type);
      updated.push({ ...c });
      continue;
    }
    const wtw = c.energy_mj * factor.wtw_gco2e_per_mj;
    total += wtw;
    updated.push({
      ...c,
      wtw_factor_gco2e_per_mj: factor.wtw_gco2e_per_mj,
      wtw_factor_source: factor.source,
      wtw_emissions_gco2e: wtw,
    });
  }

  return {
    contributions: updated,
    total_wtw_emissions_gco2e: total,
    unresolved_fuel_types: Array.from(unresolvedSet),
  };
}
