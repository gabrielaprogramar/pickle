/**
 * fuelEu/penalty.ts — FuelEU Maritime penalty (ESTIMATE vs ACTUAL ASSESSED)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Penalty parameters are NO LONGER hardcoded here — they come from the
 * versioned `fueleu_penalty` rule resolved by the pipeline and injected as
 * arguments, so past calculations stay reproducible and legal values are fully
 * attributable to a versioned rule (seeded with REQUIRES REGULATORY
 * VERIFICATION).
 *
 * This module is PURE/deterministic. The result is always an ESTIMATE unless
 * a formally assessed figure is supplied out-of-band.
 */

export interface FuelEuPenaltyInput {
  /** Deficit intensity (gCO₂e/MJ) — the positive magnitude of a negative compliance balance. */
  readonly deficit_gco2e_per_mj: number;
  /** Total (scope-weighted) energy counted into FuelEU, MJ. */
  readonly total_energy_mj: number;
  /** Penalty rate in EUR per tonne of VLSFO-equivalent, from the rule. Null → cannot estimate. */
  readonly penalty_eur_per_tonne_vlsfoe: number | null;
  /** Version of the penalty rule/formula that produced the estimate. */
  readonly formula_version?: string | null;
}

export interface FuelEuPenaltyResult {
  readonly penalty_exposure_estimate_eur: number | null;
  readonly penalty_formula_version: string | null;
  readonly is_estimate: boolean;
  readonly requ_verification: boolean;
}

const VLSFO_EMISSION_FACTOR_GCO2E_PER_MJ = 87.5; // REQUIRES REGULATORY VERIFICATION
const VLSFO_ENERGY_MJ_PER_TONNE = 40_500; // REQUIRES REGULATORY VERIFICATION

/**
 * Estimate FuelEU penalty exposure for an in-deficit vessel:
 *
 *   excess_gco2e      = deficit_gco2e_per_mj × total_energy_mj
 *   tonnes_vlsfoe     = excess_gco2e / vlsfo_factor / 1e6
 *   penalty_estimate  = tonnes_vlsfoe × penalty_eur_per_tonne
 *
 * Always an ESTIMATE; a formally assessed figure must be supplied separately.
 */
export function estimateFuelEuPenalty(
  input: FuelEuPenaltyInput,
): number | null {
  if (input.penalty_eur_per_tonne_vlsfoe === null) return null;
  if (input.deficit_gco2e_per_mj <= 0 || input.total_energy_mj <= 0) return null;

  const excess_gco2e = input.deficit_gco2e_per_mj * input.total_energy_mj;
  const deficit_mj = excess_gco2e / VLSFO_EMISSION_FACTOR_GCO2E_PER_MJ;
  const tonnes_vlsfoe = deficit_mj / VLSFO_ENERGY_MJ_PER_TONNE;
  const penalty = tonnes_vlsfoe * input.penalty_eur_per_tonne_vlsfoe;
  return Math.round(penalty * 100) / 100;
}

export function buildPenaltyResult(
  input: FuelEuPenaltyInput,
  penalty_assessed_eur: number | null,
): FuelEuPenaltyResult {
  // A formally assessed figure supersedes the estimate and is not an estimate.
  if (penalty_assessed_eur !== null) {
    return {
      penalty_exposure_estimate_eur: penalty_assessed_eur,
      penalty_formula_version: input.formula_version ?? null,
      is_estimate: false,
      requ_verification: false,
    };
  }
  const est = estimateFuelEuPenalty(input);
  return {
    penalty_exposure_estimate_eur: est,
    penalty_formula_version: input.formula_version ?? null,
    is_estimate: true,
    requ_verification: true,
  };
}
