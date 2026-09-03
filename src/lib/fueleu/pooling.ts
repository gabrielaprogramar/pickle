/**
 * fuelEu/pooling.ts — deterministic FuelEU Maritime pooling support
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 3 replaces the Phase-2C trivial pooling stub with a small, deterministic,
 * rule-aware module. It computes a vessel's poolable (surplus) balance and lets
 * the pipeline build a pool snapshot from evidenced in-scope results. Where a
 * deficit cannot be satisfied by verified pool surplus, the compliance engine
 * returns POOLING_REQUIRES_REVIEW — never a fabricated success.
 *
 * This module is PURE/deterministic.
 */

import type { VesselPoolingPosition, ComplianceSign } from "@/lib/fueleu/types";

/** A vessel's poolable surplus (gCO₂e/MJ·MJ → surplus units). NULL only when balance unresolved. */
export function computePoolableBalance(
  complianceBalance: number | null,
  surplusOrDeficit: ComplianceSign | null,
): number | null {
  if (complianceBalance === null || surplusOrDeficit === null) return null;
  // Poolable only when there is a resolved, positive surplus.
  return surplusOrDeficit === "surplus" ? Math.max(0, complianceBalance) : null;
}

export interface PoolingResult {
  readonly poolable_balance: number | null;
  readonly surplus_or_deficit: ComplianceSign | null;
  readonly poolable: boolean;
}

export function resolvePoolingPosition(vessel: VesselPoolingPosition): PoolingResult {
  const poolable = computePoolableBalance(vessel.compliance_balance, vessel.surplus_or_deficit);
  return {
    poolable_balance: poolable,
    surplus_or_deficit: vessel.surplus_or_deficit,
    poolable: poolable !== null && poolable > 0,
  };
}

/**
 * Build a pool snapshot from a set of vessels' compliance results.
 * Only vessels with a resolvable, evidenced surplus are included; unresolved
 * (NULL) balances are excluded rather than assumed zero.
 */
export function buildPoolSnapshot(
  vessels: ReadonlyArray<VesselPoolingPosition>,
): ReadonlyArray<{ vessel_id: string; imo: string; surplus_energy_mj: number }> {
  const out: Array<{ vessel_id: string; imo: string; surplus_energy_mj: number }> = [];
  for (const v of vessels) {
    const pos = resolvePoolingPosition(v);
    if (pos.poolable && pos.poolable_balance !== null && pos.poolable_balance > 0) {
      out.push({
        vessel_id: v.vessel_id,
        imo: v.imo,
        surplus_energy_mj: pos.poolable_balance,
      });
    }
  }
  return out;
}
