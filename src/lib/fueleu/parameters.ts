/**
 * FuelEU Maritime regulatory parameter registry.
 *
 * All parameters are versioned so that past calculations remain reproducible
 * even when regulatory values are updated.
 *
 * ── Naming convention ──────────────────────────────────────────────────────
 *   - Weighted-average LHV (MJ/kg)      → lhv_mj_per_kg
 *   - Well-to-Wake GHG factor (gCO₂e/MJ) → wtw_gco2e_per_mj
 *   - Reduction target (fraction)        → reduction_target
 *   - Penalty rate (EUR per tonne VLSFOe) → penalty_eur_per_tonne
 */

export type LhvFuelCategory = "fossil" | "biofuel";

// ── Version ────────────────────────────────────────────────────────────────

/** Current parameter version. Bump when any value below changes. */
export const CURRENT_PARAMETER_VERSION = "2025.1";

// ── Baseline intensity ─────────────────────────────────────────────────────

/** FuelEU Maritime baseline GHG intensity in gCO₂e/MJ. */
export const BASELINE_GHG_INTENSITY_GCO2E_PER_MJ = 91.16;

// ── Reduction targets per calendar year ────────────────────────────────────

export interface YearReductionTarget {
  readonly year: number;
  /** Reduction percentage relative to baseline, expressed as a decimal fraction (e.g. 0.02 = 2%). */
  readonly reduction_pct: number;
  readonly label: string;
}

export const REDUCTION_TARGETS: ReadonlyArray<YearReductionTarget> = [
  { year: 2025, reduction_pct: 0.02, label: "2025-2029 (2%)" },
  { year: 2030, reduction_pct: 0.06, label: "2030-2034 (6%)" },
  { year: 2035, reduction_pct: 0.15, label: "2035-2039 (15%)" },
  { year: 2040, reduction_pct: 0.31, label: "2040-2044 (31%)" },
  { year: 2045, reduction_pct: 0.62, label: "2045-2049 (62%)" },
  { year: 2050, reduction_pct: 0.80, label: "2050+ (80%)" },
];

/**
 * Resolve the reduction target for a given reporting year.
 * Falls back to the most recent past target for years before 2025
 * (returns the first entry, which is 2025) and to the last known target
 * for years beyond the schedule.
 */
export function getReductionTarget(year: number): YearReductionTarget {
  const sorted = [...REDUCTION_TARGETS].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  if (!first) throw new Error("REDUCTION_TARGETS is empty");
  if (year <= first.year) return first;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const target = sorted[i];
    if (target && year >= target.year) return target;
  }
  return first;
}

/** Compute the target GHG intensity for a given year: baseline × (1 - reduction). */
export function computeTargetIntensity(year: number): number {
  const target = getReductionTarget(year);
  return BASELINE_GHG_INTENSITY_GCO2E_PER_MJ * (1 - target.reduction_pct);
}

// ── LHV (Lower Heating Value) registry ─────────────────────────────────────

export interface LhvEntry {
  /** Fuel type slug as used in fuel-delivery domain. */
  readonly fuelTypeSlug: string;
  /** MJ per kg (net calorific value). */
  readonly lhv_mj_per_kg: number;
  /** Source short name (e.g. "IMO DCS", "ISO 8217", "IPCC"). */
  readonly source: string;
  /** Fuel category for aggregation (fossil or biofuel). */
  readonly category: LhvFuelCategory;
}

export const LHV_REGISTRY: ReadonlyArray<LhvEntry> = [
  // Heavy Fuel Oil
  { fuelTypeSlug: "hfo_rme180", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "hfo_rmk380", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "hfo_rmd80",  lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  // Marine Gas Oil
  { fuelTypeSlug: "mgo_dma",    lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "mgo_dmz",    lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "mdo_dmb",    lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "fossil" },
  // Very Low Sulphur
  { fuelTypeSlug: "vlsfo_rme180", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "vlsfo_rmk380", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  // Ultra Low Sulphur
  { fuelTypeSlug: "ulfso_rme180", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "ulfso_rmk380", lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "fossil" },
  // Distillates — low/ultra-low sulphur
  { fuelTypeSlug: "lsmgo",       lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "ulsfo",       lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "fossil" },
  // LNG
  { fuelTypeSlug: "lng",         lhv_mj_per_kg: 50.0, source: "IMO DCS", category: "fossil" },
  { fuelTypeSlug: "lpg",         lhv_mj_per_kg: 46.0, source: "IMO DCS", category: "fossil" },
  // Biofuels
  { fuelTypeSlug: "bio_hfo",     lhv_mj_per_kg: 40.5, source: "IMO DCS", category: "biofuel" },
  { fuelTypeSlug: "bio_mgo",     lhv_mj_per_kg: 42.7, source: "IMO DCS", category: "biofuel" },
  { fuelTypeSlug: "methanol",    lhv_mj_per_kg: 19.9, source: "IPCC",     category: "fossil" },
  { fuelTypeSlug: "ammonia",     lhv_mj_per_kg: 18.6, source: "IPCC",     category: "fossil" },
  { fuelTypeSlug: "hydrogen",    lhv_mj_per_kg: 120.0,source: "IPCC",     category: "fossil" },
];

/**
 * Look up the LHV entry for a given fuel type slug.
 * Returns `undefined` when the fuel type is not in the registry.
 */
export function getLhv(slug: string): LhvEntry | undefined {
  return LHV_REGISTRY.find((e) => e.fuelTypeSlug === slug);
}

// ── WtW (Well-to-Wake) GHG factor registry ─────────────────────────────────

export interface WtwEntry {
  readonly fuelTypeSlug: string;
  /** Well-to-wake gCO₂e per MJ. */
  readonly wtw_gco2e_per_mj: number;
  /** Source reference. */
  readonly source: string;
}

export const WTW_REGISTRY: ReadonlyArray<WtwEntry> = [
  // Fossil HFO
  { fuelTypeSlug: "hfo_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "hfo_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "hfo_rmd80",  wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  // Fossil MGO/MDO
  { fuelTypeSlug: "mgo_dma",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "mgo_dmz",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "mdo_dmb",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)" },
  // VLSFO
  { fuelTypeSlug: "vlsfo_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "vlsfo_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  // ULSFO
  { fuelTypeSlug: "ulfso_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "ulfso_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)" },
  // Low/ultra-low sulphur distillates
  { fuelTypeSlug: "lsmgo", wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)" },
  { fuelTypeSlug: "ulsfo", wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)" },
  // LNG
  { fuelTypeSlug: "lng",   wtw_gco2e_per_mj: 76.0, source: "FuelEU MRV (2023)" },
  // LPG
  { fuelTypeSlug: "lpg",   wtw_gco2e_per_mj: 81.5, source: "FuelEU MRV (2023)" },
  // Biofuels — default (ISCC-certified) factors
  { fuelTypeSlug: "bio_hfo", wtw_gco2e_per_mj: 20.5, source: "FuelEU MRV (2023) — ISCC default" },
  { fuelTypeSlug: "bio_mgo", wtw_gco2e_per_mj: 19.8, source: "FuelEU MRV (2023) — ISCC default" },
  // Methanol (from natural gas)
  { fuelTypeSlug: "methanol",  wtw_gco2e_per_mj: 81.0, source: "IPCC" },
  // Ammonia (from natural gas)
  { fuelTypeSlug: "ammonia",   wtw_gco2e_per_mj: 82.0, source: "IPCC" },
  // Hydrogen (from natural gas / SMR)
  { fuelTypeSlug: "hydrogen",  wtw_gco2e_per_mj: 85.0, source: "IPCC" },
];

export function getWtwFactor(slug: string): WtwEntry | undefined {
  return WTW_REGISTRY.find((e) => e.fuelTypeSlug === slug);
}

// ── Penalty formula registry ───────────────────────────────────────────────

export interface PenaltyFormulaEntry {
  readonly version: string;
  /** Base penalty EUR per tonne of VLSFO-equivalent deficit. */
  readonly penalty_eur_per_tonne: number;
  /** Default VLSFO emission factor used to convert deficit to tonnes VLSFOe. */
  readonly vlsfo_emission_factor_gco2e_per_mj: number;
  /** Default VLSFO energy content (MJ per tonne) used for deficit conversion. */
  readonly vlsfo_energy_mj_per_tonne: number;
  /** Human-readable label. */
  readonly label: string;
  /** Whether this formula produces an estimate. */
  readonly is_estimate: boolean;
}

export const PENALTY_FORMULAS: ReadonlyArray<PenaltyFormulaEntry> = [
  {
    version: "2025.1",
    penalty_eur_per_tonne: 2400,
    vlsfo_emission_factor_gco2e_per_mj: 87.5,
    vlsfo_energy_mj_per_tonne: 40500,
    label: "Default FuelEU Maritime penalty formula (estimate)",
    is_estimate: true,
  },
];

export function getPenaltyFormula(version: string = "2025.1"): PenaltyFormulaEntry | undefined {
  return PENALTY_FORMULAS.find((f) => f.version === version);
}
