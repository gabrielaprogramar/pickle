/**
 * noon-report/fueleu-correlation.ts — noon report → FuelEU operational inputs
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The FuelEU engine consumes fuel-delivery evidence (FuelEuCalculationInput).
 * This module extracts *operational* energy from noon reports so the engine can
 * later be fed daily consumption. It reuses the shared LHV registry
 * (src/lib/fueleu/parameters.ts) — it does NOT re-implement FuelEU calculations.
 *
 * Deterministic: unknown fuel types are flagged `resolved: false` rather than
 * being guessed.
 */

import { getLhv } from "@/lib/fueleu/parameters";
import type {
  NoonFinding,
  NoonFuelEuOperationalInput,
  NoonReportAnalysis,
  NoonReportDomain,
} from "./types";
import { round3 } from "./engine";

export interface NoonFuelEuCorrelationInput {
  readonly report: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
}

export function correlateNoonFuelEu(input: NoonFuelEuCorrelationInput): NoonFuelEuOperationalInput {
  const { report, analysis } = input;
  const findings: NoonFinding[] = [];

  const reportingYear = extractReportingYear(report.reportDate);
  const consumption = analysis.consumption.totalTonnes;
  const attribution = analysis.fuelBreakdown.items;

  const energyMeters: Array<{
    fuelType: string;
    tonnes: number;
    energyMj: number | null;
    lhvSource: string | null;
    resolved: boolean;
  }> = [];
  let resolvedCount = 0;
  let totalEnergyMj = 0;

  if (attribution.length === 0) {
    if (consumption !== null) {
      energyMeters.push({
        fuelType: "UNKNOWN",
        tonnes: consumption,
        energyMj: null,
        lhvSource: null,
        resolved: false,
      });
      findings.push({
        id: "noon.fueleu.unattributed_consumption",
        severity: "WARNING",
        confidence: 0.7,
        reason:
          `Consumption (${consumption} t) could not be attributed to fuel types, so FuelEU ` +
          `operational energy for this report is incomplete.`,
        remediation: "Supply fuel delivery data for the report window to enable attribution.",
        category: "compliance",
        ruleId: null,
        field: "fuelConsumptionTonnes",
      });
    }
  } else {
    for (const item of attribution) {
      const lhv = getLhv(item.fuelType);
      if (lhv === undefined) {
        energyMeters.push({
          fuelType: item.fuelType,
          tonnes: item.tonnes,
          energyMj: null,
          lhvSource: null,
          resolved: false,
        });
        continue;
      }
      const energyMj = round3(item.tonnes * 1000 * lhv.lhv_mj_per_kg);
      energyMeters.push({
        fuelType: item.fuelType,
        tonnes: item.tonnes,
        energyMj,
        lhvSource: lhv.source,
        resolved: true,
      });
      resolvedCount += 1;
      totalEnergyMj += energyMj;
    }
    totalEnergyMj = round3(totalEnergyMj);
  }

  const totalTonnes = round3(energyMeters.reduce((sum, m) => sum + m.tonnes, 0));

  return {
    reportingYear,
    reportCount: 1,
    daysCovered: analysis.consumption.intervalDays,
    energyMeters,
    totalEnergyMj: totalEnergyMj > 0 ? totalEnergyMj : null,
    totalTonnes,
    dataAvailable: resolvedCount > 0,
    findings,
  };
}

function extractReportingYear(reportDate: string): number {
  const parsed = Date.parse(reportDate);
  return Number.isFinite(parsed) ? new Date(parsed).getUTCFullYear() : new Date().getUTCFullYear();
}
