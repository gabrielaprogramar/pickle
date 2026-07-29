/**
 * rules.ts — validation rule implementations
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Implements the three validation categories: structural (required fields,
 * types, dates, numbers), maritime (IMO format, MMSI, coordinates, fuel
 * ranges, port names), and confidence (OCR confidence, AI confidence,
 * conflicting values, empty summaries).
 *
 * HOW IT FITS
 * The validator (validator.ts) calls runAllRules() with the extraction
 * fields and metadata. Each rule returns a ValidationRuleResult. The
 * engine aggregates results into a ValidationReport.
 */

import type {
  ValidationCategory,
  ValidationRuleResult,
  ValidationInput,
} from "./types";

// ── Rule type ────────────────────────────────────────────────────────────────

type RuleFn = (input: ValidationInput) => ValidationRuleResult;

// ── Structural Rules ─────────────────────────────────────────────────────────

const IMO_REGEX = /^\d{7}$/;
const MMSI_REGEX = /^\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/;

function ruleStructuralRequiredField(
  field: string,
  displayName: string,
): RuleFn {
  return (input) => ({
    ruleId: `structural.required.${field}`,
    ruleName: `${displayName} is present`,
    category: "structural" as ValidationCategory,
    passed: input.extractionFields[field] !== undefined
      && input.extractionFields[field] !== null
      && input.extractionFields[field] !== "",
    severity: null,
    message: input.extractionFields[field] !== undefined
      && input.extractionFields[field] !== null
      && input.extractionFields[field] !== ""
      ? `${displayName} is present`
      : `${displayName} is missing or empty`,
    field,
  });
}

function ruleStructuralType(
  field: string,
  displayName: string,
  expectedType: "string" | "number" | "boolean",
): RuleFn {
  return (input) => {
    const val = input.extractionFields[field];
    const passed = val !== undefined && val !== null && typeof val === expectedType;
    return {
      ruleId: `structural.type.${field}`,
      ruleName: `${displayName} has correct type`,
      category: "structural",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `${displayName} is of expected type (${expectedType})`
        : `${displayName} expected ${expectedType}, got ${val === null ? "null" : typeof val}`,
      field,
    };
  };
}

function ruleStructuralDate(field: string, displayName: string): RuleFn {
  return (input) => {
    const val = input.extractionFields[field];
    if (val === undefined || val === null || val === "") {
      return {
        ruleId: `structural.date.${field}`,
        ruleName: `${displayName} is a valid date`,
        category: "structural",
        passed: true,
        severity: null,
        message: `${displayName} not provided (optional)`,
        field,
      };
    }
    const str = String(val);
    const passed = ISO_DATE_REGEX.test(str) && !isNaN(Date.parse(str));
    return {
      ruleId: `structural.date.${field}`,
      ruleName: `${displayName} is a valid date`,
      category: "structural",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `${displayName} is a valid date`
        : `${displayName} "${str}" is not a valid ISO-8601 date`,
      field,
    };
  };
}

function ruleStructuralNumeric(field: string, displayName: string): RuleFn {
  return (input) => {
    const val = input.extractionFields[field];
    if (val === undefined || val === null) {
      return {
        ruleId: `structural.numeric.${field}`,
        ruleName: `${displayName} is a valid number`,
        category: "structural",
        passed: true,
        severity: null,
        message: `${displayName} not provided (optional)`,
        field,
      };
    }
    const num = Number(val);
    const passed = typeof val === "number" && !isNaN(num);
    return {
      ruleId: `structural.numeric.${field}`,
      ruleName: `${displayName} is a valid number`,
      category: "structural",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `${displayName} is a valid number`
        : `${displayName} "${String(val)}" is not a valid number`,
      field,
    };
  };
}

function ruleStructuralNotEmpty(field: string, displayName: string): RuleFn {
  return (input) => {
    const val = input.extractionFields[field];
    if (val === undefined || val === null) {
      return {
        ruleId: `structural.notempty.${field}`,
        ruleName: `${displayName} is not empty`,
        category: "structural",
        passed: true,
        severity: null,
        message: `${displayName} not provided (optional)`,
        field,
      };
    }
    const str = String(val).trim();
    const passed = str.length > 0;
    return {
      ruleId: `structural.notempty.${field}`,
      ruleName: `${displayName} is not empty`,
      category: "structural",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `${displayName} is not empty`
        : `${displayName} is empty`,
      field,
    };
  };
}

const STRUCTURAL_RULES: RuleFn[] = [
  ruleStructuralRequiredField("imoNumber", "IMO Number"),
  ruleStructuralRequiredField("vesselName", "Vessel Name"),
  ruleStructuralType("imoNumber", "IMO Number", "string"),
  ruleStructuralDate("deliveryDate", "Delivery Date"),
  ruleStructuralDate("reportingPeriod", "Reporting Period"),
  ruleStructuralNumeric("quantityTonnes", "Quantity (tonnes)"),
  ruleStructuralNumeric("sulphurContentPct", "Sulphur Content (%)"),
  ruleStructuralNumeric("densityKgM3", "Density (kg/m³)"),
  ruleStructuralNotEmpty("port", "Port"),
  ruleStructuralNotEmpty("fuelType", "Fuel Type"),
  ruleStructuralNotEmpty("supplier", "Supplier"),
  ruleStructuralNotEmpty("vesselName", "Vessel Name"),
  ruleStructuralNumeric("totalCo2Tonnes", "Total CO₂ (tonnes)"),
  ruleStructuralNumeric("allocatedAllowances", "Allocated Allowances"),
  ruleStructuralNumeric("operationalCii", "Operational CII"),
  ruleStructuralNumeric("requiredCii", "Required CII"),
  ruleStructuralNumeric("attainedEexi", "Attained EEXI"),
  ruleStructuralNumeric("totalEnergyMwh", "Total Energy (MWh)"),
  ruleStructuralNumeric("ghgIntensityWtw", "GHG Intensity WTW"),
  ruleStructuralNumeric("ghgIntensityTtw", "GHG Intensity TTW"),
];

// ── Maritime Rules ───────────────────────────────────────────────────────────

function ruleMaritimeImoFormat(): RuleFn {
  return (input) => {
    const val = input.extractionFields["imoNumber"];
    if (val === undefined || val === null || val === "") {
      return {
        ruleId: "maritime.imo_format",
        ruleName: "IMO number has valid format",
        category: "maritime",
        passed: true,
        severity: null,
        message: "IMO number not provided",
        field: "imoNumber",
      };
    }
    const str = String(val).trim();
    const passed = IMO_REGEX.test(str);
    return {
      ruleId: "maritime.imo_format",
      ruleName: "IMO number has valid format",
      category: "maritime",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `IMO ${str} has valid 7-digit format`
        : `IMO "${str}" must be exactly 7 digits`,
      field: "imoNumber",
    };
  };
}

function ruleMaritimeMmsiFormat(): RuleFn {
  return (input) => {
    const val = input.extractionFields["mmsi"];
    if (val === undefined || val === null || val === "") {
      return {
        ruleId: "maritime.mmsi_format",
        ruleName: "MMSI has valid format",
        category: "maritime",
        passed: true,
        severity: null,
        message: "MMSI not provided",
        field: "mmsi",
      };
    }
    const str = String(val).trim();
    const passed = MMSI_REGEX.test(str);
    return {
      ruleId: "maritime.mmsi_format",
      ruleName: "MMSI has valid format",
      category: "maritime",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `MMSI ${str} has valid 9-digit format`
        : `MMSI "${str}" must be exactly 9 digits`,
      field: "mmsi",
    };
  };
}

function ruleMaritimeFuelSulphurRange(): RuleFn {
  return (input) => {
    const val = input.extractionFields["sulphurContentPct"];
    if (val === undefined || val === null) {
      return {
        ruleId: "maritime.sulphur_range",
        ruleName: "Sulphur content is within valid range",
        category: "maritime",
        passed: true,
        severity: null,
        message: "Sulphur content not provided",
        field: "sulphurContentPct",
      };
    }
    const num = Number(val);
    const passed = !isNaN(num) && num >= 0 && num <= 10;
    return {
      ruleId: "maritime.sulphur_range",
      ruleName: "Sulphur content is within valid range",
      category: "maritime",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `Sulphur content ${num}% is within 0–10% range`
        : `Sulphur content ${num}% is outside valid range (0–10%)`,
      field: "sulphurContentPct",
    };
  };
}

function ruleMaritimeFuelDensityRange(): RuleFn {
  return (input) => {
    const val = input.extractionFields["densityKgM3"];
    if (val === undefined || val === null) {
      return {
        ruleId: "maritime.density_range",
        ruleName: "Fuel density is within valid range",
        category: "maritime",
        passed: true,
        severity: null,
        message: "Fuel density not provided",
        field: "densityKgM3",
      };
    }
    const num = Number(val);
    // Maritime fuel densities typically 800–1100 kg/m³
    const passed = !isNaN(num) && num >= 800 && num <= 1100;
    return {
      ruleId: "maritime.density_range",
      ruleName: "Fuel density is within valid range",
      category: "maritime",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `Fuel density ${num} kg/m³ is within 800–1100 range`
        : `Fuel density ${num} kg/m³ is outside typical range (800–1100)`,
      field: "densityKgM3",
    };
  };
}

function ruleMaritimeQuantityPositive(): RuleFn {
  return (input) => {
    const val = input.extractionFields["quantityTonnes"];
    if (val === undefined || val === null) {
      return {
        ruleId: "maritime.quantity_positive",
        ruleName: "Fuel quantity is positive",
        category: "maritime",
        passed: true,
        severity: null,
        message: "Quantity not provided",
        field: "quantityTonnes",
      };
    }
    const num = Number(val);
    const passed = !isNaN(num) && num > 0;
    return {
      ruleId: "maritime.quantity_positive",
      ruleName: "Fuel quantity is positive",
      category: "maritime",
      passed,
      severity: passed ? null : "error",
      message: passed
        ? `Quantity ${num} tonnes is positive`
        : `Quantity ${num} must be greater than 0`,
      field: "quantityTonnes",
    };
  };
}

function ruleMaritimeDeliveryDateValidity(): RuleFn {
  return (input) => {
    const val = input.extractionFields["deliveryDate"];
    if (val === undefined || val === null || val === "") {
      return {
        ruleId: "maritime.delivery_date_valid",
        ruleName: "Delivery date is plausible",
        category: "maritime",
        passed: true,
        severity: null,
        message: "Delivery date not provided",
        field: "deliveryDate",
      };
    }
    const str = String(val);
    if (!ISO_DATE_REGEX.test(str)) {
      return {
        ruleId: "maritime.delivery_date_valid",
        ruleName: "Delivery date is plausible",
        category: "maritime",
        passed: false,
        severity: "error",
        message: `Delivery date "${str}" is not a valid ISO date`,
        field: "deliveryDate",
      };
    }
    const date = new Date(str);
    const now = new Date();
    // Delivery date should not be more than 1 year in the future
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const passed = date <= oneYearFromNow;
    return {
      ruleId: "maritime.delivery_date_valid",
      ruleName: "Delivery date is plausible",
      category: "maritime",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `Delivery date ${str} is plausible`
        : `Delivery date ${str} is more than 1 year in the future`,
      field: "deliveryDate",
    };
  };
}

function ruleMaritimePortNotEmpty(): RuleFn {
  return (input) => {
    const val = input.extractionFields["port"];
    if (val === undefined || val === null) {
      return {
        ruleId: "maritime.port_not_empty",
        ruleName: "Port name is not empty",
        category: "maritime",
        passed: false,
        severity: "warning",
        message: "Port name is missing",
        field: "port",
      };
    }
    const str = String(val).trim();
    const passed = str.length > 0;
    return {
      ruleId: "maritime.port_not_empty",
      ruleName: "Port name is not empty",
      category: "maritime",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `Port "${str}" is provided`
        : "Port name is empty",
      field: "port",
    };
  };
}

function ruleMaritimeVesselNameExists(): RuleFn {
  return (input) => {
    const val = input.extractionFields["vesselName"];
    if (val === undefined || val === null) {
      return {
        ruleId: "maritime.vessel_name_exists",
        ruleName: "Vessel name exists",
        category: "maritime",
        passed: false,
        severity: "warning",
        message: "Vessel name is missing",
        field: "vesselName",
      };
    }
    const str = String(val).trim();
    const passed = str.length > 2;
    return {
      ruleId: "maritime.vessel_name_exists",
      ruleName: "Vessel name exists",
      category: "maritime",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `Vessel "${str}" has a valid name`
        : `Vessel name "${str}" appears too short`,
      field: "vesselName",
    };
  };
}

const MARITIME_RULES: RuleFn[] = [
  ruleMaritimeImoFormat(),
  ruleMaritimeMmsiFormat(),
  ruleMaritimeFuelSulphurRange(),
  ruleMaritimeFuelDensityRange(),
  ruleMaritimeQuantityPositive(),
  ruleMaritimeDeliveryDateValidity(),
  ruleMaritimePortNotEmpty(),
  ruleMaritimeVesselNameExists(),
];

// ── Confidence Rules ─────────────────────────────────────────────────────────

const LOW_OCR_THRESHOLD = 0.7;
const LOW_AI_THRESHOLD = 0.6;

function ruleConfidenceOcrHigh(): RuleFn {
  return (input) => {
    const passed = input.ocrConfidence >= LOW_OCR_THRESHOLD;
    return {
      ruleId: "confidence.ocr_high",
      ruleName: "OCR confidence is adequate",
      category: "confidence",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `OCR confidence ${(input.ocrConfidence * 100).toFixed(1)}% is above ${LOW_OCR_THRESHOLD * 100}% threshold`
        : `OCR confidence ${(input.ocrConfidence * 100).toFixed(1)}% is below ${LOW_OCR_THRESHOLD * 100}% threshold`,
    };
  };
}

function ruleConfidenceAiHigh(): RuleFn {
  return (input) => {
    const passed = input.extractionConfidence >= LOW_AI_THRESHOLD;
    return {
      ruleId: "confidence.ai_high",
      ruleName: "AI confidence is adequate",
      category: "confidence",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `AI confidence ${(input.extractionConfidence * 100).toFixed(1)}% is above ${LOW_AI_THRESHOLD * 100}% threshold`
        : `AI confidence ${(input.extractionConfidence * 100).toFixed(1)}% is below ${LOW_AI_THRESHOLD * 100}% threshold`,
    };
  };
}

function ruleConfidenceSummaryNotEmpty(): RuleFn {
  return (input) => {
    const passed = input.extractionSummary.trim().length > 0;
    return {
      ruleId: "confidence.summary_not_empty",
      ruleName: "Summary is not empty",
      category: "confidence",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? "Extraction summary is present"
        : "Extraction summary is empty",
    };
  };
}

function ruleConfidenceNoExtractionWarnings(): RuleFn {
  return (input) => {
    const passed = input.extractionWarnings.length === 0;
    return {
      ruleId: "confidence.no_extraction_warnings",
      ruleName: "No AI extraction warnings",
      category: "confidence",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? "No warnings from AI extraction"
        : `AI extraction produced ${input.extractionWarnings.length} warning(s): ${input.extractionWarnings.join("; ")}`,
    };
  };
}

function ruleConfidenceFewMissingFields(): RuleFn {
  return (input) => {
    const passed = input.extractionMissingFields.length <= 2;
    return {
      ruleId: "confidence.few_missing_fields",
      ruleName: "At most 2 missing fields",
      category: "confidence",
      passed,
      severity: passed ? null : "warning",
      message: passed
        ? `${input.extractionMissingFields.length} missing field(s) (acceptable)`
        : `${input.extractionMissingFields.length} missing field(s) — exceeds threshold of 2`,
    };
  };
}

function ruleConfidenceDuplicateFields(): RuleFn {
  return (input) => {
    // Check for duplicate values across different field keys (same string value
    // appearing in multiple fields suggests extraction confusion).
    const values = Object.values(input.extractionFields)
      .filter((v) => v !== null && v !== undefined)
      .map(String);
    const uniqueValues = new Set(values);
    const hasDuplicates = values.length > uniqueValues.size && values.length > 3;
    return {
      ruleId: "confidence.duplicate_fields",
      ruleName: "No significant duplicate field values",
      category: "confidence",
      passed: !hasDuplicates,
      severity: hasDuplicates ? "warning" : null,
      message: hasDuplicates
        ? "Multiple fields contain identical values — possible extraction confusion"
        : "No significant duplicate values detected",
    };
  };
}

const CONFIDENCE_RULES: RuleFn[] = [
  ruleConfidenceOcrHigh(),
  ruleConfidenceAiHigh(),
  ruleConfidenceSummaryNotEmpty(),
  ruleConfidenceNoExtractionWarnings(),
  ruleConfidenceFewMissingFields(),
  ruleConfidenceDuplicateFields(),
];

// ── Rule Engine ──────────────────────────────────────────────────────────────

/** All rules combined. */
export const ALL_RULES: RuleFn[] = [
  ...STRUCTURAL_RULES,
  ...MARITIME_RULES,
  ...CONFIDENCE_RULES,
];

/**
 * Run all validation rules against the input.
 * Returns individual rule results (passed and failed).
 */
export function runAllRules(input: ValidationInput): ValidationRuleResult[] {
  return ALL_RULES.map((rule) => {
    const result = rule(input);
    // Set severity for failed rules if not already set.
    if (!result.passed && result.severity === null) {
      return { ...result, severity: "warning" as const };
    }
    return result;
  });
}
