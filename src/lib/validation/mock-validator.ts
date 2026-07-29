/**
 * mock-validator.ts — deterministic mock validation provider for tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The validation pipeline needs a provider that works without running the
 * real rules engine. This mock returns fixture data based on the document
 * type, providing deterministic validation results for testing.
 *
 * HOW IT FITS
 * When VALIDATION_USE_MOCK=true (default), the provider factory creates
 * this mock. Each document type maps to a deterministic fixture with
 * realistic scores, warnings, and rule results.
 */

import type {
  ValidationInput,
  ValidationReport,
  ValidationProvider,
  ValidationRuleResult,
} from "./types";

// ── Fixture data ─────────────────────────────────────────────────────────────

function makePassedRule(id: string, name: string, category: ValidationRuleResult["category"]): ValidationRuleResult {
  return {
    ruleId: id,
    ruleName: name,
    category,
    passed: true,
    severity: null,
    message: `${name} passed`,
  };
}

function makeFailedRule(id: string, name: string, category: ValidationRuleResult["category"], severity: ValidationRuleResult["severity"], message: string): ValidationRuleResult {
  return {
    ruleId: id,
    ruleName: name,
    category,
    passed: false,
    severity,
    message,
  };
}

const BDN_VALIDATION: ValidationReport = {
  status: "passed",
  score: 100,
  ruleResults: [
    makePassedRule("structural.required.imoNumber", "IMO Number is present", "structural"),
    makePassedRule("structural.required.vesselName", "Vessel Name is present", "structural"),
    makePassedRule("structural.type.imoNumber", "IMO Number has correct type", "structural"),
    makePassedRule("structural.date.deliveryDate", "Delivery Date is a valid date", "structural"),
    makePassedRule("structural.numeric.quantityTonnes", "Quantity (tonnes) is a valid number", "structural"),
    makePassedRule("structural.numeric.sulphurContentPct", "Sulphur Content (%) is a valid number", "structural"),
    makePassedRule("structural.numeric.densityKgM3", "Density (kg/m³) is a valid number", "structural"),
    makePassedRule("structural.notempty.port", "Port is not empty", "structural"),
    makePassedRule("structural.notempty.fuelType", "Fuel Type is not empty", "structural"),
    makePassedRule("structural.notempty.supplier", "Supplier is not empty", "structural"),
    makePassedRule("maritime.imo_format", "IMO number has valid format", "maritime"),
    makePassedRule("maritime.sulphur_range", "Sulphur content is within valid range", "maritime"),
    makePassedRule("maritime.density_range", "Fuel density is within valid range", "maritime"),
    makePassedRule("maritime.quantity_positive", "Fuel quantity is positive", "maritime"),
    makePassedRule("maritime.delivery_date_valid", "Delivery date is plausible", "maritime"),
    makePassedRule("maritime.port_not_empty", "Port name is not empty", "maritime"),
    makePassedRule("maritime.vessel_name_exists", "Vessel name exists", "maritime"),
    makePassedRule("confidence.ocr_high", "OCR confidence is adequate", "confidence"),
    makePassedRule("confidence.ai_high", "AI confidence is adequate", "confidence"),
    makePassedRule("confidence.summary_not_empty", "Summary is not empty", "confidence"),
    makePassedRule("confidence.no_extraction_warnings", "No AI extraction warnings", "confidence"),
    makePassedRule("confidence.few_missing_fields", "At most 2 missing fields", "confidence"),
    makePassedRule("confidence.duplicate_fields", "No significant duplicate field values", "confidence"),
  ],
  passedCount: 23,
  failedCount: 0,
  errorCount: 0,
  warningCount: 0,
  blockingIssues: [],
  recommendedReview: [],
  readyForReview: true,
};

const CII_VALIDATION: ValidationReport = {
  status: "passed",
  score: 100,
  ruleResults: [
    makePassedRule("structural.required.imoNumber", "IMO Number is present", "structural"),
    makePassedRule("structural.required.vesselName", "Vessel Name is present", "structural"),
    makePassedRule("structural.type.imoNumber", "IMO Number has correct type", "structural"),
    makePassedRule("structural.numeric.operationalCii", "Operational CII is a valid number", "structural"),
    makePassedRule("structural.numeric.requiredCii", "Required CII is a valid number", "structural"),
    makePassedRule("structural.numeric.attainedEexi", "Attained EEXI is a valid number", "structural"),
    makePassedRule("maritime.imo_format", "IMO number has valid format", "maritime"),
    makePassedRule("confidence.ocr_high", "OCR confidence is adequate", "confidence"),
    makePassedRule("confidence.ai_high", "AI confidence is adequate", "confidence"),
    makePassedRule("confidence.summary_not_empty", "Summary is not empty", "confidence"),
    makePassedRule("confidence.no_extraction_warnings", "No AI extraction warnings", "confidence"),
    makePassedRule("confidence.few_missing_fields", "At most 2 missing fields", "confidence"),
    makePassedRule("confidence.duplicate_fields", "No significant duplicate field values", "confidence"),
  ],
  passedCount: 13,
  failedCount: 0,
  errorCount: 0,
  warningCount: 0,
  blockingIssues: [],
  recommendedReview: [],
  readyForReview: true,
};

const EU_ETS_VALIDATION: ValidationReport = {
  status: "passed",
  score: 95,
  ruleResults: [
    makePassedRule("structural.required.imoNumber", "IMO Number is present", "structural"),
    makePassedRule("structural.required.vesselName", "Vessel Name is present", "structural"),
    makePassedRule("structural.type.imoNumber", "IMO Number has correct type", "structural"),
    makePassedRule("structural.numeric.totalCo2Tonnes", "Total CO₂ (tonnes) is a valid number", "structural"),
    makePassedRule("structural.numeric.allocatedAllowances", "Allocated Allowances is a valid number", "structural"),
    makePassedRule("maritime.imo_format", "IMO number has valid format", "maritime"),
    makePassedRule("confidence.ocr_high", "OCR confidence is adequate", "confidence"),
    makePassedRule("confidence.ai_high", "AI confidence is adequate", "confidence"),
    makePassedRule("confidence.summary_not_empty", "Summary is not empty", "confidence"),
    makePassedRule("confidence.no_extraction_warnings", "No AI extraction warnings", "confidence"),
    makePassedRule("confidence.few_missing_fields", "At most 2 missing fields", "confidence"),
    makePassedRule("confidence.duplicate_fields", "No significant duplicate field values", "confidence"),
    makeFailedRule(
      "confidence.ai_high",
      "AI confidence is adequate",
      "confidence",
      "warning",
      "AI confidence 91.0% is near threshold — manual verification recommended",
    ),
  ],
  passedCount: 12,
  failedCount: 1,
  errorCount: 0,
  warningCount: 1,
  blockingIssues: [],
  recommendedReview: ["1 warning(s) require manual review"],
  readyForReview: true,
};

const FUEL_EU_VALIDATION: ValidationReport = {
  status: "passed",
  score: 96,
  ruleResults: [
    makePassedRule("structural.required.imoNumber", "IMO Number is present", "structural"),
    makePassedRule("structural.required.vesselName", "Vessel Name is present", "structural"),
    makePassedRule("structural.type.imoNumber", "IMO Number has correct type", "structural"),
    makePassedRule("structural.numeric.totalEnergyMwh", "Total Energy (MWh) is a valid number", "structural"),
    makePassedRule("structural.numeric.ghgIntensityWtw", "GHG Intensity WTW is a valid number", "structural"),
    makePassedRule("structural.numeric.ghgIntensityTtw", "GHG Intensity TTW is a valid number", "structural"),
    makePassedRule("maritime.imo_format", "IMO number has valid format", "maritime"),
    makePassedRule("confidence.ocr_high", "OCR confidence is adequate", "confidence"),
    makePassedRule("confidence.ai_high", "AI confidence is adequate", "confidence"),
    makePassedRule("confidence.summary_not_empty", "Summary is not empty", "confidence"),
    makePassedRule("confidence.no_extraction_warnings", "No AI extraction warnings", "confidence"),
    makePassedRule("confidence.few_missing_fields", "At most 2 missing fields", "confidence"),
    makePassedRule("confidence.duplicate_fields", "No significant duplicate field values", "confidence"),
    makeFailedRule(
      "structural.numeric.ghgIntensityTtw",
      "GHG Intensity TTW is a valid number",
      "structural",
      "warning",
      "Tank-to-wake intensity near boundary — verify value",
    ),
  ],
  passedCount: 12,
  failedCount: 1,
  errorCount: 0,
  warningCount: 1,
  blockingIssues: [],
  recommendedReview: ["1 warning(s) require manual review"],
  readyForReview: true,
};

const UNKNOWN_VALIDATION: ValidationReport = {
  status: "warning",
  score: 65,
  ruleResults: [
    makePassedRule("structural.required.vesselName", "Vessel Name is present", "structural"),
    makePassedRule("confidence.summary_not_empty", "Summary is not empty", "confidence"),
    makeFailedRule(
      "structural.required.imoNumber",
      "IMO Number is present",
      "structural",
      "warning",
      "IMO number is missing or empty",
    ),
    makeFailedRule(
      "confidence.ai_high",
      "AI confidence is adequate",
      "confidence",
      "warning",
      "AI confidence 45.0% is below 60.0% threshold",
    ),
    makeFailedRule(
      "confidence.no_extraction_warnings",
      "No AI extraction warnings",
      "confidence",
      "warning",
      "AI extraction produced 2 warning(s): Document type could not be determined automatically; Manual classification recommended",
    ),
  ],
  passedCount: 2,
  failedCount: 3,
  errorCount: 0,
  warningCount: 3,
  blockingIssues: [],
  recommendedReview: [
    "3 warning(s) require manual review",
    "Low AI confidence — manual verification recommended",
  ],
  readyForReview: true,
};

const FIXTURE_MAP: Record<string, ValidationReport> = {
  imo_dcs: BDN_VALIDATION,
  report: CII_VALIDATION,
  eu_mrv: EU_ETS_VALIDATION,
  certificate: UNKNOWN_VALIDATION,
  correspondence: UNKNOWN_VALIDATION,
  logbook: UNKNOWN_VALIDATION,
  other: UNKNOWN_VALIDATION,
};

// ── Provider implementation ──────────────────────────────────────────────────

/**
 * Creates a deterministic mock validation provider.
 * Returns fixture data based on document type.
 */
export function createMockValidator(): ValidationProvider {
  return {
    async validate(input: ValidationInput): Promise<ValidationReport> {
      const fixture = FIXTURE_MAP[input.documentType] ?? UNKNOWN_VALIDATION;
      return { ...fixture };
    },
  };
}

/** Export fixtures for tests. */
export const MOCK_VALIDATION_FIXTURES = {
  bdn: BDN_VALIDATION,
  cii: CII_VALIDATION,
  euEts: EU_ETS_VALIDATION,
  fuelEu: FUEL_EU_VALIDATION,
  unknown: UNKNOWN_VALIDATION,
} as const;
