/**
 * noon-report/fuel-correlation.ts — fuel deliveries vs noon report consumption
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deterministic cross-check between the reported consumption / ROB and the
 * fuel deliveries received in the report window:
 *
 *   - delivery vs consumption: consumption must not exceed (opening ROB +
 *     delivered tonnes) by more than 5% — beyond that is "impossible fuel".
 *   - ROB consistency: reported consumption vs the ROB delta of consecutive
 *     noon reports.
 *   - attribution: reported consumption split across delivered fuel types by
 *     quantity share (feed to FuelEU / ETS correlations).
 *
 * Pure function — the caller supplies the deliveries for the window.
 */

import type { NoonFinding, NoonFuelCorrelation, NoonReportDomain } from "./types";
import { round3 } from "./engine";

export interface FuelDeliveryLike {
  readonly id: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly delivery_date: string;
}

export interface NoonFuelCorrelationInput {
  readonly report: NoonReportDomain;
  readonly previous: NoonReportDomain | null;
  readonly deliveries: ReadonlyArray<FuelDeliveryLike>;
}

function pct(actual: number, expected: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) {
    return null;
  }
  return round3(((actual - expected) / expected) * 100);
}

export function correlateNoonFuel(input: NoonFuelCorrelationInput): NoonFuelCorrelation {
  const { report, previous, deliveries } = input;
  const findings: NoonFinding[] = [];

  // ── Delivery totals ──────────────────────────────────────────────────────
  const deliveredTonnes =
    deliveries.length > 0
      ? round3(deliveries.reduce((sum, d) => sum + d.quantity_mt, 0))
      : null;
  const consumedTonnes = report.fuelConsumptionTonnes;

  // ── Delivery vs consumption (impossible fuel check) ──────────────────────
  const openingRob = previous?.fuelRobsTonnes ?? null;
  const availableTonnes =
    openingRob !== null && deliveredTonnes !== null ? round3(openingRob + deliveredTonnes) : null;

  let deliveryState: NoonFuelCorrelation["deliveryState"] = "INSUFFICIENT_DATA";
  let deliveryDiscrepancyTonnes: number | null = null;
  let deliveryDiscrepancyPct: number | null = null;

  if (consumedTonnes !== null && availableTonnes !== null && availableTonnes > 0) {
    deliveryDiscrepancyTonnes = round3(consumedTonnes - availableTonnes);
    deliveryDiscrepancyPct = pct(consumedTonnes, availableTonnes);
    if (deliveryDiscrepancyPct !== null && deliveryDiscrepancyPct > 5) {
      deliveryState = "INCONSISTENT";
      findings.push({
        id: "noon.fuel.impossible_consumption",
        severity: "ERROR",
        confidence: 0.85,
        reason:
          `Reported consumption (${consumedTonnes} t) exceeds the opening ROB (${openingRob} t) plus ` +
          `deliveries in the window (${deliveredTonnes} t) by ${deliveryDiscrepancyPct}% — this is ` +
          `physically impossible unless a delivery or ROB figure is wrong.`,
        remediation:
          "Verify the ROB figures and the fuel quantities on the bunker delivery notes for this window.",
        category: "fuel",
        ruleId: null,
        field: "fuelConsumptionTonnes",
      });
    } else {
      deliveryState = "CONSISTENT";
    }
  } else if (consumedTonnes === null || deliveredTonnes === null || openingRob === null) {
    deliveryState = "INSUFFICIENT_DATA";
  }

  // ── ROB consistency ──────────────────────────────────────────────────────
  let robState: NoonFuelCorrelation["robState"] = "INSUFFICIENT_DATA";
  let robDeltaTonnes: number | null = null;
  let robExpectedConsumptionTonnes: number | null = null;
  let robDiscrepancyPct: number | null = null;

  if (
    previous !== null &&
    previous.fuelRobsTonnes !== null &&
    report.fuelRobsTonnes !== null &&
    consumedTonnes !== null
  ) {
    robDeltaTonnes = round3(previous.fuelRobsTonnes - report.fuelRobsTonnes);
    robExpectedConsumptionTonnes = consumedTonnes;
    robDiscrepancyPct = pct(robDeltaTonnes, consumedTonnes);
    if (robDiscrepancyPct !== null && Math.abs(robDiscrepancyPct) > 10) {
      robState = "INCONSISTENT";
      findings.push({
        id: "noon.fuel.rob_inconsistency",
        severity: "WARNING",
        confidence: 0.8,
        reason:
          `ROB delta since the previous report (${robDeltaTonnes} t) differs from the reported ` +
          `consumption (${consumedTonnes} t) by ${robDiscrepancyPct}%.`,
        remediation: "Check the sounding tables and the reported consumption figure.",
        category: "fuel",
        ruleId: null,
        field: "fuelRobsTonnes",
      });
    } else {
      robState = "CONSISTENT";
    }
  }

  // ── Attribution by delivered quantity share ──────────────────────────────
  const attribution = (() => {
    if (consumedTonnes === null || deliveredTonnes === null || deliveredTonnes <= 0) {
      return [] as NoonFuelCorrelation["attribution"];
    }
    const byType = new Map<string, number>();
    for (const d of deliveries) {
      byType.set(d.fuel_type, (byType.get(d.fuel_type) ?? 0) + d.quantity_mt);
    }
    const items: Array<{ fuelType: string; tonnes: number }> = [];
    for (const [fuelType, tonnes] of byType) {
      const share = round3((tonnes / deliveredTonnes) * 100);
      items.push({ fuelType, tonnes: round3((consumedTonnes * share) / 100) });
    }
    return items;
  })();

  const attributionResolved = attribution.length > 0;

  return {
    attribution,
    attributionResolved,
    deliveredTonnes,
    consumedTonnes,
    deliveryDiscrepancyTonnes,
    deliveryDiscrepancyPct,
    deliveryState,
    robDeltaTonnes,
    robExpectedConsumptionTonnes,
    robDiscrepancyPct,
    robState,
    findings,
  };
}
