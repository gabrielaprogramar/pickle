import type { FuelDeliveryRow, VoyageRow } from "@/lib/supabase/types";
import type { ReconciliationSuggestion } from "./types";
import { normalizePortName } from "./normalization";

/**
 * Configuration for the reconciliation engine.
 */
export interface ReconciliationConfig {
  /** Maximum days between delivery date and voyage departure/arrival for a match. */
  readonly maxDaysOffset: number;
  /** Minimum confidence score (0-100) to auto-reconcile. */
  readonly autoReconcileThreshold: number;
}

export const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig = {
  maxDaysOffset: 7,
  autoReconcileThreshold: 80,
};

/**
 * Calculate the port match score between a delivery and a voyage.
 * Returns 0-100 based on port name similarity.
 */
function scorePortMatch(deliveryPort: string, voyagePort: string): number {
  const dPort = normalizePortName(deliveryPort);
  const vPort = normalizePortName(voyagePort);

  if (dPort === vPort) return 100;
  if (dPort.includes(vPort) || vPort.includes(dPort)) return 80;

  const dWords = new Set(dPort.split(/\s+/));
  const vWords = new Set(vPort.split(/\s+/));
  const intersection = new Set([...dWords].filter((w) => vWords.has(w)));
  const union = new Set([...dWords, ...vWords]);

  if (union.size === 0) return 0;
  const jaccard = intersection.size / union.size;
  return Math.round(jaccard * 80);
}

/**
 * Calculate the temporal match score between a delivery date and a voyage.
 * Returns 0-100 based on how well the delivery date aligns with the
 * voyage's departure and arrival window.
 */
function scoreTemporalMatch(
  deliveryDate: string,
  voyage: VoyageRow,
  maxDaysOffset: number,
): number {
  const dd = new Date(deliveryDate).getTime();
  const dep = voyage.departure_time ? new Date(voyage.departure_time).getTime() : null;
  const arr = voyage.arrival_time ? new Date(voyage.arrival_time).getTime() : null;

  if (!dep && !arr) return 50;

  const maxMs = maxDaysOffset * 24 * 60 * 60 * 1000;

  if (dep && arr) {
    if (dd >= dep && dd <= arr) return 100;
    const distToDep = Math.abs(dd - dep);
    const distToArr = Math.abs(dd - arr);
    const closest = Math.min(distToDep, distToArr);
    if (closest <= maxMs) {
      return Math.round((1 - closest / maxMs) * 80);
    }
    return 0;
  }

  const ref = dep ?? arr;
  if (!ref) return 50;
  const dist = Math.abs(dd - ref);
  if (dist <= maxMs) {
    return Math.round((1 - dist / maxMs) * 80);
  }
  return 0;
}

/**
 * Attempt to reconcile a fuel delivery against a list of voyages.
 * Returns sorted suggestions, highest confidence first.
 */
export function suggestReconciliation(
  delivery: FuelDeliveryRow,
  voyages: VoyageRow[],
  config: ReconciliationConfig = DEFAULT_RECONCILIATION_CONFIG,
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];

  for (const voyage of voyages) {
    const depPortScore = scorePortMatch(delivery.delivery_port, voyage.departure_port_name);
    const arrPortScore = scorePortMatch(delivery.delivery_port, voyage.arrival_port_name);
    const portScore = Math.max(depPortScore, arrPortScore);

    const temporalScore = scoreTemporalMatch(
      delivery.delivery_date,
      voyage,
      config.maxDaysOffset,
    );

    const combined = Math.round(portScore * 0.4 + temporalScore * 0.6);

    if (combined > 0) {
      const depText = voyage.departure_port_name;
      const arrText = voyage.arrival_port_name;
      const dateText = voyage.departure_time ?? voyage.arrival_time ?? "unknown date";
      suggestions.push({
        fuel_delivery_id: delivery.id,
        voyage_id: voyage.id,
        confidence: combined,
        reason: `Delivery port "${delivery.delivery_port}" scores ${portScore}/100 vs voyage ${depText}→${arrText} (${dateText}), temporal match ${temporalScore}/100`,
        match_type: combined >= config.autoReconcileThreshold ? "auto" : "manual",
      });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}

/**
 * Returns the best single suggestion, or null when no match exceeds
 * the minimum confidence threshold.
 */
export function findBestMatch(
  delivery: FuelDeliveryRow,
  voyages: VoyageRow[],
  config: ReconciliationConfig = DEFAULT_RECONCILIATION_CONFIG,
): ReconciliationSuggestion | null {
  const suggestions = suggestReconciliation(delivery, voyages, config);
  return suggestions[0] ?? null;
}
