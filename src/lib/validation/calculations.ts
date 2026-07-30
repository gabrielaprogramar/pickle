import type { ValidationInput } from "./types";

export interface FuelTotals {
  readonly totalBunkeredTonnes: number;
  readonly totalConsumedTonnes: number;
  readonly totalRemainingTonnes: number;
}

export interface EmissionsMetrics {
  readonly co2PerEnergyUnit: number | null;
  readonly voyageToTotalRatio: number | null;
  readonly portToTotalRatio: number | null;
}

export interface VoyageMetrics {
  readonly distanceNm: number | null;
  readonly durationDays: number | null;
  readonly averageSpeedKnots: number | null;
}

export interface CiiMetrics {
  readonly operationalCii: number | null;
  readonly requiredCii: number | null;
  readonly ciiRatio: number | null;
  readonly isCompliant: boolean | null;
}

export interface FuelEuMetrics {
  readonly ghgIntensityWtw: number | null;
  readonly ghgIntensityTtw: number | null;
  readonly ghgReductionPct: number | null;
}

export interface EmissionsConsistency {
  readonly co2VsFuelRatio: number | null;
  readonly co2PerVoyageVsTotal: number | null;
  readonly isConsistent: boolean | null;
}

export function calculateFuelTotals(input: ValidationInput): FuelTotals {
  const fields = input.extractionFields;
  const bunkered = typeof fields.quantityTonnes === "number" ? fields.quantityTonnes : 0;
  const consumedFields = ["fuelConsumptionTonnes", "fuelUsedTonnes", "totalFuelConsumption"];
  let consumed = 0;
  for (const f of consumedFields) {
    if (typeof fields[f] === "number") {
      consumed += fields[f] as number;
    }
  }
  const robs = typeof fields.fuelRobsTonnes === "number" ? fields.fuelRobsTonnes : 0;
  return {
    totalBunkeredTonnes: bunkered,
    totalConsumedTonnes: consumed,
    totalRemainingTonnes: robs > 0 ? robs : Math.max(0, bunkered - consumed),
  };
}

export function calculateEmissionsMetrics(input: ValidationInput): EmissionsMetrics {
  const fields = input.extractionFields;
  const totalCo2 = typeof fields.totalCo2Tonnes === "number" ? fields.totalCo2Tonnes : null;
  const voyCo2 = typeof fields.euVoyageEmissionsTonnes === "number" ? fields.euVoyageEmissionsTonnes : null;
  const portCo2 = typeof fields.euPortEmissionsTonnes === "number" ? fields.euPortEmissionsTonnes : null;
  const energy = typeof fields.totalEnergyMwh === "number" ? fields.totalEnergyMwh : 0;

  return {
    co2PerEnergyUnit: energy > 0 && totalCo2 !== null ? totalCo2 / energy : null,
    voyageToTotalRatio: totalCo2 !== null && totalCo2 > 0 && voyCo2 !== null ? voyCo2 / totalCo2 : null,
    portToTotalRatio: totalCo2 !== null && totalCo2 > 0 && portCo2 !== null ? portCo2 / totalCo2 : null,
  };
}

export function calculateVoyageMetrics(input: ValidationInput): VoyageMetrics {
  const fields = input.extractionFields;
  const distance = typeof fields.distanceToGoNm === "number" ? fields.distanceToGoNm : null;
  const distanceActual = typeof fields.distanceActualNm === "number" ? fields.distanceActualNm : null;
  const speed = typeof fields.speedKnots === "number" ? fields.speedKnots : null;
  const depDate = typeof fields.departureDate === "string" ? new Date(fields.departureDate) : null;
  const arrDate = typeof fields.arrivalDate === "string" ? new Date(fields.arrivalDate) : null;

  const distNm = distanceActual ?? distance;
  let durationDays: number | null = null;
  if (depDate && arrDate && !isNaN(depDate.getTime()) && !isNaN(arrDate.getTime())) {
    durationDays = (arrDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24);
  }
  let avgSpeed: number | null = null;
  if (distNm && durationDays && durationDays > 0) {
    avgSpeed = distNm / (durationDays * 24);
  } else if (speed) {
    avgSpeed = speed;
  }
  return {
    distanceNm: distNm,
    durationDays,
    averageSpeedKnots: avgSpeed,
  };
}

export function calculateCiiMetrics(input: ValidationInput): CiiMetrics {
  const fields = input.extractionFields;
  const opCii = typeof fields.operationalCii === "number" ? fields.operationalCii : null;
  const reqCii = typeof fields.requiredCii === "number" ? fields.requiredCii : null;
  return {
    operationalCii: opCii,
    requiredCii: reqCii,
    ciiRatio: opCii !== null && reqCii !== null && reqCii > 0 ? opCii / reqCii : null,
    isCompliant: opCii !== null && reqCii !== null ? opCii <= reqCii : null,
  };
}

export function calculateFuelEuMetrics(input: ValidationInput): FuelEuMetrics {
  const fields = input.extractionFields;
  const wtw = typeof fields.ghgIntensityWtw === "number" ? fields.ghgIntensityWtw : null;
  const ttw = typeof fields.ghgIntensityTtw === "number" ? fields.ghgIntensityTtw : null;
  const reduction = typeof fields.euRelativeGhgIntensity === "number" ? fields.euRelativeGhgIntensity : null;
  return {
    ghgIntensityWtw: wtw,
    ghgIntensityTtw: ttw,
    ghgReductionPct: reduction,
  };
}

export function checkEmissionsConsistency(input: ValidationInput): EmissionsConsistency {
  const metrics = calculateEmissionsMetrics(input);
  const totals = calculateFuelTotals(input);
  let ratio: number | null = null;
  if (metrics.co2PerEnergyUnit !== null) {
    ratio = metrics.co2PerEnergyUnit;
  } else if (metrics.voyageToTotalRatio !== null) {
    ratio = metrics.voyageToTotalRatio;
  }
  const isConsistent = ratio !== null ? (ratio >= 0 && ratio <= 1) : null;
  return {
    co2VsFuelRatio: totals.totalConsumedTonnes > 0 && metrics.co2PerEnergyUnit !== null
      ? metrics.co2PerEnergyUnit : null,
    co2PerVoyageVsTotal: metrics.voyageToTotalRatio,
    isConsistent,
  };
}
