/**
 * regulatory/consumption.ts — canonical per-voyage fuel consumption attribution
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 1 replaces the MRV equal-share allocation placeholder with ONE canonical
 * per-voyage consumption model. Consumption is attributed to a voyage from
 * OBSERVED source records, always preferring the most direct evidence:
 *
 *   1. NOON_REPORT_INTERVAL — a noon report boundary that brackets a voyage,
 *      carrying an explicit `fuel_consumption_tonnes` reading. HIGH confidence.
 *   2. ROB_DELTA            — difference in fuel R.O.B. (remaining on board)
 *      across the voyage window. MEDIUM confidence.
 *   3. BDN_TO_VOYAGE        — a bunker delivery (BDN) reconciled to the voyage
 *      (via the existing fuel-delivery reconciliation engine). MEDIUM confidence.
 *
 * When the evidence is insufficient (no source touches the voyage) the result
 * is a BLOCKED / UNKNOWN record with method INSUFFICIENT_DATA — NEVER an
 * equal-share split. Conflicting sources that disagree beyond tolerance yield
 * CONFLICT_DELTA and status REVIEW.
 *
 * This module is PURE / deterministic given its inputs.
 */

import type { FuelDeliveryRow, NoonReportRow, VoyageRow } from "@/lib/supabase/types";

export const CONSUMPTION_METHODS = [
  "NOON_REPORT_INTERVAL",
  "ROB_DELTA",
  "BDN_TO_VOYAGE",
  "INSUFFICIENT_DATA",
  "CONFLICT_DELTA",
  "ESTIMATED_MANUAL",
] as const;

export type ConsumptionMethod = (typeof CONSUMPTION_METHODS)[number];

export const CONSUMPTION_CONFIDENCE = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type ConsumptionConfidence = (typeof CONSUMPTION_CONFIDENCE)[number];

export const CONSUMPTION_STATUS = ["PENDING", "VERIFIED", "REVIEW", "BLOCKED"] as const;
export type ConsumptionStatus = (typeof CONSUMPTION_STATUS)[number];

export interface ConsumptionResult {
  readonly method: ConsumptionMethod;
  readonly confidence: ConsumptionConfidence;
  readonly status: ConsumptionStatus;
  readonly quantity_mt: number;
  readonly fuel_type: string | null;
  readonly source_type: string;
  readonly source_record_ids: string[];
  readonly attribution_method: string;
  readonly traceability: Record<string, unknown>;
  readonly notes: string | null;
}

export interface ConsumptionInput {
  readonly vessel_id: string;
  readonly voyage: VoyageRow;
  readonly reporting_year: number;
  readonly noonReports: NoonReportRow[];
  readonly deliveries: FuelDeliveryRow[];
  /** ROB (remaining on board) readings keyed by date, per fuel. */
  readonly robsByDate: Array<{ date: string; fuel_type: string; rob_mt: number }>;
  /** Optional explicit fuel type to attribute (defaults to the first found). */
  readonly fuelType?: string | null;
}

/** Tolerance (fraction) beyond which conflicting sources flag REVIEW. */
export const DEFAULT_CONFLICT_TOLERANCE = 0.15;
export const MIN_REPORT_DAYS = 1;

/**
 * Attribute consumption for a single voyage from available source records.
 * Deterministic, never equal-share.
 */
export function attributeVoyageConsumption(
  input: ConsumptionInput,
): ConsumptionResult {
  const { voyage, noonReports, deliveries, robsByDate, fuelType } = input;

  // 1. No direct evidence of any kind touching this voyage -> INSUFFICIENT_DATA.
  const candidateNotes = noonReports.filter((r) => r.fuel_consumption_tonnes !== null);
  const voyageDeliveries = deliveries.filter((d) =>
    voyage_date_in(d.delivery_date, voyage),
  );
  const voyageRobs = robsByDate.filter((r) => voyage_date_in(r.date, voyage));

  if (
    candidateNotes.length === 0 &&
    voyageDeliveries.length === 0 &&
    voyageRobs.length < 2
  ) {
    return {
      method: "INSUFFICIENT_DATA",
      confidence: "UNKNOWN",
      status: "BLOCKED",
      quantity_mt: 0,
      fuel_type: fuelType ?? null,
      source_type: "none",
      source_record_ids: [],
      attribution_method: "none",
      traceability: {
        voyage_id: voyage.id,
        note: "No observed fuel source brackets this voyage; equal-share allocation is forbidden.",
        noon_reports_available: candidateNotes.length,
        deliveries_available: voyageDeliveries.length,
        rob_readings_available: voyageRobs.length,
      },
      notes: "Insufficient data to attribute fuel consumption to this voyage — equal-share allocation is forbidden, no estimate produced.",
    };
  }

  // 2. Prefer the noon-report interval: bounded by reports with consumption.
  if (
    candidateNotes.length >= 2 &&
    noonIntervalBrackets(candidateNotes, voyage) &&
    typeof fuelType === "string"
  ) {
    const window = noonWindowConsumption(fuelType, candidateNotes, voyage, input);
    // Cross-check against BDN deliveries / ROB delta for conflict detection.
    const ref = crossCheckReference(fuelType, voyageDeliveries, voyageRobs, voyage);
    if (ref !== null && Math.abs(window.quantity_mt - ref) / Math.max(ref, 1) > DEFAULT_CONFLICT_TOLERANCE) {
      return {
        method: "CONFLICT_DELTA",
        confidence: "LOW",
        status: "REVIEW",
        quantity_mt: window.quantity_mt,
        fuel_type: fuelType,
        source_type: "noon_reports",
        source_record_ids: window.sourceIds,
        attribution_method: "NOON_REPORT_INTERVAL",
        traceability: { ...window.traceability, cross_check_reference_mt: ref },
        notes: "Noon-report consumption conflicts with BDN/ROB evidence beyond tolerance — manual review required.",
      };
    }
    return {
      method: "NOON_REPORT_INTERVAL",
      confidence: "HIGH",
      status: "VERIFIED",
      quantity_mt: window.quantity_mt,
      fuel_type: fuelType,
      source_type: "noon_reports",
      source_record_ids: window.sourceIds,
      attribution_method: "NOON_REPORT_INTERVAL",
      traceability: window.traceability,
      notes: "Consumption attributed from noon-report fuel readings bracketing the voyage.",
    };
  }

  // 3. ROB delta across the voyage window.
  if (voyageRobs.length >= 2) {
    const group = groupRobsByFuel(voyageRobs);
    const first = group[0]!;
    if (first.readings.length >= 2) {
      const firstRead = first.readings[0]!;
      const lastRead = first.readings[first.readings.length - 1]!;
      const delta = firstRead.rob_mt - lastRead.rob_mt;
      if (delta >= 0) {
        return {
          method: "ROB_DELTA",
          confidence: "MEDIUM",
          status: "VERIFIED",
          quantity_mt: delta,
          fuel_type: first.fuel_type,
          source_type: "fuel_robs",
          source_record_ids: [],
          attribution_method: "ROB_DELTA",
          traceability: {
            voyage_id: voyage.id,
            fuel_type: first.fuel_type,
            open_rob_mt: firstRead.rob_mt,
            close_rob_mt: lastRead.rob_mt,
            delta_mt: delta,
          },
          notes: "Consumption attributed from ROB delta across the voyage window.",
        };
      }
    }
  }

  // 4. BDN delivery reconciled to the voyage.
  if (voyageDeliveries.length > 0) {
    const d = voyageDeliveries[0]!;
    return {
      method: "BDN_TO_VOYAGE",
      confidence: "MEDIUM",
      status: "PENDING",
      quantity_mt: d.quantity_mt,
      fuel_type: d.fuel_type,
      source_type: "fuel_deliveries",
      source_record_ids: [d.id],
      attribution_method: "BDN_TO_VOYAGE",
      traceability: {
        voyage_id: voyage.id,
        delivery_id: d.id,
        delivery_date: d.delivery_date,
        delivery_port: d.delivery_port,
        fuel_type: d.fuel_type,
        quantity_mt: d.quantity_mt,
      },
      notes: "Consumption attributed from a BDN delivery reconciled to this voyage.",
    };
  }

  // 5. No evidence yields a definitive positive number.
  return {
    method: "INSUFFICIENT_DATA",
    confidence: "UNKNOWN",
    status: "BLOCKED",
    quantity_mt: 0,
    fuel_type: fuelType ?? null,
    source_type: "none",
    source_record_ids: [],
    attribution_method: "none",
    traceability: { voyage_id: voyage.id },
    notes: "No reliable source to attribute consumption — no estimate produced.",
  };
}

function voyage_date_in(dateStr: string, voyage: VoyageRow): boolean {
  const t = new Date(dateStr + "T00:00:00Z").getTime();
  const dep = voyage.departure_time ? new Date(voyage.departure_time).getTime() : null;
  const arr = voyage.arrival_time ? new Date(voyage.arrival_time).getTime() : null;
  if (dep !== null && t < dep - 7 * 86400000) return false;
  if (arr !== null && t > arr + 7 * 86400000) return false;
  return true;
}

function noonIntervalBrackets(notes: NoonReportRow[], voyage: VoyageRow): boolean {
  const dep = voyage.departure_time;
  const arr = voyage.arrival_time;
  if (!dep || !arr) return false;
  const depT = new Date(dep).getTime();
  const arrT = new Date(arr).getTime();
  const before = notes.filter((r) => new Date(r.report_date).getTime() <= depT);
  const after = notes.filter((r) => new Date(r.report_date).getTime() >= arrT);
  return before.length > 0 && after.length > 0;
}

function noonWindowConsumption(
  fuelType: string,
  notes: NoonReportRow[],
  voyage: VoyageRow,
  input: ConsumptionInput,
): { quantity_mt: number; sourceIds: string[]; traceability: Record<string, unknown> } {
  const depT = new Date(voyage.departure_time as string).getTime();
  const arrT = new Date(voyage.arrival_time as string).getTime();
  const before = notes
    .filter((r) => new Date(r.report_date).getTime() <= depT)
    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());
  const after = notes
    .filter((r) => new Date(r.report_date).getTime() >= arrT)
    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());
  const open = before[before.length - 1]!;
  const close = after[0]!;
  const openT = new Date(open.report_date).getTime();
  const closeT = new Date(close.report_date).getTime();
  const days = (closeT - openT) / 86400000;
  // Average daily consumption from reports strictly inside the voyage window,
  // scaled over the bracketing interval; falls back to the seconds in window.
  const inside = notes.filter((r) => {
    const t = new Date(r.report_date).getTime();
    return t > openT && t < closeT;
  });
  const avgDaily =
    inside.length > 0
      ? inside.reduce((s, r) => s + (r.fuel_consumption_tonnes ?? 0), 0) / inside.length
      : (open.fuel_consumption_tonnes ?? 0);
  const quantity = Math.max(0, avgDaily * days);

  const sourceIds = Array.from(
    new Set([open.id, close.id, ...inside.map((r) => r.id)]),
  );
  return {
    quantity_mt: quantity,
    sourceIds,
    traceability: {
      voyage_id: input.voyage.id,
      fuel_type: fuelType,
      open_report_id: open.id,
      close_report_id: close.id,
      open_report_date: open.report_date,
      close_report_date: close.report_date,
      interval_days: days,
      inside_reports: inside.map((r) => r.id),
      avg_daily_mt: avgDaily,
      source_count: sourceIds.length,
    },
  };
}

function crossCheckReference(
  fuelType: string,
  deliveries: FuelDeliveryRow[],
  robs: Array<{ date: string; fuel_type: string; rob_mt: number }>,
  voyage: VoyageRow,
): number | null {
  const delSum = deliveries
    .filter((d) => d.fuel_type === fuelType)
    .reduce((s, d) => s + d.quantity_mt, 0);
  if (delSum > 0) return delSum;
  const fuelRobs = robs
    .filter((r) => r.fuel_type === fuelType)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (fuelRobs.length >= 2) {
    const delta = fuelRobs[0]!.rob_mt - fuelRobs[fuelRobs.length - 1]!.rob_mt;
    if (delta >= 0) return delta;
  }
  return null;
}

function groupRobsByFuel(
  robs: Array<{ date: string; fuel_type: string; rob_mt: number }>,
): Array<{
  fuel_type: string;
  readings: Array<{ date: string; rob_mt: number }>;
}> {
  const byFuel = new Map<string, Array<{ date: string; rob_mt: number }>>();
  for (const r of robs) {
    if (!byFuel.has(r.fuel_type)) byFuel.set(r.fuel_type, []);
    byFuel.get(r.fuel_type)!.push({ date: r.date, rob_mt: r.rob_mt });
  }
  return Array.from(byFuel.entries())
    .map(([fuel_type, readings]) => ({
      fuel_type,
      readings: readings.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    }))
    .sort((a, b) => a.readings.length - b.readings.length);
}
