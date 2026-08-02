/**
 * noon-report/engine.ts — deterministic noon report intelligence engine
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Pure function of its inputs. Computes:
 *   operational state, consumption summary + rate, per-fuel breakdown,
 *   remaining on board + endurance, engine load, weather state, voyage
 *   progress (haversine), distance progress, slip analysis, RPM analysis,
 *   speed analysis, waiting/port state, arrival + consumption prediction,
 *   and the deviation findings.
 *
 * Every derived number is rounded to 3 decimals so results are byte-for-byte
 * deterministic. Missing inputs yield `null` — never an estimate.
 */

import type {
  ConsumptionPrediction,
  ConsumptionSummary,
  DeviationAnalysis,
  DeviationSeverity,
  DistanceProgress,
  EnginePerformance,
  FuelConsumptionBreakdown,
  NoonReportAnalysis,
  NoonReportEngineInput,
  NoonReportDomain,
  OperationalState,
  PortOperations,
  RemainingOnBoard,
  RPMAnalysis,
  SlipAnalysis,
  SpeedAnalysis,
  VoyageProgress,
  WaitingState,
  WeatherState,
} from "./types";
import { NOON_REPORT_ENGINE_VERSION } from "./types";

const NAUTICAL_MILES_PER_KM = 1 / 1.852;
const EARTH_RADIUS_KM = 6371.0088;
const WIND_SIGNIFICANT_KNOTS = 28;

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 positions in nautical miles. */
export function haversineNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return round3(EARTH_RADIUS_KM * c * NAUTICAL_MILES_PER_KM);
}

/** Hours elapsed between two ISO timestamps (positive only). */
export function hoursBetween(dateA: string, dateB: string): number | null {
  const a = Date.parse(dateA);
  const b = Date.parse(dateB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const hours = (b - a) / 3_600_000;
  return hours > 0 ? round3(hours) : null;
}

function datePlusHours(date: string, hours: number): string | null {
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + hours * 3_600_000).toISOString();
}

function pctDifference(actual: number, expected: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) {
    return null;
  }
  return round3(((actual - expected) / expected) * 100);
}

export function resolveOperationalState(
  speedKnots: number | null,
  distanceToGoNm: number | null,
): OperationalState {
  if (speedKnots === null) return "UNKNOWN";
  if (speedKnots <= 0.5) {
    if (distanceToGoNm !== null && distanceToGoNm <= 5) return "IN_PORT";
    return "WAITING";
  }
  return "AT_SEA";
}

export function analyzeNoonReport(input: NoonReportEngineInput): NoonReportAnalysis {
  const report = input.report;
  const previous = input.previous ?? null;
  const reference = input.engineReference ?? null;
  const plan = input.voyagePlan ?? null;
  const attribution = input.fuelAttribution ?? null;
  const now = input.now ?? new Date().toISOString();

  const intervalHours = hoursBetween(previous?.reportDate ?? "", report.reportDate);
  const intervalDays = intervalHours !== null ? round3(intervalHours / 24) : null;

  // ── Operational state ────────────────────────────────────────────────────
  const operationalState = resolveOperationalState(report.speedKnots, report.distanceToGoNm);

  // ── Consumption ──────────────────────────────────────────────────────────
  const totalTonnes = report.fuelConsumptionTonnes;
  const sinceLastReportTonnes =
    previous?.fuelRobsTonnes !== null && previous?.fuelRobsTonnes !== undefined &&
    report.fuelRobsTonnes !== null && report.fuelRobsTonnes !== undefined
      ? round3(previous.fuelRobsTonnes - (report.fuelRobsTonnes ?? 0))
      : null;

  let rateTonnesPerDay: number | null = null;
  if (totalTonnes !== null && intervalDays !== null && totalTonnes >= 0 && intervalDays > 0) {
    rateTonnesPerDay = round3(totalTonnes / intervalDays);
  }

  const trendPct =
    previous?.fuelConsumptionTonnes !== null && previous?.fuelConsumptionTonnes !== undefined &&
    (previous?.fuelConsumptionTonnes ?? 0) > 0 && totalTonnes !== null
      ? pctDifference(totalTonnes, previous.fuelConsumptionTonnes ?? 0)
      : null;

  const consumption: ConsumptionSummary = {
    totalTonnes,
    sinceLastReportTonnes,
    intervalDays,
    rateTonnesPerDay,
    trendPct,
    confidence: totalTonnes !== null ? 0.95 : 0.2,
  };

  // ── Fuel breakdown ───────────────────────────────────────────────────────
  const items = (attribution ?? []).map((a) => ({
    fuelType: a.fuelType,
    tonnes: a.tonnes,
    sharePct:
      totalTonnes !== null && totalTonnes > 0
        ? round3((a.tonnes / totalTonnes) * 100)
        : null,
  }));
  const fuelBreakdown: FuelConsumptionBreakdown = {
    items,
    resolved: items.length > 0,
    unresolvedFuelTypes:
      (attribution === null || attribution.length === 0) && totalTonnes !== null
        ? ["UNKNOWN"]
        : [],
  };

  // ── Remaining on board ───────────────────────────────────────────────────
  const robTonnes = report.fuelRobsTonnes;
  const enduranceDays =
    robTonnes !== null && rateTonnesPerDay !== null && rateTonnesPerDay > 0
      ? round3(robTonnes / rateTonnesPerDay)
      : null;
  const remainingOnBoard: RemainingOnBoard = {
    robTonnes,
    enduranceDays,
    confidence: robTonnes !== null ? 0.95 : 0.2,
  };

  // ── Engine ───────────────────────────────────────────────────────────────
  const rpm = report.engineRpm;
  const designRpm = reference?.designRpm ?? null;
  const loadPct =
    rpm !== null && designRpm !== null && designRpm > 0
      ? round3((rpm / designRpm) * 100)
      : null;
  const engine: EnginePerformance = {
    rpm,
    rpmConfidence: rpm !== null ? 0.95 : 0.2,
    loadPct,
    atDesign:
      rpm !== null && designRpm !== null && designRpm > 0
        ? Math.abs(rpm - designRpm) / designRpm <= 0.02
        : null,
  };

  // ── Weather ──────────────────────────────────────────────────────────────
  const significantWind = report.windSpeedKnots !== null && report.windSpeedKnots >= WIND_SIGNIFICANT_KNOTS;
  const weather: WeatherState = {
    seaState: report.seaState,
    windSpeedKnots: report.windSpeedKnots,
    windDirection: report.windDirection,
    significant: report.windSpeedKnots !== null ? significantWind : null,
    confidence: report.windSpeedKnots !== null ? 0.9 : 0.2,
  };

  // ── Voyage progress ──────────────────────────────────────────────────────
  const havePositions =
    report.positionLatitude !== null &&
    report.positionLongitude !== null &&
    previous !== null &&
    previous.positionLatitude !== null &&
    previous.positionLongitude !== null;

  const distanceMadeGoodNm = havePositions
    ? haversineNm(
        previous!.positionLatitude!,
        previous!.positionLongitude!,
        report.positionLatitude!,
        report.positionLongitude!,
      )
    : null;

  const speedMadeGoodKnots =
    distanceMadeGoodNm !== null && intervalHours !== null
      ? round3(distanceMadeGoodNm / intervalHours)
      : null;

  const voyage: VoyageProgress = {
    position: {
      latitude: report.positionLatitude,
      longitude: report.positionLongitude,
    },
    courseDegrees: report.courseDegrees,
    distanceMadeGoodNm,
    speedMadeGoodKnots,
    confidence: distanceMadeGoodNm !== null ? 0.9 : 0.2,
  };

  // ── Distance progress ────────────────────────────────────────────────────
  const plannedDistanceNm = plan?.plannedDistanceNm ?? null;
  const distanceToGoNm = report.distanceToGoNm;
  const progressPct =
    plannedDistanceNm !== null && plannedDistanceNm > 0 && distanceToGoNm !== null
      ? round3(((plannedDistanceNm - distanceToGoNm) / plannedDistanceNm) * 100)
      : null;
  const distance: DistanceProgress = {
    plannedDistanceNm,
    distanceMadeGoodNm,
    distanceToGoNm,
    progressPct,
    remainingPct:
      plannedDistanceNm !== null && plannedDistanceNm > 0 && distanceToGoNm !== null
        ? round3((distanceToGoNm / plannedDistanceNm) * 100)
        : null,
  };

  // ── Slip analysis ────────────────────────────────────────────────────────
  const theoreticalSpeedKnots =
    rpm !== null && reference?.propellerPitchMeters !== null &&
    reference?.propellerPitchMeters !== undefined
      ? round3(((rpm * (reference.propellerPitchMeters ?? 0) * 60) / 1852))
      : null;
  const actualSpeedKnots = speedMadeGoodKnots ?? report.speedKnots;
  const slipPct =
    theoreticalSpeedKnots !== null && theoreticalSpeedKnots > 0 && actualSpeedKnots !== null
      ? round3((1 - actualSpeedKnots / theoreticalSpeedKnots) * 100)
      : null;
  const slip: SlipAnalysis = {
    slipPct,
    theoreticalSpeedKnots,
    actualSpeedKnots,
    confidence: slipPct !== null ? 0.85 : 0.2,
  };

  // ── RPM analysis ─────────────────────────────────────────────────────────
  const rpmDeviationPct =
    rpm !== null && designRpm !== null && designRpm > 0
      ? pctDifference(rpm, designRpm)
      : null;
  const rpmAnalysis: RPMAnalysis = {
    rpm,
    designRpm,
    deviationFromDesignPct: rpmDeviationPct,
    atReference: engine.atDesign,
  };

  // ── Speed analysis ───────────────────────────────────────────────────────
  const designSpeedKnots = reference?.designSpeedKnots ?? null;
  const plannedSpeedKnots = plan?.plannedSpeedKnots ?? null;
  const speedDeviationFromDesignPct =
    report.speedKnots !== null && designSpeedKnots !== null && designSpeedKnots > 0
      ? pctDifference(report.speedKnots, designSpeedKnots)
      : null;
  const speedDeviationFromPlannedPct =
    report.speedKnots !== null && plannedSpeedKnots !== null && plannedSpeedKnots > 0
      ? pctDifference(report.speedKnots, plannedSpeedKnots)
      : null;
  const speed: SpeedAnalysis = {
    speedKnots: report.speedKnots,
    designSpeedKnots,
    plannedSpeedKnots,
    deviationFromDesignPct: speedDeviationFromDesignPct,
    deviationFromPlannedPct: speedDeviationFromPlannedPct,
    slowSteaming:
      report.speedKnots !== null && designSpeedKnots !== null && designSpeedKnots > 0
        ? report.speedKnots < designSpeedKnots * 0.9
        : null,
  };

  // ── Waiting / port ───────────────────────────────────────────────────────
  const waiting: WaitingState | null =
    operationalState === "WAITING" || operationalState === "IN_PORT"
      ? {
          stationary: true,
          speedKnots: report.speedKnots,
          distanceToGoNm,
          note:
            operationalState === "IN_PORT"
              ? "Vessel has effectively reached its destination (distance to go ≤ 5 nm at minimal speed)."
              : "Vessel is stationary at sea (speed ≤ 0.5 kt) without having reached its destination.",
        }
      : null;
  const port: PortOperations =
    operationalState === "IN_PORT"
      ? {
          inPort: true,
          destinationPort: plan?.destinationPort ?? null,
          note: "Vessel is in port (distance to go ≤ 5 nm at minimal speed).",
        }
      : {
          inPort: false,
          destinationPort: plan?.destinationPort ?? null,
          note: null,
        };

  // ── Prediction ───────────────────────────────────────────────────────────
  const etaSpeedKnots = speedMadeGoodKnots ?? report.speedKnots;
  const hoursToArrival =
    distanceToGoNm !== null && etaSpeedKnots !== null && etaSpeedKnots > 0
      ? round3(distanceToGoNm / etaSpeedKnots)
      : null;
  const arrivalDate =
    hoursToArrival !== null ? datePlusHours(report.reportDate, hoursToArrival) : null;
  const remainingConsumptionTonnes =
    rateTonnesPerDay !== null && hoursToArrival !== null
      ? round3(rateTonnesPerDay * (hoursToArrival / 24))
      : null;
  const predictedArrivalRobTonnes =
    robTonnes !== null && remainingConsumptionTonnes !== null
      ? round3(robTonnes - remainingConsumptionTonnes)
      : null;
  const prediction: ConsumptionPrediction = {
    arrivalDate,
    remainingConsumptionTonnes,
    predictedArrivalRobTonnes,
    confidence:
      arrivalDate !== null && remainingConsumptionTonnes !== null ? 0.8 : 0.2,
  };

  // ── Deviations ───────────────────────────────────────────────────────────
  const deviations: DeviationAnalysis[] = [];

  if (
    sinceLastReportTonnes !== null &&
    totalTonnes !== null &&
    totalTonnes > 0
  ) {
    const devPct = pctDifference(sinceLastReportTonnes, totalTonnes);
    const severity: DeviationSeverity =
      devPct !== null && Math.abs(devPct) > 5
        ? "HIGH"
        : devPct !== null && Math.abs(devPct) > 2
          ? "WARNING"
          : "INFO";
    if (severity !== "INFO") {
      deviations.push({
        kind: "CONSUMPTION",
        severity,
        actual: sinceLastReportTonnes,
        expected: totalTonnes,
        deviationPct: devPct,
        reason:
          `Reported consumption (${totalTonnes} t) does not match the ROB delta ` +
          `(previous ROB − current ROB = ${sinceLastReportTonnes} t).`,
        confidence: 0.8,
      });
    }
  }

  if (report.speedKnots !== null && plannedSpeedKnots !== null && plannedSpeedKnots > 0) {
    const devPct = speedDeviationFromPlannedPct;
    const severity: DeviationSeverity =
      report.speedKnots < plannedSpeedKnots * 0.9
        ? "HIGH"
        : devPct !== null && devPct < -5
          ? "WARNING"
          : "INFO";
    if (severity !== "INFO") {
      deviations.push({
        kind: "SPEED",
        severity,
        actual: report.speedKnots,
        expected: plannedSpeedKnots,
        deviationPct: devPct,
        reason:
          devPct !== null
            ? `Vessel speed (${report.speedKnots} kt) is ${devPct > 0 ? "+" : ""}${devPct}% vs the planned ${plannedSpeedKnots} kt.`
            : `Vessel speed (${report.speedKnots} kt) is below the planned ${plannedSpeedKnots} kt.`,
        confidence: 0.85,
      });
    }
  }

  if (rpmDeviationPct !== null && designRpm !== null && designRpm > 0) {
    const severity: DeviationSeverity =
      Math.abs(rpmDeviationPct) > 5 ? "HIGH" : Math.abs(rpmDeviationPct) > 3 ? "WARNING" : "INFO";
    if (severity !== "INFO") {
      deviations.push({
        kind: "RPM",
        severity,
        actual: rpm,
        expected: designRpm,
        deviationPct: rpmDeviationPct,
        reason: `Engine RPM (${rpm}) deviates from design RPM (${designRpm}) by ${rpmDeviationPct}%.`,
        confidence: 0.85,
      });
    }
  }

  if (slipPct !== null) {
    const severity: DeviationSeverity =
      slipPct > 15 ? "HIGH" : slipPct > 10 || slipPct < -10 ? "WARNING" : "INFO";
    if (severity !== "INFO") {
      deviations.push({
        kind: "SLIP",
        severity,
        actual: slipPct,
        expected: 5,
        deviationPct: slipPct,
        reason:
          `Apparent propeller slip of ${slipPct}% suggests fouling, weather drag, or speed log ` +
          `error (typical slip 5–10%).`,
        confidence: 0.8,
      });
    }
  }

  if (arrivalDate !== null && plan?.plannedArrival) {
    const lateHours = round3((Date.parse(arrivalDate) - Date.parse(plan.plannedArrival)) / 3_600_000);
    const severity: DeviationSeverity =
      lateHours > 6 ? "HIGH" : lateHours > 2 ? "WARNING" : lateHours < -6 ? "INFO" : "INFO";
    if (severity === "HIGH" || severity === "WARNING") {
      deviations.push({
        kind: "ARRIVAL",
        severity,
        actual: lateHours,
        expected: 0,
        deviationPct: lateHours,
        reason: `Predicted arrival ${arrivalDate} is ${Math.abs(lateHours)} h ${lateHours > 0 ? "late" : "early"} vs planned ${plan.plannedArrival}.`,
        confidence: 0.75,
      });
    }
  }

  if (predictedArrivalRobTonnes !== null && predictedArrivalRobTonnes < 0) {
    deviations.push({
      kind: "ROB",
      severity: "CRITICAL",
      actual: predictedArrivalRobTonnes,
      expected: 0,
      deviationPct: predictedArrivalRobTonnes,
      reason:
        `Predicted ROB at arrival (${predictedArrivalRobTonnes} t) is negative — the vessel may ` +
        `run out of fuel before reaching its destination.`,
      confidence: 0.85,
    });
  }

  // ── Dedup key ─────────────────────────────────────────────────────────────
  const dedupKey = [
    report.reportDate,
    report.positionLatitude ?? "none",
    report.positionLongitude ?? "none",
    report.fuelConsumptionTonnes ?? "none",
    report.fuelRobsTonnes ?? "none",
    report.speedKnots ?? "none",
    report.engineRpm ?? "none",
  ].join("|");

  return {
    engineVersion: NOON_REPORT_ENGINE_VERSION,
    evaluatedAt: now,
    vessel: input.vessel,
    operationalState,
    consumption,
    fuelBreakdown,
    remainingOnBoard,
    engine,
    weather,
    voyage,
    distance,
    slip,
    rpm: rpmAnalysis,
    speed,
    waiting,
    port,
    prediction,
    deviations,
    dedupKey,
  };
}

export function buildNoonDedupKey(report: NoonReportDomain): string {
  return [
    report.reportDate,
    report.positionLatitude ?? "none",
    report.positionLongitude ?? "none",
    report.fuelConsumptionTonnes ?? "none",
    report.fuelRobsTonnes ?? "none",
    report.speedKnots ?? "none",
    report.engineRpm ?? "none",
  ].join("|");
}
