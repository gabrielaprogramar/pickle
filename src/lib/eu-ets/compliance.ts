/**
 * eu-ets/compliance.ts — deterministic EU ETS compliance state machine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 2 upgrades the EU ETS engine so it consumes the Part 1 regulatory
 * foundation (vessel facts → regulatory rules → applicability → canonical
 * voyage consumption) instead of deriving scope from GT only and distributing
 * delivery-based CO₂ by equal-share across voyages.
 *
 * The core principle enforced here: "Poseidon must never produce a precise
 * compliance number from uncertain evidence without clearly exposing that
 * uncertainty." Consequently:
 *
 *   • Applicability is NEVER silently assumed. Missing facts → UNKNOWN /
 *     REQUIRES_REVIEW.
 *   • Emissions are attributed ONLY from canonical per-voyage consumption
 *     records (`voyage_consumption`). There is NO equal-share fallback. A
 *     voyage with no consumption record contributes UNKNOWN emissions and its
 *     voyage is flagged DATA_INCOMPLETE; conflicting/insufficient records are
 *     surfaced, never silently averaged.
 *   • Unresolved EU/non-EU ports are surfaced as UNKNOWN and surfaced in
 *     `exceptions` — the voyage is not silently coerced to NON_EU.
 *   • EUA price availability is tracked separately from the physical/regulatory
 *     obligation. A missing price yields PRICE_UNAVAILABLE, never a fabricated
 *     price.
 *   • The CALCULATED obligation and the ACTUAL allowance balance are distinct
 *     concepts. Without an authoritative allowance source we do NOT imply a real
 *     balance exists.
 *
 * This module is PURE and deterministic given its inputs.
 */

import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { VoyagePortStatus } from "./port-classifier";
import { getFuelEmissionInfo } from "@/lib/fuel-delivery/emission-factors";
import { getVoyageCoverageFactor, type VoyageCoverageType } from "./parameters";

// ── Compliance status (Section 6 of the objective) ──────────────────────────

export type EtsComplianceStatus =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "UNKNOWN"
  | "REQUIRES_REVIEW"
  | "DATA_INCOMPLETE"
  | "CALCULATED"
  | "READY_FOR_REVIEW"
  | "COMPLIANT"
  | "NON_COMPLIANT";

// ── Machine-readable ETS exceptions (Section 11) ────────────────────────────

export const ETS_EXCEPTION_CODES = [
  "MISSING_VESSEL_FACTS",
  "MISSING_APPLICABILITY",
  "NOT_IN_SCOPE",
  "APPLICABILITY_UNRESOLVED",
  "MISSING_VOYAGE_PORTS",
  "UNRESOLVED_PORT",
  "MISSING_CONSUMPTION",
  "INSUFFICIENT_CONSUMPTION",
  "CONFLICTING_CONSUMPTION",
  "UNKNOWN_FUEL_TYPE",
  "MISSING_EMISSION_FACTOR",
  "PRICE_UNAVAILABLE",
  "ALLOWANCE_INCOMPLETE",
] as const;

export type EtsExceptionCode = (typeof ETS_EXCEPTION_CODES)[number];

export interface EtsException {
  readonly code: EtsExceptionCode;
  /** Human-readable explanation surfaced to the user. */
  readonly message: string;
  /** Optional targeted entity (voyage id, fuel type, etc). */
  readonly ref?: string;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export interface ConsumptionEmission {
  readonly voyage_id: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  /** Tonnes of CO₂ (TtW) attributed to this fuel on this voyage. */
  readonly ttw_co2_tonnes: number;
  readonly method: string;
  readonly confidence: string;
  readonly status: string;
  readonly factor_source: string;
}

export interface VoyageCompliance {
  readonly voyage_id: string;
  readonly departure_port: string;
  readonly arrival_port: string;
  readonly coverage_type: VoyageCoverageType | "UNKNOWN";
  readonly coverage_factor: number;
  readonly coverage_resolved: boolean;
  /** Sum of canonical consumption CO₂ for this voyage (0 when no record). */
  readonly ttw_co2_tonnes: number;
  /** ttw_co2_tonnes × coverage_factor when resolvable, else null (UNKNOWN). */
  readonly covered_co2_tonnes: number | null;
  readonly consumption_resolved: boolean;
  readonly unknown_ports: readonly string[];
  /** When set, the voyage has no/insufficient/conflicting canonical consumption. */
  readonly consumption_status: string | null;
}

export interface ComplianceInput {
  readonly vesselProfile: {
    readonly gt: number | null;
    readonly flag: string | null;
    readonly vesselType: string | null;
    readonly vesselCategory: string | null;
  };
  /** EU_ETS applicability determination, null when not yet computed. */
  readonly applicability: {
    readonly status: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN" | "REQUIRES_REVIEW";
    readonly is_decision_final: boolean;
  } | null;
  /** Canonical per-voyage consumption (voyage_consumption rows). */
  readonly consumption: readonly VoyageConsumptionRow[];
  /** Voyage geographic classification results (already classified upstream). */
  readonly voyages: ReadonlyArray<{
    readonly voyage_id: string;
    readonly departure_port: string;
    readonly arrival_port: string;
    readonly status: VoyagePortStatus;
  }>;
  readonly coverageRate: number;
  /** EUA price info. available=false → PRICE_UNAVAILABLE exception. */
  readonly price: {
    readonly available: boolean;
    readonly source: string;
    readonly value_eur: number | null;
  };
  /** True only when an authoritative allowance balance exists. */
  readonly actualAllowanceTonnes: number | null;
}

export interface ComplianceResult {
  readonly compliance_status: EtsComplianceStatus;
  readonly is_scope_resolved: boolean;
  readonly scope_applicable: boolean;
  readonly exceptions: readonly EtsException[];
  readonly perVoyageEmissions: readonly ConsumptionEmission[];
  readonly voyageCompliance: readonly VoyageCompliance[];
  readonly total_ttw_co2_tonnes: number;
  /** Sum of canonical consumption CO₂ that is fully resolvable (per-voyage). */
  readonly resolvable_ttw_co2_tonnes: number;
  /** Σ(voyage canonical CO₂ × coverage factor) over resolvable voyages. null when any in-scope covered voyage is unresolved. */
  readonly covered_co2_tonnes: number | null;
  /** EUA obligation = covered × coverageRate. null when not determinable. */
  readonly eua_obligation_tonnes: number | null;
  readonly price: {
    readonly available: boolean;
    readonly source: string;
    readonly value_eur: number | null;
  };
  readonly estimated_cost_eur: number | null;
  readonly allowance: {
    readonly calculated_obligation_tonnes: number | null;
    readonly actual_balance_tonnes: number | null;
    readonly source: "CALCULATED" | "AUTHORITATIVE" | "NONE";
  };
}

// ── Deterministic core ──────────────────────────────────────────────────────

/**
 * Evaluate EU ETS compliance from the foundation inputs. Pure: no I/O, no
 * timeline/randomness, no equal-share. Returns a fully-explainable state.
 */
export function evaluateEtsCompliance(input: ComplianceInput): ComplianceResult {
  const exceptions: EtsException[] = [];
  const perVoyageEmissions: ConsumptionEmission[] = [];
  const voyageCompliance: VoyageCompliance[] = [];
  const voyages = input.voyages ?? [];

  // ── 1. Applicability ────────────────────────────────────────────────────
  // Never assumed. Missing applicability → UNKNOWN. Unresolved → REQUIRES_REVIEW.
  if (input.applicability === null) {
    exceptions.push({
      code: "MISSING_APPLICABILITY",
      message: "EU ETS applicability has not been determined for this vessel/year.",
    });
  }

  const appStatus = input.applicability?.status ?? "UNKNOWN";
  const scopeApplicable = appStatus === "APPLICABLE";
  const isScopeResolved = appStatus === "APPLICABLE" || appStatus === "NOT_APPLICABLE";

  if (appStatus === "UNKNOWN") {
    exceptions.push({
      code: "APPLICABILITY_UNRESOLVED",
      message:
        "EU ETS applicability is UNKNOWN — missing required vessel facts (e.g. GT). No obligation can be claimed.",
    });
  } else if (appStatus === "REQUIRES_REVIEW") {
    exceptions.push({
      code: "APPLICABILITY_UNRESOLVED",
      message:
        "EU ETS applicability conflicts or needs judgement — REQUIRES_REVIEW. No obligation claimed.",
    });
  } else if (appStatus === "NOT_APPLICABLE") {
    exceptions.push({
      code: "NOT_IN_SCOPE",
      message: "Vessel is not within EU ETS surrender scope for this year.",
    });
  }

  // If there is no EU/non-EU resolution to work from, we cannot compute a
  // covered obligation.
  let coveredSum = 0;
  let uncertaintyBlocksCovered = false;

  // ── 2. Per-voyage canonical consumption → emissions ─────────────────────
  const consumptionByVoyage = groupConsumptionByVoyage(input.consumption);

  for (const v of voyages) {
    const unknownPorts = v.status.unknownPorts;
    const hasUnknownPort = v.status.type === "UNKNOWN" || unknownPorts.length > 0;

    if (!v.departure_port || !v.arrival_port) {
      exceptions.push({
        code: "MISSING_VOYAGE_PORTS",
        ref: v.voyage_id,
        message: "Voyage is missing an origin or destination port — cannot classify coverage.",
      });
    }
    if (hasUnknownPort) {
      for (const p of unknownPorts) {
        exceptions.push({
          code: "UNRESOLVED_PORT",
          ref: v.voyage_id,
          message: `Port "${p}" could not be classified as EU or non-EU — voyage coverage is unresolved.`,
        });
      }
    }

    // Canonical consumption for this voyage.
    const records = consumptionByVoyage.get(v.voyage_id) ?? [];
    let voyageCo2 = 0;
    let consumptionResolved = records.length > 0;
    let consumptionStatus: string | null = null;

    for (const rec of records) {
      const info = getFuelEmissionInfo(rec.fuel_type);
      const isKnown = DEFAULT_EMISSION_FACTOR_KNOWN(rec.fuel_type);
      if (!isKnown) {
        exceptions.push({
          code: "UNKNOWN_FUEL_TYPE",
          ref: v.voyage_id,
          message: `Fuel type "${rec.fuel_type}" is not in the authoritative emission-factor registry — emissions for this voyage are not fully attributable.`,
        });
        consumptionResolved = false;
        consumptionStatus = "UNKNOWN_FUEL";
        continue;
      }
      const co2 = rec.quantity_mt * info.co2_factor;
      voyageCo2 += co2;
      perVoyageEmissions.push({
        voyage_id: v.voyage_id,
        fuel_type: rec.fuel_type,
        quantity_mt: rec.quantity_mt,
        ttw_co2_tonnes: round(co2, 4),
        method: rec.method,
        confidence: rec.confidence,
        status: rec.status,
        factor_source: info.source,
      });

      // Surface insufficient/conflicting consumption explicitly.
      if (rec.status === "BLOCKED" || rec.method === "INSUFFICIENT_DATA") {
        exceptions.push({
          code: "INSUFFICIENT_CONSUMPTION",
          ref: v.voyage_id,
          message:
            "Voyage consumption is INSUFFICIENT_DATA/BLOCKED — no defensible emissions figure for this voyage.",
        });
        consumptionResolved = false;
        consumptionStatus = "BLOCKED";
      } else if (rec.method === "CONFLICT_DELTA" || rec.status === "REVIEW") {
        exceptions.push({
          code: "CONFLICTING_CONSUMPTION",
          ref: v.voyage_id,
          message:
            "Voyage consumption sources conflict beyond tolerance — REQUIRES_REVIEW, not a precise figure.",
        });
        consumptionResolved = false;
        consumptionStatus = "REVIEW";
      }
    }

    if (records.length === 0) {
      exceptions.push({
        code: "MISSING_CONSUMPTION",
        ref: v.voyage_id,
        message:
          "No canonical fuel-consumption record for this voyage — its emissions are UNKNOWN, not estimated by proxy.",
      });
      consumptionResolved = false;
      consumptionStatus = "NO_EVIDENCE";
    }

    // Coverage factor is only meaningful when both ports are resolved.
    const coverageResolved = !hasUnknownPort;
    const coverageType = (coverageResolved ? v.status.type : "UNKNOWN") as
      | VoyageCoverageType
      | "UNKNOWN";
    const coverageFactor =
      coverageResolved && coverageType !== "UNKNOWN"
        ? getVoyageCoverageFactor(coverageType)
        : 0;

    // A voyage contributes to the covered total ONLY when BOTH its coverage and
    // its consumption are resolved. Anything else blocks a precise covered figure.
    const voyageCovered =
      coverageResolved &&
      consumptionResolved &&
      coverageType !== "UNKNOWN" &&
      (coverageFactor > 0 || coverageFactor === 0);

    let voyageCoveredCo2: number | null;
    if (voyageCovered) {
      voyageCoveredCo2 = round(voyageCo2 * coverageFactor, 4);
      coveredSum += voyageCoveredCo2;
    } else {
      voyageCoveredCo2 = null;
      uncertaintyBlocksCovered = true;
    }

    voyageCompliance.push({
      voyage_id: v.voyage_id,
      departure_port: v.departure_port,
      arrival_port: v.arrival_port,
      coverage_type: coverageType,
      coverage_factor: coverageFactor,
      coverage_resolved: coverageResolved,
      ttw_co2_tonnes: round(voyageCo2, 4),
      covered_co2_tonnes: voyageCoveredCo2,
      consumption_resolved: consumptionResolved,
      unknown_ports: unknownPorts,
      consumption_status: consumptionStatus,
    });
  }

  const resolvableCo2 = round(voyageCompliance.reduce((s, v) => s + v.ttw_co2_tonnes, 0), 4);

  // ── 3. Covered CO₂ / EUA obligation ─────────────────────────────────────
  // Only a precise figure when scope is APPLICABLE AND every in-scope-relevant
  // covered voyage resolved. Otherwise it stays null with an exception.
  let coveredCo2: number | null;
  let euaObligation: number | null;
  let estimatedCost: number | null;

  if (!scopeApplicable) {
    // Only a definite NOT_APPLICABLE yields a precise zero obligation. An
    // UNKNOWN / REQUIRES_REVIEW applicability must NOT imply zero — the
    // obligation itself is unknown.
    const definitiveNotApplicable =
      input.applicability?.status === "NOT_APPLICABLE" &&
      input.applicability.is_decision_final;
    if (definitiveNotApplicable) {
      coveredCo2 = 0;
      euaObligation = 0;
      try {
        estimatedCost =
          input.price.available && euaObligation > 0
            ? round(euaObligation * (input.price.value_eur ?? 0), 2)
            : null;
      } catch {
        estimatedCost = null;
      }
    } else {
      coveredCo2 = null;
      euaObligation = null;
      estimatedCost = null;
    }
  } else if (uncertaintyBlocksCovered) {
    coveredCo2 = null;
    euaObligation = null;
    estimatedCost = null;
  } else {
    coveredCo2 = round(coveredSum, 4);
    euaObligation = round(coveredSum * input.coverageRate, 4);
    try {
      estimatedCost =
        input.price.available && euaObligation > 0
          ? round(euaObligation * (input.price.value_eur ?? 0), 2)
          : null;
    } catch {
      estimatedCost = null;
    }
  }

  if (!input.price.available) {
    exceptions.push({
      code: "PRICE_UNAVAILABLE",
      message:
        "No trusted EUA market price source is available — monetary exposure is not shown (never a fabricated price).",
    });
  }

  // ── 4. Compliance status ────────────────────────────────────────────────
  const priceMatters = scopeApplicable && euaObligation !== null && euaObligation > 0;
  const complianceStatus = deriveStatus({
    appStatus,
    isScopeResolved,
    scopeApplicable,
    priceMatters,
    priceAvailable: input.price.available,
    hasUnresolved: uncertaintyBlocksCovered,
    actualAllowance: input.actualAllowanceTonnes,
    obligation: euaObligation,
  });

  // ── 5. Allowance ────────────────────────────────────────────────────────
  // CALCULATED OBLIGATION ≠ ACTUAL ALLOWANCE BALANCE.
  let allowanceSource: "CALCULATED" | "AUTHORITATIVE" | "NONE" = "NONE";
  if (input.actualAllowanceTonnes !== null) {
    allowanceSource = "AUTHORITATIVE";
  } else if (euaObligation !== null) {
    allowanceSource = "CALCULATED";
  }

  if (input.actualAllowanceTonnes === null && euaObligation !== null) {
    exceptions.push({
      code: "ALLOWANCE_INCOMPLETE",
      message:
        "Only the calculated EUA obligation is known; no authoritative allowance balance is on file — balance must not be implied.",
    });
  }

  return {
    compliance_status: complianceStatus,
    is_scope_resolved: isScopeResolved,
    scope_applicable: scopeApplicable,
    exceptions,
    perVoyageEmissions,
    voyageCompliance,
    total_ttw_co2_tonnes: resolvableCo2,
    resolvable_ttw_co2_tonnes: resolvableCo2,
    covered_co2_tonnes: coveredCo2,
    eua_obligation_tonnes: euaObligation,
    price: input.price,
    estimated_cost_eur: estimatedCost,
    allowance: {
      calculated_obligation_tonnes: euaObligation,
      actual_balance_tonnes: input.actualAllowanceTonnes,
      source: allowanceSource,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveStatus(args: {
  appStatus: string;
  isScopeResolved: boolean;
  scopeApplicable: boolean;
  priceMatters: boolean;
  priceAvailable: boolean;
  hasUnresolved: boolean;
  actualAllowance: number | null;
  obligation: number | null;
}): EtsComplianceStatus {
  const {
    appStatus,
    isScopeResolved,
    scopeApplicable,
    priceMatters,
    priceAvailable,
    hasUnresolved,
    actualAllowance,
    obligation,
  } = args;

  // Never claim COMPLIANT merely because an obligation was calculated.
  if (isScopeResolved && !scopeApplicable) return "NOT_APPLICABLE";
  if (!isScopeResolved) {
    return appStatus === "REQUIRES_REVIEW" ? "REQUIRES_REVIEW" : "UNKNOWN";
  }
  // Scope applies. Any unresolved evidence → cannot claim a precise figure.
  if (hasUnresolved || obligation === null) return "DATA_INCOMPLETE";
  if (priceMatters && !priceAvailable) return "READY_FOR_REVIEW";
  // We have a fully resolved obligation; it is not yet a compliance verdict.
  if (actualAllowance !== null && obligation !== null) {
    return obligation <= actualAllowance ? "COMPLIANT" : "NON_COMPLIANT";
  }
  return "CALCULATED";
}

function groupConsumptionByVoyage(
  consumption: readonly VoyageConsumptionRow[],
): Map<string, VoyageConsumptionRow[]> {
  const m = new Map<string, VoyageConsumptionRow[]>();
  for (const rec of consumption) {
    if (rec.voyage_id === null) continue;
    if (!m.has(rec.voyage_id)) m.set(rec.voyage_id, []);
    m.get(rec.voyage_id)!.push(rec);
  }
  return m;
}

// The authoritative emission-factor registry uses a hardcoded fallback for
// unknown fuels. We need to distinguish registry-known fuels from the fallback
// (MGO proxy), so we compare against the explicit keys.
function DEFAULT_EMISSION_FACTOR_KNOWN(fuelType: string): boolean {
  return KNOWN_FUEL_KEYS.has(fuelType);
}

const KNOWN_FUEL_KEYS: ReadonlySet<string> = new Set([
  "hfo_380", "hfo_180", "hfo", "rmg_380", "rmk_380", "vlsfo", "ulsfo",
  "lsmgo", "mgo", "mdo", "lng", "lpg", "methanol", "biodiesel", "b30",
  "hydrogen", "ammonia",
]);

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
