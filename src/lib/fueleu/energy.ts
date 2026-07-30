import type { FuelDeliveryRow } from "@/lib/supabase/types";
import { getLhv } from "@/lib/fueleu/parameters";
import type { FuelEuDeliveryContribution } from "@/lib/fueleu/types";

export interface EnergyResult {
  readonly contributions: ReadonlyArray<FuelEuDeliveryContribution>;
  readonly total_energy_mj: number;
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly unresolved_fuel_types: ReadonlyArray<{
    fuel_type: string;
    fuel_delivery_id: string;
  }>;
}

export function computeEnergyContributions(
  deliveries: ReadonlyArray<FuelDeliveryRow>,
): EnergyResult {
  const contributions: FuelEuDeliveryContribution[] = [];
  const unresolved: Array<{ fuel_type: string; fuel_delivery_id: string }> = [];
  let total = 0;
  let bio = 0;
  let fossil = 0;

  for (const d of deliveries) {
    const lhv = getLhv(d.fuel_type);
    if (!lhv) {
      unresolved.push({ fuel_type: d.fuel_type, fuel_delivery_id: d.id });
      continue;
    }

    const quantity_kg = d.quantity_mt * 1000;
    const energy_mj = quantity_kg * lhv.lhv_mj_per_kg;
    const is_bio = lhv.category === "biofuel";

    contributions.push({
      fuel_delivery_id: d.id,
      fuel_type: d.fuel_type,
      quantity_mt: d.quantity_mt,
      quantity_kg,
      lhv_mj_per_kg: lhv.lhv_mj_per_kg,
      lhv_source: lhv.source,
      energy_mj,
      wtw_factor_gco2e_per_mj: 0,
      wtw_factor_source: "",
      wtw_emissions_gco2e: 0,
      is_biofuel: is_bio,
    });

    total += energy_mj;
    if (is_bio) bio += energy_mj;
    else fossil += energy_mj;
  }

  return {
    contributions,
    total_energy_mj: total,
    biofuel_energy_mj: bio,
    fossil_energy_mj: fossil,
    unresolved_fuel_types: unresolved,
  };
}
