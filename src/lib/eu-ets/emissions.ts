import { getFuelEmissionInfo } from "@/lib/fuel-delivery/emission-factors";

export interface EtsEmissionResult {
  readonly total_ttw_co2_kg: number;
  readonly total_ttw_co2_tonnes: number;
  readonly deliveries_used: number;
  readonly unresolved_fuel_types: ReadonlyArray<{
    fuel_type: string;
    delivery_id: string;
  }>;
}

/**
 * Compute Tank-to-Wake CO₂ from fuel deliveries using the fuel-delivery
 * module's emission factors (kg CO₂ per kg fuel).
 *
 * quantity_mt × 1000 × co2_factor = kg CO₂
 * kg CO₂ / 1000 = tonnes CO₂
 */
export function computeEtsEmissions(
  deliveries: ReadonlyArray<{
    id: string;
    fuel_type: string;
    quantity_mt: number;
  }>,
): EtsEmissionResult {
  let totalKg = 0;
  let used = 0;
  const unresolved: Array<{ fuel_type: string; delivery_id: string }> = [];

  for (const d of deliveries) {
    const info = getFuelEmissionInfo(d.fuel_type);
    if (!info) {
      unresolved.push({ fuel_type: d.fuel_type, delivery_id: d.id });
      continue;
    }
    const kg = d.quantity_mt * 1000 * info.co2_factor;
    totalKg += kg;
    used++;
  }

  return {
    total_ttw_co2_kg: totalKg,
    total_ttw_co2_tonnes: totalKg / 1000,
    deliveries_used: used,
    unresolved_fuel_types: unresolved,
  };
}
