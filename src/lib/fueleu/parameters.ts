/**
 * FuelEU Maritime fuel physics + parameter version registry.
 *
 * ── Scope of this module ───────────────────────────────────────────────────
 * Part 3 moves REGULATORY year-schedules (baseline intensity, per-year
 * reduction targets, penalty rates/formulas) OUT of hardcoded constants and
 * INTO the Part 1 versioned `regulatory_rules` foundation (seeded by
 * `0021_repair_fueleu_pipeline.sql` as `FUEL_EU` rules). Those values are
 * resolved at runtime by the FuelEU pipeline and injected into the compliance
 * engine — never re-derived from literals in this file.
 *
 * This module now only keeps:
 *   • the LHV (MJ/kg) registry (fuel physics),
 *   • the WtW (gCO₂e/MJ) factor registry,
 *   • the parameter version tag.
 *
 * Legal/regulatory figures that require independent confirmation are annotated
 * REQUIRES REGULATORY VERIFICATION.
 */

export type LhvFuelCategory = "fossil" | "biofuel";

// ── Version ────────────────────────────────────────────────────────────────

/** Current parameter version. Bump when any value below changes. */
export const CURRENT_PARAMETER_VERSION = "2025.1";

// ── LHV (Lower Heating Value) registry ─────────────────────────────────────

export interface LhvEntry {
  /** Fuel type slug as used in the fuel-consumption domain. */
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
  /** Whether this value is a legal/regulatory figure needing independent verification. */
  readonly requires_regulatory_verification?: boolean;
}

/**
 * REQUIRES REGULATORY VERIFICATION: FuelEU MRV default WtW factors are legal
 * values that must be confirmed against the current delegated act before a
 * formal compliance return is filed. They are retained here for the engine to
 * produce a deterministic ESTIMATE only.
 */
export const WTW_REGISTRY: ReadonlyArray<WtwEntry> = [
  // Fossil HFO
  { fuelTypeSlug: "hfo_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "hfo_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "hfo_rmd80",  wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // Fossil MGO/MDO
  { fuelTypeSlug: "mgo_dma",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "mgo_dmz",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "mdo_dmb",    wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // VLSFO
  { fuelTypeSlug: "vlsfo_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "vlsfo_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // ULSFO
  { fuelTypeSlug: "ulfso_rme180", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "ulfso_rmk380", wtw_gco2e_per_mj: 87.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // Low/ultra-low sulphur distillates
  { fuelTypeSlug: "lsmgo", wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  { fuelTypeSlug: "ulsfo", wtw_gco2e_per_mj: 85.7, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // LNG
  { fuelTypeSlug: "lng",   wtw_gco2e_per_mj: 76.0, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // LPG
  { fuelTypeSlug: "lpg",   wtw_gco2e_per_mj: 81.5, source: "FuelEU MRV (2023)", requires_regulatory_verification: true },
  // Biofuels — default (ISCC-certified) factors
  { fuelTypeSlug: "bio_hfo", wtw_gco2e_per_mj: 20.5, source: "FuelEU MRV (2023) — ISCC default", requires_regulatory_verification: true },
  { fuelTypeSlug: "bio_mgo", wtw_gco2e_per_mj: 19.8, source: "FuelEU MRV (2023) — ISCC default", requires_regulatory_verification: true },
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
