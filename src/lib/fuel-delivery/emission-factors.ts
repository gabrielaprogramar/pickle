/**
 * Emission factor registry for fuel types.
 * All values are deterministic and sourced from IMO GHG Study, IPCC, and
 * MARPOL Annex VI default factors. These are the audited reference values
 * used for all compliance calculations.
 *
 * Every factor includes a source reference for auditability.
 */

export interface EmissionFactors {
  readonly co2: number;
  readonly sox: number;
  readonly pm: number;
}

export interface FuelEmissionInfo {
  readonly co2_factor: number;
  readonly sox_factor: number;
  readonly pm_factor: number;
  readonly density_default: number | null;
  readonly display_name: string;
  readonly source: string;
}

const DEFAULT_SOURCE = "IMO GHG Study / IPCC 2006 Guidelines";

const DEFAULT_EMISSION_FACTORS: Record<string, FuelEmissionInfo> = {
  hfo_380:  { co2_factor: 3.114, sox_factor: 0.020, pm_factor: 0.0020, density_default: 991.0, display_name: "HFO 380", source: DEFAULT_SOURCE },
  hfo_180:  { co2_factor: 3.114, sox_factor: 0.020, pm_factor: 0.0018, density_default: 985.0, display_name: "HFO 180", source: DEFAULT_SOURCE },
  hfo:      { co2_factor: 3.114, sox_factor: 0.020, pm_factor: 0.0018, density_default: 988.0, display_name: "HFO (general)", source: DEFAULT_SOURCE },
  rmg_380:  { co2_factor: 3.114, sox_factor: 0.020, pm_factor: 0.0020, density_default: 991.0, display_name: "RMG 380", source: DEFAULT_SOURCE },
  rmk_380:  { co2_factor: 3.114, sox_factor: 0.020, pm_factor: 0.0020, density_default: 991.0, display_name: "RMK 380", source: DEFAULT_SOURCE },
  vlsfo:    { co2_factor: 3.151, sox_factor: 0.005, pm_factor: 0.0010, density_default: 920.0, display_name: "VLSFO", source: DEFAULT_SOURCE },
  ulsfo:    { co2_factor: 3.151, sox_factor: 0.001, pm_factor: 0.0008, density_default: 900.0, display_name: "ULSFO", source: DEFAULT_SOURCE },
  lsmgo:    { co2_factor: 3.206, sox_factor: 0.001, pm_factor: 0.0005, density_default: 890.0, display_name: "LSMGO", source: DEFAULT_SOURCE },
  mgo:      { co2_factor: 3.206, sox_factor: 0.010, pm_factor: 0.0005, density_default: 890.0, display_name: "MGO", source: DEFAULT_SOURCE },
  mdo:      { co2_factor: 3.206, sox_factor: 0.010, pm_factor: 0.0005, density_default: 895.0, display_name: "MDO", source: DEFAULT_SOURCE },
  lng:      { co2_factor: 2.750, sox_factor: 0.000, pm_factor: 0.0000, density_default: 460.0, display_name: "LNG", source: "IMO GHG Study / ISO 13600" },
  lpg:      { co2_factor: 3.000, sox_factor: 0.000, pm_factor: 0.0000, density_default: 540.0, display_name: "LPG", source: DEFAULT_SOURCE },
  methanol: { co2_factor: 1.375, sox_factor: 0.000, pm_factor: 0.0000, density_default: 793.0, display_name: "Methanol", source: "IMO Methanol Institute / ICCT" },
  biodiesel:{ co2_factor: 2.850, sox_factor: 0.001, pm_factor: 0.0003, density_default: 880.0, display_name: "Biodiesel (B100)", source: "EU JRC / RED II default" },
  b30:      { co2_factor: 3.061, sox_factor: 0.004, pm_factor: 0.0008, density_default: 910.0, display_name: "B30 (30% bio)", source: "Weighted blend calc from HFO + B100" },
  hydrogen: { co2_factor: 0.000, sox_factor: 0.000, pm_factor: 0.0000, density_default: null, display_name: "Hydrogen", source: "IMO GHG Study (TtW zero)" },
  ammonia:  { co2_factor: 0.000, sox_factor: 0.000, pm_factor: 0.0000, density_default: 680.0, display_name: "Ammonia", source: "IMO GHG Study (TtW zero)" },
};

/** Default fallback for unknown fuel types (assume MGO-like). */
const FALLBACK_INFO: FuelEmissionInfo = {
  co2_factor: 3.206,
  sox_factor: 0.010,
  pm_factor: 0.0005,
  density_default: 890.0,
  display_name: "Unknown",
  source: "POSL defaults (MGO proxy)",
};

/** Get emission info for a given fuel type key. */
export function getFuelEmissionInfo(fuelType: string): FuelEmissionInfo {
  return DEFAULT_EMISSION_FACTORS[fuelType] ?? FALLBACK_INFO;
}

/**
 * Calculate CO₂ emitted from burning a given quantity of fuel.
 * @param fuelType - Normalized fuel type key.
 * @param quantityMt - Quantity in metric tonnes.
 * @returns CO₂ in metric tonnes.
 */
export function calculateCo2(fuelType: string, quantityMt: number): number {
  const info = getFuelEmissionInfo(fuelType);
  return quantityMt * info.co2_factor;
}

/**
 * Calculate SO₂ equivalent emitted, accounting for actual sulphur content
 * when available. When sulphur content is known, SOx is calculated from
 * the actual S% rather than the factor's default.
 * @param fuelType - Normalized fuel type key.
 * @param quantityMt - Quantity in metric tonnes.
 * @param sulphurContentPct - Actual sulphur content % (optional).
 * @returns SOx in metric tonnes.
 */
export function calculateSox(
  fuelType: string,
  quantityMt: number,
  sulphurContentPct?: number | null,
): number {
  const info = getFuelEmissionInfo(fuelType);
  const effectiveSoxFactor = sulphurContentPct != null
    ? info.sox_factor * (sulphurContentPct / 1.0)
    : info.sox_factor;
  return quantityMt * effectiveSoxFactor;
}

/**
 * Calculate PM emitted from burning a given quantity of fuel.
 * PM factors are general estimates; actual PM depends on engine type,
 * load, and abatement technology.
 * @param fuelType - Normalized fuel type key.
 * @param quantityMt - Quantity in metric tonnes.
 * @returns PM in metric tonnes.
 */
export function calculatePm(fuelType: string, quantityMt: number): number {
  const info = getFuelEmissionInfo(fuelType);
  return quantityMt * info.pm_factor;
}

/**
 * Calculate total emissions (CO₂ + SOx + PM) for a fuel delivery.
 * Returns individual components and the total CO₂e (using GWP-100,
 * though SOx and PM are not typically included in CO₂e — this is
 * provided for reporting convenience).
 */
export function calculateTotalEmissions(
  fuelType: string,
  quantityMt: number,
  sulphurContentPct?: number | null,
): {
  co2: number;
  sox: number;
  pm: number;
} {
  return {
    co2: calculateCo2(fuelType, quantityMt),
    sox: calculateSox(fuelType, quantityMt, sulphurContentPct),
    pm: calculatePm(fuelType, quantityMt),
  };
}
