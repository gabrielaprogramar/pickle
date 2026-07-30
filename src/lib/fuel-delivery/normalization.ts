import type { StandardFuelType } from "./types";

/**
 * Canonical mapping from raw BDN fuel type strings to the standardised
 * fuel_type key used across the Poseidon Ledger platform. This is the
 * single point of truth — any new synonym must be added here.
 */
const FUEL_SYNONYM_MAP: Record<string, StandardFuelType> = {
  "hfo": "hfo",
  "hfo380": "hfo_380",
  "hfo 380": "hfo_380",
  "hfo-380": "hfo_380",
  "hfo 180": "hfo_180",
  "hfo180": "hfo_180",
  "hfo-180": "hfo_180",
  "ifo380": "hfo_380",
  "ifo 380": "hfo_380",
  "ifo180": "hfo_180",
  "ifo 180": "hfo_180",
  "rmg380": "rmg_380",
  "rmg 380": "rmg_380",
  "rmg-380": "rmg_380",
  "rmk380": "rmk_380",
  "rmk 380": "rmk_380",
  "rmk-380": "rmk_380",
  "vlsfo": "vlsfo",
  "vlsfo 0.5": "vlsfo",
  "vlsfo 0.50": "vlsfo",
  "ulfso": "ulsfo",
  "ulsfo": "ulsfo",
  "ulsfo 0.1": "ulsfo",
  "ulsfo 0.10": "ulsfo",
  "lsmgo": "lsmgo",
  "mgo": "mgo",
  "marine gas oil": "mgo",
  "gas oil": "mgo",
  "mdo": "mdo",
  "marine diesel oil": "mdo",
  "diesel oil": "mdo",
  "lng": "lng",
  "liquefied natural gas": "lng",
  "lpg": "lpg",
  "liquefied petroleum gas": "lpg",
  "methanol": "methanol",
  "methyl alcohol": "methanol",
  "biodiesel": "biodiesel",
  "b100": "biodiesel",
  "b30": "b30",
  "b20": "b30",
  "hydrogen": "hydrogen",
  "ammonia": "ammonia",
  "nh3": "ammonia",
};

/** Fallback thresholds used when the fuel type is unknown or generic. */
export const FALLBACK_CO2_FACTOR = 3.206;
export const FALLBACK_SOX_FACTOR = 0.010;
export const FALLBACK_PM_FACTOR = 0.001;

/**
 * Normalize a raw fuel type string from a BDN to the standard key.
 * Returns the standardised key if a match is found, or the raw input
 * lowercased if no synonym is registered (caller should handle this).
 */
export function normalizeFuelType(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return FUEL_SYNONYM_MAP[cleaned] ?? cleaned;
}

/**
 * Returns true when the fuel type is a drop-in replacement that can be
 * used without engine modifications.
 */
export function isDropInFuel(fuelType: string): boolean {
  const nonDropIn: ReadonlySet<string> = new Set([
    "lng", "lpg", "methanol", "hydrogen", "ammonia",
  ]);
  return !nonDropIn.has(fuelType);
}

/**
 * Classify a fuel into its broad category.
 */
export function classifyFuel(fuelType: string): string {
  const cat: Record<string, string> = {
    hfo_380: "residual", hfo_180: "residual", hfo: "residual",
    rmg_380: "residual", rmk_380: "residual",
    vlsfo: "residual", ulsfo: "residual",
    lsmgo: "distillate", mgo: "distillate", mdo: "distillate",
    lng: "lng", lpg: "lpg",
    methanol: "methanol",
    biodiesel: "biofuel", b30: "biofuel",
    hydrogen: "hydrogen", ammonia: "ammonia",
  };
  return cat[fuelType] ?? "other";
}

/**
 * Normalize a port name for matching. Removes common prefixes/suffixes
 * and extra whitespace.
 */
export function normalizePortName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(port\s+of\s+|port\s+)/i, "")
    .replace(/^(the\s+)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
