/**
 * noon-report/validator.ts — noon report validation → findings
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Integrates with the shared validation RuleRegistry for documentType
 * "noon_report" (see src/lib/validation/rules.ts — noon.* rules) and augments
 * the results with data-quality and deterministic engine cross-checks. Output
 * is a flat list of NoonFinding, each with severity / confidence / reason /
 * remediation. Never calls an LLM.
 */

import { RULE_REGISTRY, toValidationContext } from "@/lib/validation";
import type { IRuleRegistry, ValidationSeverity } from "@/lib/validation";
import type {
  NoonFinding,
  NoonFindingCategory,
  NoonFindingSeverity,
  NoonReportAnalysis,
  NoonReportDomain,
  NoonValidatorResult,
} from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.6;

function severityToFindingSeverity(severity: ValidationSeverity): NoonFindingSeverity {
  switch (severity) {
    case "blocking":
      return "BLOCKING";
    case "error":
      return "ERROR";
    case "warning":
      return "WARNING";
    default:
      return "INFO";
  }
}

function categoryForRule(category: string): NoonFindingCategory {
  switch (category) {
    case "structural":
      return "structural";
    case "confidence":
      return "data_quality";
    default:
      return "data_quality";
  }
}

function categoryForDeviation(kind: string): NoonFindingCategory {
  switch (kind) {
    case "CONSUMPTION":
    case "ROB":
      return "fuel";
    case "SPEED":
    case "ARRIVAL":
      return "voyage";
    case "RPM":
    case "SLIP":
      return "engine";
    default:
      return "data_quality";
  }
}

function deviationSeverityToFindingSeverity(severity: string): NoonFindingSeverity {
  switch (severity) {
    case "CRITICAL":
      return "ERROR";
    case "HIGH":
      return "ERROR";
    case "WARNING":
      return "WARNING";
    default:
      return "INFO";
  }
}

function missingFieldsOf(report: NoonReportDomain): string[] {
  const missing: string[] = [];
  if (!report.imo) missing.push("imoNumber");
  if (!report.reportDate) missing.push("reportDate");
  if (report.positionLatitude === null) missing.push("positionLatitude");
  if (report.positionLongitude === null) missing.push("positionLongitude");
  return missing;
}

export interface NoonValidatorInput {
  readonly report: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
  readonly registry?: IRuleRegistry;
}

export function validateNoonReport(input: NoonValidatorInput): NoonValidatorResult {
  const { report, analysis } = input;
  const registry = input.registry ?? RULE_REGISTRY;
  const findings: NoonFinding[] = [];

  // ── Shared RuleRegistry results for "noon_report" ────────────────────────
  const fields: Record<string, unknown> = {
    imoNumber: report.imo || null,
    vesselName: report.vesselName,
    reportDate: report.reportDate || null,
    positionLatitude: report.positionLatitude,
    positionLongitude: report.positionLongitude,
    speedKnots: report.speedKnots,
    courseDegrees: report.courseDegrees,
    distanceToGoNm: report.distanceToGoNm,
    fuelConsumptionTonnes: report.fuelConsumptionTonnes,
    fuelRobsTonnes: report.fuelRobsTonnes,
    engineRpm: report.engineRpm,
    seaState: report.seaState,
    windSpeedKnots: report.windSpeedKnots,
    windDirection: report.windDirection,
    summary: report.summary,
  };

  const context = toValidationContext({
    extractionFields: fields,
    documentType: "noon_report",
    ocrConfidence: report.confidence,
    extractionConfidence: report.confidence,
    extractionSummary: report.summary ?? "",
    extractionWarnings: [...report.warnings],
    extractionMissingFields: missingFieldsOf(report),
  });

  for (const rule of registry.getRulesForDocumentType("noon_report")) {
    const result = rule.validate(context);
    if (result.passed) continue;
    const severity = severityToFindingSeverity(result.severity ?? "warning");
    if (severity === "INFO") continue;
    findings.push({
      id: result.ruleId,
      severity,
      confidence: result.ruleConfidence ?? 0.9,
      reason: result.message,
      remediation: result.remediation ?? null,
      category: categoryForRule(result.category),
      ruleId: result.ruleId,
      field: result.field ?? null,
    });
  }

  // ── Data-quality findings ─────────────────────────────────────────────────
  if (report.confidence < LOW_CONFIDENCE_THRESHOLD) {
    findings.push({
      id: "noon.data_quality.low_confidence",
      severity: "WARNING",
      confidence: 0.95,
      reason: `Extraction confidence is ${report.confidence.toFixed(2)}, below the ${LOW_CONFIDENCE_THRESHOLD.toFixed(2)} threshold.`,
      remediation:
        "Re-run OCR/extraction on a higher-quality scan, or manually verify the noon report values.",
      category: "data_quality",
      ruleId: null,
      field: null,
    });
  }

  for (const warning of report.warnings) {
    findings.push({
      id: "noon.data_quality.warning",
      severity: "WARNING",
      confidence: 0.8,
      reason: warning,
      remediation: "Manually verify the affected noon report field.",
      category: "data_quality",
      ruleId: null,
      field: null,
    });
  }

  // ── Heavy weather ─────────────────────────────────────────────────────────
  if (analysis.weather.significant === true) {
    findings.push({
      id: "noon.weather.significant",
      severity: "WARNING",
      confidence: 0.9,
      reason:
        `Wind speed of ${analysis.weather.windSpeedKnots} kt indicates significant weather ` +
        `(≥ 28 kt) — expect increased fuel consumption and slower speed made good.`,
      remediation:
        "Cross-check next noon report against speed/consumption expectations and consider weather routing.",
      category: "weather",
      ruleId: null,
      field: "windSpeedKnots",
    });
  }

  // ── Engine deviation findings ─────────────────────────────────────────────
  for (const deviation of analysis.deviations) {
    findings.push({
      id: `noon.deviation.${deviation.kind.toLowerCase()}`,
      severity: deviationSeverityToFindingSeverity(deviation.severity),
      confidence: deviation.confidence,
      reason: deviation.reason,
      remediation:
        deviation.kind === "ROB"
          ? "Arrange bunkering before the predicted fuel exhaustion point."
          : "Investigate the deviation and verify the underlying report values.",
      category: categoryForDeviation(deviation.kind),
      ruleId: null,
      field: null,
    });
  }

  // ── Score / status ────────────────────────────────────────────────────────
  let score = 100;
  for (const finding of findings) {
    switch (finding.severity) {
      case "BLOCKING":
        score -= 30;
        break;
      case "ERROR":
        score -= 15;
        break;
      case "WARNING":
        score -= 5;
        break;
      default:
        break;
    }
  }
  score = Math.max(0, Math.min(100, score));

  const blocked = findings.some((f) => f.severity === "BLOCKING");
  const hasError = findings.some((f) => f.severity === "ERROR");
  const hasWarning = findings.some((f) => f.severity === "WARNING");
  const status: NoonValidatorResult["status"] = blocked || hasError ? "FAILED" : hasWarning ? "WARNING" : "PASSED";

  return {
    status,
    score,
    findings,
    blocked,
    readyForReview: !blocked && score >= 80,
  };
}
