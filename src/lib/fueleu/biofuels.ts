import type { FuelEuDeliveryContribution } from "@/lib/fueleu/types";

export interface BiofuelResult {
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly iscc_missing_flag: boolean;
  readonly iscc_missing_details: ReadonlyArray<{
    fuel_delivery_id: string;
    fuel_type: string;
    supplier: string;
  }>;
}

export function analyseBiofuels(
  contributions: ReadonlyArray<FuelEuDeliveryContribution>,
  isccMissingDeliveryIds: ReadonlySet<string> = new Set(),
): BiofuelResult {
  let bio_mj = 0;
  let fossil_mj = 0;
  const missingIscc: Array<{
    fuel_delivery_id: string;
    fuel_type: string;
    supplier: string;
  }> = [];

  for (const c of contributions) {
    if (c.is_biofuel) {
      bio_mj += c.energy_mj;
      if (isccMissingDeliveryIds.has(c.fuel_delivery_id)) {
        missingIscc.push({
          fuel_delivery_id: c.fuel_delivery_id,
          fuel_type: c.fuel_type,
          supplier: "",
        });
      }
    } else {
      fossil_mj += c.energy_mj;
    }
  }

  return {
    biofuel_energy_mj: bio_mj,
    fossil_energy_mj: fossil_mj,
    iscc_missing_flag: missingIscc.length > 0,
    iscc_missing_details: missingIscc,
  };
}
