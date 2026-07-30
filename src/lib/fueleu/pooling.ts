import type { VesselPoolingPosition, ComplianceSign } from "@/lib/fueleu/types";

/**
 * FuelEU Maritime pooling.
 *
 * Vessels with a surplus can pool their excess compliance with vessels in
 * deficit within the same company pool. The poolable balance is the lesser
 * of the surplus and the remaining pool capacity (simplified model).
 *
 * NOTE: Full pooling logic (multi-vessel optimisation, pool cap management,
 * pool agreement versioning) is out of scope for Phase 2C.2. This module
 * provides the building block for a future pooling engine.
 */

/**
 * Compute the poolable balance for a single vessel.
 * For a surplus vessel the entire surplus is poolable.
 * For a deficit vessel the poolable balance is zero (it needs to receive).
 */
export function computePoolableBalance(
  complianceBalance: number,
  surplusOrDeficit: ComplianceSign,
): number {
  if (surplusOrDeficit === "surplus") {
    return Math.max(0, complianceBalance);
  }
  return 0;
}

export interface PoolingResult {
  readonly poolable_balance: number;
  readonly surplus_or_deficit: ComplianceSign;
}

/**
 * Resolve pooling position for a vessel.
 */
export function resolvePoolingPosition(
  vessel: VesselPoolingPosition,
): PoolingResult {
  return {
    poolable_balance: computePoolableBalance(
      vessel.compliance_balance,
      vessel.surplus_or_deficit,
    ),
    surplus_or_deficit: vessel.surplus_or_deficit,
  };
}
