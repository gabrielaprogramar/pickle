/**
 * noon-report/ets-correlation.ts — noon report → EU-ETS operational inputs
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Extracts tank-to-wake CO₂ from noon report consumption so the EU-ETS engine
 * can be fed daily operational emissions. Reuses the shared emission-factor
 * registry (src/lib/fuel-delivery/emission-factors.ts) — it does NOT
 * re-implement ETS coverage or obligation calculations.
 *
 * Deterministic: an unattributed "UNKNOWN" fuel type is flagged `resolved:
 * false` instead of being silently proxied.
 */

import { getFuelEmissionInfo } from "@/lib/fuel-delivery/emission-factors";
import type {
  NoonEtsOperationalInput,
  NoonFinding,
  NoonReportAnalysis,
  NoonReportDomain,
} from "./types";
import { round3 } from "./engine";

export interface NoonEtsCorrelationInput {
  readonly report: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
}

export function correlateNoonEts(input: NoonEtsCorrelationInput): NoonEtsOperationalInput {
  const { report, analysis } = input;
  const findings: NoonFinding[] = [];

  const reportingYear = extractReportingYear(report.reportDate);
  const consumption = analysis.consumption.totalTonnes;
  const attribution = analysis.fuelBreakdown.items;

  const emissions: Array<{
    fuelType: string;
    tonnes: number;
    co2Tonnes: number | null;
    factorSource: string | null;
    resolved: boolean;
  }> = [];
  let resolvedCount = 0;
  let totalCo2Tonnes = 0;

  if (attribution.length === 0) {
    if (consumption !== null) {
      emissions.push({
        fuelType: "UNKNOWN",
        tonnes: consumption,
        co2Tonnes: null,
        factorSource: null,
        resolved: false,
      });
      findings.push({
        id: "noon.ets.unattributed_consumption",
        severity: "WARNING",
        confidence: 0.7,
        reason:
          `Consumption (${consumption} t) could not be attributed to fuel types, so EU-ETS ` +
          `operational CO₂ for this report is incomplete.`,
        remediation: "Supply fuel delivery data for the report window to enable attribution.",
        category: "compliance",
        ruleId: null,
        field: "fuelConsumptionTonnes",
      });
    }
  } else {
    for (const item of attribution) {
      const info = getFuelEmissionInfo(item.fuelType);
      if (item.fuelType === "UNKNOWN") {
        emissions.push({
          fuelType: item.fuelType,
          tonnes: item.tonnes,
          co2Tonnes: null,
          factorSource: null,
          resolved: false,
        });
        continue;
      }
      const co2Tonnes = round3(item.tonnes * info.co2_factor);
      emissions.push({
        fuelType: item.fuelType,
        tonnes: item.tonnes,
        co2Tonnes,
        factorSource: info.source,
        resolved: true,
      });
      resolvedCount += 1;
      totalCo2Tonnes += co2Tonnes;
    }
    totalCo2Tonnes = round3(totalCo2Tonnes);
  }

  const totalTonnes = round3(emissions.reduce((sum, m) => sum + m.tonnes, 0));

  return {
    reportingYear,
    reportCount: 1,
    daysCovered: analysis.consumption.intervalDays,
    emissions,
    totalCo2Tonnes: totalCo2Tonnes > 0 ? totalCo2Tonnes : null,
    totalTonnes,
    dataAvailable: resolvedCount > 0,
    findings,
  };
}

function extractReportingYear(reportDate: string): number {
  const parsed = Date.parse(reportDate);
  return Number.isFinite(parsed) ? new Date(parsed).getUTCFullYear() : new Date().getUTCFullYear();
}
