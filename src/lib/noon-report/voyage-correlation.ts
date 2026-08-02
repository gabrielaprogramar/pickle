/**
 * noon-report/voyage-correlation.ts — actual vs planned voyage progress
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deterministic comparison of the noon report position/speed against the
 * planned voyage: distance made good, speed made good, progress %, ETA
 * deviation. Pure function.
 */

import type {
  NoonFinding,
  NoonReportAnalysis,
  NoonReportDomain,
  NoonVoyageCorrelation,
  VoyagePlanInput,
} from "./types";
import { round3 } from "./engine";

export interface NoonVoyageCorrelationInput {
  readonly report: NoonReportDomain;
  readonly previous: NoonReportDomain | null;
  readonly analysis: NoonReportAnalysis;
  readonly voyagePlan: VoyagePlanInput | null;
}

export function correlateNoonVoyage(input: NoonVoyageCorrelationInput): NoonVoyageCorrelation {
  const { analysis, voyagePlan } = input;
  const findings: NoonFinding[] = [];

  const plannedDistanceNm = voyagePlan?.plannedDistanceNm ?? null;
  const plannedSpeedKnots = voyagePlan?.plannedSpeedKnots ?? null;
  const plannedArrival = voyagePlan?.plannedArrival ?? null;
  const predictedArrival = analysis.prediction.arrivalDate;

  const distanceMadeGoodNm = analysis.voyage.distanceMadeGoodNm;
  const speedMadeGoodKnots = analysis.voyage.speedMadeGoodKnots;

  const progressPct =
    distanceMadeGoodNm !== null && plannedDistanceNm !== null && plannedDistanceNm > 0
      ? round3((distanceMadeGoodNm / plannedDistanceNm) * 100)
      : null;

  const speedDeviationPct =
    speedMadeGoodKnots !== null && plannedSpeedKnots !== null && plannedSpeedKnots > 0
      ? round3(((speedMadeGoodKnots - plannedSpeedKnots) / plannedSpeedKnots) * 100)
      : null;

  let etaDeviationHours: number | null = null;
  let lateHours: number | null = null;
  if (predictedArrival !== null && plannedArrival !== null) {
    etaDeviationHours = round3(
      (Date.parse(predictedArrival) - Date.parse(plannedArrival)) / 3_600_000,
    );
    lateHours = etaDeviationHours > 0 ? etaDeviationHours : 0;
  }

  let state: NoonVoyageCorrelation["state"] = "INSUFFICIENT_DATA";
  if (speedMadeGoodKnots !== null && plannedSpeedKnots !== null && plannedSpeedKnots > 0) {
    if (speedMadeGoodKnots < plannedSpeedKnots * 0.95) state = "BEHIND";
    else if (speedMadeGoodKnots > plannedSpeedKnots * 1.05) state = "AHEAD";
    else state = "ON_SCHEDULE";
  }

  if (state === "BEHIND") {
    findings.push({
      id: "noon.voyage.behind_schedule",
      severity: "WARNING",
      confidence: 0.85,
      reason:
        `Speed made good (${speedMadeGoodKnots} kt) is ${Math.abs(speedDeviationPct ?? 0)}% below the ` +
        `planned ${plannedSpeedKnots} kt — the vessel is falling behind schedule.`,
      remediation: "Review engine speed, routing, and weather; update the ETA if warranted.",
      category: "voyage",
      ruleId: null,
      field: "speedKnots",
    });
  }

  if (lateHours !== null && lateHours > 6) {
    findings.push({
      id: "noon.voyage.late_arrival",
      severity: "ERROR",
      confidence: 0.75,
      reason:
        `Predicted arrival (${predictedArrival}) is more than 6 h behind the planned arrival ` +
        `(${plannedArrival}).`,
      remediation: "Notify the charterer/port agents and update the voyage plan.",
      category: "voyage",
      ruleId: null,
      field: null,
    });
  }

  return {
    distanceMadeGoodNm,
    plannedDistanceNm,
    progressPct,
    speedMadeGoodKnots,
    plannedSpeedKnots,
    speedDeviationPct,
    etaDeviationHours,
    plannedArrival,
    predictedArrival,
    lateHours,
    state,
    findings,
  };
}
