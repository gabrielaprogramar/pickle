/**
 * fuelEu/energy.ts — canonical energy attribution for FuelEU
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 3 rewires FuelEU so the SINGLE authoritative source of voyage energy is
 * the Part 1 canonical `voyage_consumption` model (attributed from noon-report
 * intervals, ROB deltas and BDN deliveries, NEVER equal-share and NEVER
 * `fuel_deliveries.quantity_mt` treated as consumption).
 *
 * This module is PURE/deterministic: it turns canonical consumption rows into
 * per-fuel energy contributions using the versioned LHV registry. Unknown fuel
 * types are surfaced (contributing zero energy but flagged) — never silently
 * treated as a defined fuel.
 */

import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import { getLhv } from "@/lib/fueleu/parameters";
import type { FuelEuEnergyContribution } from "@/lib/fueleu/types";

export interface FuelEuEnergyResult {
  readonly contributions: ReadonlyArray<FuelEuEnergyContribution>;
  readonly total_energy_mj: number;
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly unresolved_fuel_types: ReadonlyArray<string>;
}

/**
 * Compute energy contributions from canonical per-voyage fuel consumption.
 * A BLOCKED / INSUFFICIENT_DATA / zero-quantity row yields no positive energy
 * (the voyage is surfaced upstream as unresolved), so this never fabricates a
 * number from absence of evidence.
 */
export function computeFuelEuEnergy(
  consumption: ReadonlyArray<VoyageConsumptionRow>,
): FuelEuEnergyResult {
  const contributions: FuelEuEnergyContribution[] = [];
  const unresolvedSet = new Set<string>();
  let total = 0;
  let bio = 0;
  let fossil = 0;

  for (const row of consumption) {
    const isBlocked =
      row.status === "BLOCKED" ||
      row.method === "INSUFFICIENT_DATA" ||
      row.quantity_mt <= 0;
    const lhv = getLhv(row.fuel_type);

    if (!lhv || isBlocked) {
      if (!lhv) unresolvedSet.add(row.fuel_type);
      contributions.push({
        voyage_id: row.voyage_id,
        fuel_type: row.fuel_type,
        quantity_mt: row.quantity_mt,
        method: row.method,
        confidence: row.confidence,
        status: row.status,
        lhv_mj_per_kg: lhv?.lhv_mj_per_kg ?? 0,
        lhv_source: lhv ? lhv.source : "UNKNOWN",
        energy_mj: 0,
        wtw_factor_gco2e_per_mj: 0,
        wtw_factor_source: "",
        wtw_emissions_gco2e: 0,
        is_biofuel: (lhv?.category ?? "fossil") === "biofuel",
        biofuel_status: isBlocked ? "UNRESOLVED" : null,
      });
      continue;
    }

    const quantity_kg = row.quantity_mt * 1000;
    const energy_mj = quantity_kg * lhv.lhv_mj_per_kg;
    const is_bio = lhv.category === "biofuel";

    contributions.push({
      voyage_id: row.voyage_id,
      fuel_type: row.fuel_type,
      quantity_mt: row.quantity_mt,
      method: row.method,
      confidence: row.confidence,
      status: row.status,
      lhv_mj_per_kg: lhv.lhv_mj_per_kg,
      lhv_source: lhv.source,
      energy_mj,
      wtw_factor_gco2e_per_mj: 0,
      wtw_factor_source: "",
      wtw_emissions_gco2e: 0,
      is_biofuel: is_bio,
      biofuel_status: null,
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
    unresolved_fuel_types: Array.from(unresolvedSet),
  };
}
