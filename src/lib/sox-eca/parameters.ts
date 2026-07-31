/**
 * sox-eca/parameters.ts — versioned MARPOL Annex VI sulphur parameters
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Limits are NEVER hardcoded in UI or engine call-sites; they come from this
 * versioned registry so a regulatory change is a one-file, auditable change.
 *
 *   - Global sulphur cap (Reg. 14.1): 0.50% m/m
 *   - ECA sulphur cap (Reg. 14.4):    0.10% m/m
 *   - Mediterranean SOx ECA effective 2025-05-01 (IMO MEPC.361(79))
 */

import { SOX_PARAMETER_VERSION } from "./types";

export const GLOBAL_SULPHUR_LIMIT_PCT = 0.5;
export const ECA_SULPHUR_LIMIT_PCT = 0.1;
export const MED_SOX_ECA_CODE = "MED_SOX_ECA";
export const MED_SOX_ECA_EFFECTIVE_DATE = "2025-05-01";
export const MED_SOX_ECA_EFFECTIVE_FROM = "2025-05-01T00:00:00.000Z";

export interface SoxParameterSet {
  readonly version: string;
  readonly global_limit_pct: number;
  readonly eca_limit_pct: number;
  readonly eca_code: string;
  readonly eca_effective_from: string;
  readonly eca_effective_date: string;
}

export const SOX_PARAMETER_SET: Readonly<SoxParameterSet> = Object.freeze({
  version: SOX_PARAMETER_VERSION,
  global_limit_pct: GLOBAL_SULPHUR_LIMIT_PCT,
  eca_limit_pct: ECA_SULPHUR_LIMIT_PCT,
  eca_code: MED_SOX_ECA_CODE,
  eca_effective_from: MED_SOX_ECA_EFFECTIVE_FROM,
  eca_effective_date: MED_SOX_ECA_EFFECTIVE_DATE,
});

/** Deterministic: is the Med SOx ECA in force at the given timestamp? */
export function isMedSoxEcaEffective(now: string): boolean {
  const t = new Date(now).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(MED_SOX_ECA_EFFECTIVE_FROM).getTime();
}

/**
 * Applicable sulphur limit (m/m %) for a vessel at a position/time.
 * Inside the ECA and after 2025-05-01 → 0.10%; otherwise the global 0.50%.
 */
export function getApplicableSulphurLimit(insideEca: boolean, now: string): number {
  if (insideEca && isMedSoxEcaEffective(now)) return ECA_SULPHUR_LIMIT_PCT;
  return GLOBAL_SULPHUR_LIMIT_PCT;
}

/** Deterministic comparison — evidence value vs the applicable limit. */
export function isSulphurConforming(sulphurContentPct: number, limitPct: number): boolean {
  return sulphurContentPct <= limitPct;
}

export function formatSulphurLimit(limitPct: number): string {
  return `${limitPct.toFixed(2)}% m/m`;
}
