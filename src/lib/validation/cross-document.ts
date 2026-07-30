import type { ValidationInput, CrossDocumentInput, CrossDocumentValidationResult } from "./types";

function extractField(doc: ValidationInput, field: string): unknown {
  return doc.extractionFields[field];
}

function extractStr(doc: ValidationInput, field: string): string | undefined {
  const v = extractField(doc, field);
  return v === null || v === undefined ? undefined : String(v).trim();
}

function extractNum(doc: ValidationInput, field: string): number | undefined {
  const v = extractField(doc, field);
  if (v === null || v === undefined) return undefined;
  return typeof v === "number" ? v : Number(v);
}

function isPresent(doc: ValidationInput, field: string): boolean {
  const v = extractField(doc, field);
  return v !== null && v !== undefined && v !== "";
}

function imoDocTypes(): Set<string> {
  return new Set(["imo_dcs", "eu_mrv", "fuel_eu"]);
}

function fuelDocTypes(): Set<string> {
  return new Set(["bunker_delivery_note", "bunker_delivery", "bdn"]);
}

function voyageDocTypes(): Set<string> {
  return new Set(["noon_report", "logbook_entry", "noon", "logbook"]);
}

function hasType(doc: ValidationInput, types: Set<string>): boolean {
  return types.has(doc.documentType);
}

/**
 * Validate that bdn fuel quantity is consistent with IMO DCS fuel consumption.
 */
export function bdnFuelQuantityMatchesDcs(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const bdn = input.extractions.find((d) => hasType(d, fuelDocTypes()));
  const dcs = input.extractions.find((d) => d.documentType === "imo_dcs");
  if (!bdn || !dcs) {
    return {
      ruleId: "cross.bdn_vs_dcs_fuel",
      ruleName: "BDN fuel quantity vs IMO DCS fuel consumption",
      passed: true,
      severity: "info",
      message: !bdn ? "No BDN provided — cannot cross-validate" : "No IMO DCS provided — cannot cross-validate",
    };
  }
  const bdnQty = extractNum(bdn, "quantityTonnes");
  const dcsConsumed = extractNum(dcs, "fuelConsumptionTonnes");
  if (bdnQty === undefined || dcsConsumed === undefined) {
    return {
      ruleId: "cross.bdn_vs_dcs_fuel",
      ruleName: "BDN fuel quantity vs IMO DCS fuel consumption",
      passed: true,
      severity: "info",
      message: "Insufficient data for BDN vs DCS fuel comparison",
    };
  }
  const ratio = bdnQty / dcsConsumed;
  const passed = ratio >= 0.5 && ratio <= 2.0;
  return {
    ruleId: "cross.bdn_vs_dcs_fuel",
    ruleName: "BDN fuel quantity vs IMO DCS fuel consumption",
    passed,
    severity: passed ? "info" : "warning",
    message: passed
      ? `BDN quantity (${bdnQty}t) is consistent with DCS consumption (${dcsConsumed}t)`
      : `BDN quantity (${bdnQty}t) is inconsistent with DCS consumption (${dcsConsumed}t) — ratio ${ratio.toFixed(2)}`,
    remediation: !passed
      ? "The BDN bunkered quantity differs significantly from DCS reported consumption. Verify both documents."
      : undefined,
    ruleConfidence: 0.85,
  };
}

/**
 * Validate that bdn fuel type matches across documents.
 */
export function bdnFuelTypeMatchesEuMrv(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const bdn = input.extractions.find((d) => hasType(d, fuelDocTypes()));
  const mrv = input.extractions.find((d) => d.documentType === "eu_mrv");
  if (!bdn || !mrv) {
    return {
      ruleId: "cross.bdn_vs_mrv_fuel_type",
      ruleName: "BDN fuel type vs EU MRV",
      passed: true,
      severity: "info",
      message: !bdn ? "No BDN provided — cannot cross-validate fuel type" : "No EU MRV provided — cannot cross-validate fuel type",
    };
  }
  const bdnType = extractStr(bdn, "fuelType");
  const mrvType = extractStr(mrv, "fuelType");
  if (!bdnType || !mrvType) {
    return {
      ruleId: "cross.bdn_vs_mrv_fuel_type",
      ruleName: "BDN fuel type vs EU MRV",
      passed: true,
      severity: "info",
      message: "Fuel type not available in one or both documents",
    };
  }
  const passed = bdnType.toLowerCase() === mrvType.toLowerCase();
  return {
    ruleId: "cross.bdn_vs_mrv_fuel_type",
    ruleName: "BDN fuel type vs EU MRV",
    passed,
    severity: passed ? "info" : "error",
    message: passed
      ? `Fuel type "${bdnType}" matches across BDN and EU MRV`
      : `Fuel type mismatch: BDN="${bdnType}" vs EU MRV="${mrvType}"`,
    remediation: !passed
      ? "Fuel type differs between BDN and EU MRV documents. Verify which is correct and reconcile."
      : undefined,
    ruleConfidence: 0.9,
  };
}

/**
 * Validate that noon report voyage data is consistent with logbook / IMO DCS.
 */
export function voyageDistanceConsistency(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const noon = input.extractions.find((d) => d.documentType === "noon_report" || d.documentType === "noon");
  const logbook = input.extractions.find((d) => d.documentType === "logbook_entry" || d.documentType === "logbook");
  if (!noon || !logbook) {
    return {
      ruleId: "cross.voyage_distance",
      ruleName: "Voyage distance consistency across documents",
      passed: true,
      severity: "info",
      message: !noon ? "No Noon Report provided" : "No Logbook provided",
    };
  }
  const noonDist = extractNum(noon, "distanceActualNm");
  const logDist = extractNum(logbook, "distanceToGoNm");
  if (noonDist === undefined || logDist === undefined) {
    return {
      ruleId: "cross.voyage_distance",
      ruleName: "Voyage distance consistency across documents",
      passed: true,
      severity: "info",
      message: "Distance data not available in one or both documents",
    };
  }
  const diffPct = Math.abs(noonDist - logDist) / Math.max(noonDist, logDist);
  const passed = diffPct <= 0.2;
  return {
    ruleId: "cross.voyage_distance",
    ruleName: "Voyage distance consistency across documents",
    passed,
    severity: passed ? "info" : "warning",
    message: passed
      ? `Distance consistent: Noon=${noonDist}nm, Logbook=${logDist}nm`
      : `Distance mismatch: Noon=${noonDist}nm vs Logbook=${logDist}nm (${(diffPct * 100).toFixed(1)}% diff)`,
    remediation: !passed
      ? "Voyage distance differs by more than 20% between Noon Report and Logbook. Review both documents."
      : undefined,
    ruleConfidence: 0.8,
  };
}

/**
 * Validate that IMO number is consistent across all vessel-related documents.
 */
export function imoConsistencyAcrossDocuments(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const vesselDocs = input.extractions.filter((d) => hasType(d, imoDocTypes()) || hasType(d, fuelDocTypes()) || hasType(d, voyageDocTypes()));
  const imos: string[] = [];
  for (const doc of vesselDocs) {
    const imo = extractStr(doc, "imoNumber");
    if (imo) imos.push(imo);
  }
  if (imos.length <= 1) {
    return {
      ruleId: "cross.imo_consistency",
      ruleName: "IMO number consistency across documents",
      passed: true,
      severity: "info",
      message: imos.length === 0 ? "No IMO numbers found across documents" : "Only one document has an IMO number",
    };
  }
  const unique = new Set(imos);
  const passed = unique.size === 1;
  return {
    ruleId: "cross.imo_consistency",
    ruleName: "IMO number consistency across documents",
    passed,
    severity: passed ? "info" : "error",
    message: passed
      ? `IMO number ${imos[0]} is consistent across all documents`
      : `IMO number mismatch: found [${Array.from(unique).join(", ")}]`,
    remediation: !passed
      ? "IMO number differs across documents. Verify the correct IMO for this vessel."
      : undefined,
    ruleConfidence: 1.0,
  };
}

/**
 * Validate that vessel name is consistent across all documents.
 */
export function vesselNameConsistency(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const vesselDocs = input.extractions.filter((d) => hasType(d, imoDocTypes()) || hasType(d, fuelDocTypes()) || hasType(d, voyageDocTypes()));
  const names: string[] = [];
  for (const doc of vesselDocs) {
    const name = extractStr(doc, "vesselName");
    if (name) names.push(name);
  }
  if (names.length <= 1) {
    return {
      ruleId: "cross.vessel_name_consistency",
      ruleName: "Vessel name consistency across documents",
      passed: true,
      severity: "info",
      message: names.length === 0 ? "No vessel names found" : "Only one document has a vessel name",
    };
  }
  const unique = new Set(names.map((n) => n.toLowerCase()));
  const passed = unique.size === 1;
  return {
    ruleId: "cross.vessel_name_consistency",
    ruleName: "Vessel name consistency across documents",
    passed,
    severity: passed ? "info" : "warning",
    message: passed
      ? `Vessel name "${names[0]}" is consistent`
      : `Vessel name mismatch: found "${names.join('" vs "')}"`,
    remediation: !passed
      ? "Vessel name varies across documents. Minor spelling differences may be acceptable."
      : undefined,
    ruleConfidence: 0.9,
  };
}

/**
 * Validate that reporting period is consistent across regulatory documents.
 */
export function reportingPeriodConsistency(
  input: CrossDocumentInput,
): CrossDocumentValidationResult {
  const regDocs = input.extractions.filter((d) => hasType(d, imoDocTypes()));
  if (regDocs.length <= 1) {
    return {
      ruleId: "cross.reporting_period",
      ruleName: "Reporting period consistency across regulatory docs",
      passed: true,
      severity: "info",
      message: "Only one regulatory document provided — cannot cross-validate reporting period",
    };
  }
  const periods = regDocs.map((d) => extractStr(d, "reportingPeriod")).filter(Boolean);
  if (periods.length <= 1) {
    return {
      ruleId: "cross.reporting_period",
      ruleName: "Reporting period consistency across regulatory docs",
      passed: true,
      severity: "info",
      message: "Reporting period data not available for cross-validation",
    };
  }
  const unique = new Set(periods);
  const passed = unique.size === 1;
  return {
    ruleId: "cross.reporting_period",
    ruleName: "Reporting period consistency across regulatory docs",
    passed,
    severity: passed ? "info" : "error",
    message: passed
      ? `Reporting period "${periods[0]}" is consistent`
      : `Reporting period mismatch: found "${periods.join('" vs "')}"`,
    remediation: !passed
      ? "Reporting period differs between regulatory documents. Verify the correct period."
      : undefined,
    ruleConfidence: 1.0,
  };
}

/** All cross-document validators. */
export const CROSS_DOCUMENT_RULES: ReadonlyArray<(input: CrossDocumentInput) => CrossDocumentValidationResult> = [
  bdnFuelQuantityMatchesDcs,
  bdnFuelTypeMatchesEuMrv,
  voyageDistanceConsistency,
  imoConsistencyAcrossDocuments,
  vesselNameConsistency,
  reportingPeriodConsistency,
];

/**
 * Run all cross-document validations against the input.
 */
export function runCrossDocumentValidations(
  input: CrossDocumentInput,
): CrossDocumentValidationResult[] {
  return CROSS_DOCUMENT_RULES.map((rule) => rule(input));
}
