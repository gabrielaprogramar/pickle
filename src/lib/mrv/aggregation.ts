/**
 * mrv/aggregation.ts — annual MRV aggregation from the CANONICAL consumption
 * model (no second calculator, no equal-share)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 requires MRV to consume the SAME operational truth as EU ETS and
 * FuelEU: the canonical `voyage_consumption` rows produced by
 * `attributeVoyageConsumption` (`src/lib/regulatory/consumption.ts`). There is
 * NO equal-share allocation, NO arbitrary allocation, NO secondary voyage /
 * emissions source. GHG is computed from the SHARED emission factor registry
 * (`getFuelEmissionInfo`), so MRV, EU ETS and FuelEU agree on the underlying
 * tonnage.
 *
 * Boundary handling: a voyage that crosses a year boundary is deliberately NOT
 * silently assigned to one year. A voyage whose departure falls in the
 * reporting year but arrival falls outside it (or vice-versa) is surfaced via
 * the per-voyage split; code must partition it with justification or mark
 * REQUIRES_REVIEW. This module therefore returns both the in-scope aggregates
 * and any cross-year voyages for the caller to resolve.
 *
 * Distance / time are auditable: if a voyage lacks arrival or departure time,
 * time-at-sea is DATA_INCOMPLETE (never fabricated); if distance is missing,
 * distance is DATA_INCOMPLETE (never fabricated). Aggregates then reflect only
 * audited values, and completeness flags tell the caller to BLOCK rather than
 * report a fabricated 0.
 *
 * This module is PURE / deterministic given its inputs.
 */

import { getFuelEmissionInfo } from "@/lib/fuel-delivery/emission-factors";
import type { MrvFuelStocktake, MrvVoyageEntry, MrvCompletenessCheck } from "./types";

export interface MrvAggregationInput {
  /** Canonical consumption rows for the vessel/year (from voyage_consumption). */
  readonly consumption: ReadonlyArray<{
    readonly voyage_id: string | null;
    readonly fuel_type: string;
    readonly quantity_mt: number;
    readonly method: string;
    readonly status: string;
    readonly source_type: string;
    readonly source_record_ids: unknown[];
  }>;
  /** Voyages, used only for distance/time metrics and scope boundaries. */
  readonly voyages: ReadonlyArray<{
    readonly id: string;
    readonly departure_port: string | null;
    readonly arrival_port: string | null;
    readonly departure_time: string | null;
    readonly arrival_time: string | null;
    readonly distance_nm: number | null;
    /** scope_type derived from port-call data (see fueleu pipeline). */
    readonly scope_type?: string;
  }>;
  /** Mapping voyage_id -> its canonical consumption rows, for true per-voyage entries. */
  readonly consumptionByVoyage?: ReadonlyMap<string, ReadonlyArray<{
    readonly fuel_type: string;
    readonly quantity_mt: number;
    readonly method: string;
    readonly status: string;
  }>>;
}

export interface MrvAggregationResult {
  readonly total_fuel_mt: number;
  readonly total_co2_tonnes: number;
  readonly total_co2e_tonnes: number | null;
  readonly fuel_stocktakes: ReadonlyArray<MrvFuelStocktake>;
  readonly total_distance_nm: number | null;
  readonly total_time_at_sea_hours: number | null;
  /** Sum of audited-in distance across voyages (0 if none audited). */
  readonly audited_distance_nm: number;
  readonly audited_time_at_sea_hours: number;
  readonly distance_checks: ReadonlyArray<MrvCompletenessCheck>;
  readonly time_checks: ReadonlyArray<MrvCompletenessCheck>;
  /** Voyages that cross the selected reporting-year boundary. */
  readonly cross_year_voyages: ReadonlyArray<{ id: string; departure_time: string | null; arrival_time: string | null }>;
  /** Voyages missing auditable distance. */
  readonly missing_distance_voyages: ReadonlyArray<string>;
  /** Voyages missing auditable time. */
  readonly missing_time_voyages: ReadonlyArray<string>;
  readonly voyage_entries: ReadonlyArray<MrvVoyageEntry>;
  /** Number of canonical consumption rows carrying a NON-verified status. */
  readonly unresolved_consumption_count: number;
  readonly unresolved_consumption_rows: ReadonlyArray<{ voyage_id: string | null; fuel_type: string; status: string }>;
}

const AUDIT_STATUSES = new Set(["VERIFIED", "PENDING", "REVIEW"]);

/**
 * Aggregate an annual MRV report from canonical consumption rows. NEVER
 * equal-share: total_fuel_mt is the sum of canonical per-(voyage,fuel)
 * quantities that carry an audited/verifiable status. Rows with a non-audited
 * status (BLOCKED, INSUFFICIENT_DATA, UNKNOWN_FUEL_TYPE, NEGATIVE, ...) are
 * excluded from the total and counted as unresolved — the report must surface
 * them rather than silently under-state emissions.
 */
export function aggregateAnnualMrv(input: MrvAggregationInput): MrvAggregationResult {
  const fuelTotals = new Map<string, number>();
  let totalFuelMt = 0;
  let totalCo2 = 0;
  const unresolved: Array<{ voyage_id: string | null; fuel_type: string; status: string }> = [];
  let unresolvedCount = 0;

  const unresolvedFor = (c: { voyage_id: string | null; fuel_type: string; status: string }): string | null => {
    if (!AUDIT_STATUSES.has(c.status)) return c.status;
    if (c.fuel_type === "unknown" || c.fuel_type.trim() === "") return "UNKNOWN_FUEL_TYPE";
    return null;
  };

  for (const c of input.consumption) {
    const cause = unresolvedFor(c);
    if (cause !== null) {
      unresolved.push({ voyage_id: c.voyage_id, fuel_type: c.fuel_type, status: cause });
      unresolvedCount++;
      continue;
    }
    const info = getFuelEmissionInfo(c.fuel_type);
    if (c.quantity_mt < 0) {
      unresolved.push({ voyage_id: c.voyage_id, fuel_type: c.fuel_type, status: "NEGATIVE" });
      unresolvedCount++;
      continue;
    }
    if (!info) {
      // getFuelEmissionInfo has a fallback, but guard defensively.
      unresolved.push({ voyage_id: c.voyage_id, fuel_type: c.fuel_type, status: "NO_FACTOR" });
      unresolvedCount++;
      continue;
    }
    fuelTotals.set(c.fuel_type, (fuelTotals.get(c.fuel_type) ?? 0) + c.quantity_mt);
    totalFuelMt += c.quantity_mt;
    totalCo2 += c.quantity_mt * info.co2_factor;
  }

  const stocktakes: MrvFuelStocktake[] = [];
  for (const [fuel, qty] of fuelTotals) {
    const info = getFuelEmissionInfo(fuel);
    stocktakes.push({
      fuel_type: fuel,
      quantity_mt: Math.round(qty * 10000) / 10000,
      co2_factor: info.co2_factor,
      co2_tonnes: Math.round(qty * info.co2_factor * 10000) / 10000,
      source: info.source,
    });
  }
  stocktakes.sort((a, b) => b.quantity_mt - a.quantity_mt);

  // ── Distance / time metrics (auditable, never fabricated) ──────────────
  let auditedDistance = 0;
  let auditedTime = 0;
  const missingDistance: string[] = [];
  const missingTime: string[] = [];
  const crossYear: Array<{ id: string; departure_time: string | null; arrival_time: string | null }> = [];
  const entries: MrvVoyageEntry[] = [];

  for (const v of input.voyages) {
    let distanceQuality: MrvVoyageEntry["distance_quality"] = "NOT_APPLICABLE";
    let timeQuality: MrvVoyageEntry["time_quality"] = "NOT_APPLICABLE";
    let distanceNm: number | null = v.distance_nm;
    let timeHours: number | null = null;

    if (v.departure_time != null && v.arrival_time != null) {
      const dep = new Date(v.departure_time).getTime();
      const arr = new Date(v.arrival_time).getTime();
      if (isFinite(dep) && isFinite(arr) && arr >= dep) {
        timeHours = Math.round(((arr - dep) / 3600000) * 100) / 100;
        auditedTime += timeHours;
        timeQuality = "AUDITED";
        // Cross-year: departure and arrival fall in different years.
        if (new Date(dep).getUTCFullYear() !== new Date(arr).getUTCFullYear()) {
          crossYear.push({ id: v.id, departure_time: v.departure_time, arrival_time: v.arrival_time });
        }
      } else {
        timeQuality = "DATA_INCOMPLETE";
        missingTime.push(v.id);
      }
    } else {
      timeQuality = "DATA_INCOMPLETE";
      missingTime.push(v.id);
    }

    if (v.distance_nm != null && isFinite(v.distance_nm) && v.distance_nm >= 0) {
      distanceNm = v.distance_nm;
      auditedDistance += v.distance_nm;
      distanceQuality = "AUDITED";
    } else {
      distanceNm = null;
      distanceQuality = "DATA_INCOMPLETE";
      missingDistance.push(v.id);
    }

    // Per-voyage consumption from the canonical map (never equal-share).
    const voyageConsumption = input.consumptionByVoyage?.get(v.id) ?? [];
    const fuelType = voyageConsumption[0]?.fuel_type ?? "unknown";
    const qty = voyageConsumption.reduce((s, c) => s + (c.status === "BLOCKED" ? 0 : c.quantity_mt), 0);
    const co2 = voyageConsumption.reduce(
      (s, c) => (c.status === "BLOCKED" ? s : s + c.quantity_mt * getFuelEmissionInfo(c.fuel_type).co2_factor),
      0,
    );
    const consumptionMethod = voyageConsumption[0]?.method ?? "INSUFFICIENT_DATA";
    const consumptionStatus = voyageConsumption[0]?.status ?? "BLOCKED";

    entries.push({
      voyage_id: v.id,
      departure_port: v.departure_port ?? "",
      arrival_port: v.arrival_port ?? "",
      departure_date: v.departure_time ?? "",
      arrival_date: v.arrival_time ?? "",
      distance_nm: distanceNm,
      time_at_sea_hours: timeHours,
      fuel_type: fuelType,
      fuel_consumption_mt: Math.round(qty * 10000) / 10000,
      co2_tonnes: Math.round(co2 * 10000) / 10000,
      voyage_type: v.scope_type ?? "MRV",
      distance_quality: distanceQuality,
      time_quality: timeQuality,
      consumption_method: consumptionMethod,
      consumption_status: consumptionStatus,
      data_quality:
        consumptionStatus === "BLOCKED"
          ? "data_incomplete"
          : distanceQuality === "AUDITED"
            ? "audited"
            : "data_incomplete",
    });
  }

  const totalCo2e = totalCo2; // CH4/N2O not in scope of the shared registry → CO2e == CO2 (see report).
  const distanceChecks: MrvCompletenessCheck[] = [
    {
      check_name: "distance_audited",
      passed: missingDistance.length === 0,
      severity: missingDistance.length > 0 ? "error" : "warning",
      message:
        missingDistance.length === 0
          ? "Distance travelled audited for all voyages"
          : `${missingDistance.length} voyage(s) missing auditable distance — DATA_INCOMPLETE, no value fabricated`,
    },
  ];
  const timeChecks: MrvCompletenessCheck[] = [
    {
      check_name: "time_at_sea_audited",
      passed: missingTime.length === 0,
      severity: missingTime.length > 0 ? "error" : "warning",
      message:
        missingTime.length === 0
          ? "Time at sea audited for all voyages"
          : `${missingTime.length} voyage(s) missing auditable departure/arrival — DATA_INCOMPLETE, no value fabricated`,
    },
  ];

  return {
    total_fuel_mt: Math.round(totalFuelMt * 10000) / 10000,
    total_co2_tonnes: Math.round(totalCo2 * 10000) / 10000,
    total_co2e_tonnes: Math.round((totalCo2e ?? 0) * 10000) / 10000,
    fuel_stocktakes: stocktakes,
    total_distance_nm: missingDistance.length === 0 ? Math.round(auditedDistance * 10000) / 10000 : null,
    total_time_at_sea_hours: missingTime.length === 0 ? Math.round(auditedTime * 10000) / 10000 : null,
    audited_distance_nm: Math.round(auditedDistance * 10000) / 10000,
    audited_time_at_sea_hours: Math.round(auditedTime * 10000) / 10000,
    distance_checks: distanceChecks,
    time_checks: timeChecks,
    cross_year_voyages: crossYear,
    missing_distance_voyages: missingDistance,
    missing_time_voyages: missingTime,
    voyage_entries: entries,
    unresolved_consumption_count: unresolvedCount,
    unresolved_consumption_rows: unresolved,
  };
}

export { AUDIT_STATUSES };
