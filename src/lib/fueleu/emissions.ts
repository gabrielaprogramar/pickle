import type { FuelEuDeliveryContribution } from "@/lib/fueleu/types";
import { getWtwFactor } from "@/lib/fueleu/parameters";

export interface EmissionsResult {
  readonly contributions: ReadonlyArray<FuelEuDeliveryContribution>;
  readonly total_wtw_emissions_gco2e: number;
  readonly unresolved_fuel_types: ReadonlyArray<{
    fuel_type: string;
    fuel_delivery_id: string;
  }>;
}

export function computeWtwEmissions(
  contributions: ReadonlyArray<FuelEuDeliveryContribution>,
): EmissionsResult {
  const updated: FuelEuDeliveryContribution[] = [];
  const unresolved: Array<{ fuel_type: string; fuel_delivery_id: string }> = [];
  let total = 0;

  for (const c of contributions) {
    const factor = getWtwFactor(c.fuel_type);
    if (!factor) {
      unresolved.push({ fuel_type: c.fuel_type, fuel_delivery_id: c.fuel_delivery_id });
      updated.push({ ...c });
      continue;
    }

    const wtw_emissions_gco2e = c.energy_mj * factor.wtw_gco2e_per_mj;
    total += wtw_emissions_gco2e;

    updated.push({
      ...c,
      wtw_factor_gco2e_per_mj: factor.wtw_gco2e_per_mj,
      wtw_factor_source: factor.source,
      wtw_emissions_gco2e,
    });
  }

  return {
    contributions: updated,
    total_wtw_emissions_gco2e: total,
    unresolved_fuel_types: unresolved,
  };
}
