import type {
  ValidationCategory,
  ValidationRuleResult,
  ValidationInput,
  ValidationRule,
  ValidationContext,
} from "./types";
import { RuleRegistry, createRule } from "./rule-engine";

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMO_REGEX = /^\d{7}$/;
const MMSI_REGEX = /^\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/;
const LAT_REGEX = /^-?([0-8]?\d(\.\d+)?|90(\.0+)?)$/;
const LNG_REGEX = /^-?((1[0-7]\d|\d{1,2})(\.\d+)?|180(\.0+)?)$/;

function val(ctx: ValidationContext, field: string): unknown {
  return ctx.fields[field];
}

function str(ctx: ValidationContext, field: string): string | undefined {
  const v = val(ctx, field);
  return v === null || v === undefined ? undefined : String(v).trim();
}

function num(ctx: ValidationContext, field: string): number | undefined {
  const v = val(ctx, field);
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? undefined : n;
}

function present(ctx: ValidationContext, field: string): boolean {
  return val(ctx, field) !== undefined && val(ctx, field) !== null && val(ctx, field) !== "";
}

function getDate(ctx: ValidationContext, field: string): Date | undefined {
  const s = str(ctx, field);
  if (!s) return undefined;
  if (!ISO_DATE_REGEX.test(s)) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Structural Rules ─────────────────────────────────────────────────────────

const structuralRules: ValidationRule[] = [];

function addStructural(id: string, name: string, fields: string[], fn: (ctx: ValidationContext) => boolean) {
  structuralRules.push(createRule(
    `structural.${id}`,
    name,
    "structural",
    "error",
    [],
    (ctx) => {
      const passed = fn(ctx);
      const missingFields = fields.filter((f) => !present(ctx, f));
      return {
        passed,
        message: passed
          ? `${name}: all required fields present`
          : `${name}: missing fields — ${missingFields.join(", ")}`,
        field: fields[0],
      };
    },
  ));
}

function addType(field: string, displayName: string, expectedType: "string" | "number" | "boolean") {
  structuralRules.push(createRule(
    `structural.type.${field}`,
    `${displayName} has correct type`,
    "structural",
    "error",
    [],
    (ctx) => {
      const v = val(ctx, field);
      const passed = v !== undefined && v !== null && typeof v === expectedType;
      return {
        passed,
        message: passed
          ? `${displayName} is of expected type (${expectedType})`
          : `${displayName}: expected ${expectedType}, got ${v === null ? "null" : typeof v}`,
        field,
      };
    },
  ));
}

function addDate(field: string, displayName: string) {
  structuralRules.push(createRule(
    `structural.date.${field}`,
    `${displayName} is a valid date`,
    "structural",
    "error",
    [],
    (ctx) => {
      const s = str(ctx, field);
      if (!s) {
        return { passed: true, message: `${displayName} not provided (optional)`, field };
      }
      const passed = ISO_DATE_REGEX.test(s) && !isNaN(Date.parse(s));
      return {
        passed,
        message: passed
          ? `${displayName} is a valid date`
          : `${displayName} "${s}" is not a valid ISO-8601 date`,
        field,
      };
    },
  ));
}

function addNumeric(field: string, displayName: string) {
  structuralRules.push(createRule(
    `structural.numeric.${field}`,
    `${displayName} is a valid number`,
    "structural",
    "error",
    [],
    (ctx) => {
      const v = val(ctx, field);
      if (v === undefined || v === null) {
        return { passed: true, message: `${displayName} not provided (optional)`, field };
      }
      const passed = typeof v === "number" && !isNaN(v);
      return {
        passed,
        message: passed
          ? `${displayName} is a valid number`
          : `${displayName} "${String(v)}" is not a valid number`,
        field,
      };
    },
  ));
}

function addNotEmpty(field: string, displayName: string) {
  structuralRules.push(createRule(
    `structural.notempty.${field}`,
    `${displayName} is not empty`,
    "structural",
    "warning",
    [],
    (ctx) => {
      const s = str(ctx, field);
      if (s === undefined) {
        return { passed: true, message: `${displayName} not provided (optional)`, field };
      }
      const passed = s.length > 0;
      return {
        passed,
        message: passed ? `${displayName} is not empty` : `${displayName} is empty`,
        field,
      };
    },
  ));
}

// Build structural rules (backward-compatible IDs)
structuralRules.push(
  createRule("structural.required.imoNumber", "IMO Number is present", "structural", "error", [], (ctx) => ({
    passed: present(ctx, "imoNumber"),
    message: present(ctx, "imoNumber") ? "IMO Number is present" : "IMO Number is missing or empty",
    field: "imoNumber",
  })),
  createRule("structural.required.vesselName", "Vessel Name is present", "structural", "error", [], (ctx) => ({
    passed: present(ctx, "vesselName"),
    message: present(ctx, "vesselName") ? "Vessel Name is present" : "Vessel Name is missing or empty",
    field: "vesselName",
  })),
);

addType("imoNumber", "IMO Number", "string");
addDate("deliveryDate", "Delivery Date");
addDate("reportingPeriod", "Reporting Period");
addNumeric("quantityTonnes", "Quantity (tonnes)");
addNumeric("sulphurContentPct", "Sulphur Content (%)");
addNumeric("densityKgM3", "Density (kg/m³)");
addNotEmpty("port", "Port");
addNotEmpty("fuelType", "Fuel Type");
addNotEmpty("supplier", "Supplier");
addNotEmpty("vesselName", "Vessel Name");
addNumeric("totalCo2Tonnes", "Total CO₂ (tonnes)");
addNumeric("allocatedAllowances", "Allocated Allowances");
addNumeric("operationalCii", "Operational CII");
addNumeric("requiredCii", "Required CII");
addNumeric("attainedEexi", "Attained EEXI");
addNumeric("totalEnergyMwh", "Total Energy (MWh)");
addNumeric("ghgIntensityWtw", "GHG Intensity WTW");
addNumeric("ghgIntensityTtw", "GHG Intensity TTW");

// ── Maritime Format Rules ─────────────────────────────────────────────────────

const maritimeRules: ValidationRule[] = [
  createRule("maritime.imo_format", "IMO number has valid format", "maritime", "error", [], (ctx) => {
    const s = str(ctx, "imoNumber");
    if (!s) return { passed: true, message: "IMO number not provided", field: "imoNumber" };
    const passed = IMO_REGEX.test(s);
    return {
      passed,
      message: passed
        ? `IMO ${s} has valid 7-digit format`
        : `IMO "${s}" must be exactly 7 digits`,
      field: "imoNumber",
    };
  }),

  createRule("maritime.mmsi_format", "MMSI has valid format", "maritime", "error", [], (ctx) => {
    const s = str(ctx, "mmsi");
    if (!s) return { passed: true, message: "MMSI not provided", field: "mmsi" };
    const passed = MMSI_REGEX.test(s);
    return {
      passed,
      message: passed ? `MMSI ${s} has valid 9-digit format` : `MMSI "${s}" must be exactly 9 digits`,
      field: "mmsi",
    };
  }),

  createRule("maritime.sulphur_range", "Sulphur content is within valid range", "maritime", "error", [], (ctx) => {
    const n = num(ctx, "sulphurContentPct");
    if (n === undefined) return { passed: true, message: "Sulphur content not provided", field: "sulphurContentPct" };
    const passed = n >= 0 && n <= 10;
    return {
      passed,
      message: passed
        ? `Sulphur content ${n}% is within 0–10% range`
        : `Sulphur content ${n}% is outside valid range (0–10%)`,
      field: "sulphurContentPct",
    };
  }),

  createRule("maritime.density_range", "Fuel density is within valid range", "maritime", "warning", [], (ctx) => {
    const n = num(ctx, "densityKgM3");
    if (n === undefined) return { passed: true, message: "Fuel density not provided", field: "densityKgM3" };
    const passed = n >= 800 && n <= 1100;
    return {
      passed,
      message: passed
        ? `Fuel density ${n} kg/m³ is within 800–1100 range`
        : `Fuel density ${n} kg/m³ is outside typical range (800–1100)`,
      field: "densityKgM3",
    };
  }),

  createRule("maritime.quantity_positive", "Fuel quantity is positive", "maritime", "error", [], (ctx) => {
    const n = num(ctx, "quantityTonnes");
    if (n === undefined) return { passed: true, message: "Quantity not provided", field: "quantityTonnes" };
    const passed = n > 0;
    return {
      passed,
      message: passed ? `Quantity ${n} tonnes is positive` : `Quantity ${n} must be greater than 0`,
      field: "quantityTonnes",
    };
  }),

  createRule("maritime.delivery_date_valid", "Delivery date is plausible", "maritime", "warning", [], (ctx) => {
    const s = str(ctx, "deliveryDate");
    if (!s) return { passed: true, message: "Delivery date not provided", field: "deliveryDate" };
    if (!ISO_DATE_REGEX.test(s)) {
      return { passed: false, message: `Delivery date "${s}" is not a valid ISO date`, field: "deliveryDate" };
    }
    const date = new Date(s);
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const passed = date <= oneYearFromNow;
    return {
      passed,
      message: passed ? `Delivery date ${s} is plausible` : `Delivery date ${s} is more than 1 year in the future`,
      field: "deliveryDate",
    };
  }),

  createRule("maritime.port_not_empty", "Port name is not empty", "maritime", "warning", [], (ctx) => {
    const s = str(ctx, "port");
    if (s === undefined) return { passed: false, message: "Port name is missing", field: "port" };
    const passed = s.length > 0;
    return {
      passed,
      message: passed ? `Port "${s}" is provided` : "Port name is empty",
      field: "port",
    };
  }),

  createRule("maritime.vessel_name_exists", "Vessel name exists", "maritime", "warning", [], (ctx) => {
    const s = str(ctx, "vesselName");
    if (s === undefined) return { passed: false, message: "Vessel name is missing", field: "vesselName" };
    const passed = s.length > 2;
    return {
      passed,
      message: passed ? `Vessel "${s}" has a valid name` : `Vessel name "${s}" appears too short`,
      field: "vesselName",
    };
  }),
];

// ── Confidence Rules ─────────────────────────────────────────────────────────

const LOW_OCR_THRESHOLD = 0.7;
const LOW_AI_THRESHOLD = 0.6;

const confidenceRules: ValidationRule[] = [
  createRule("confidence.ocr_high", "OCR confidence is adequate", "confidence", "warning", [], (ctx) => {
    const passed = ctx.ocrConfidence >= LOW_OCR_THRESHOLD;
    return {
      passed,
      message: passed
        ? `OCR confidence ${(ctx.ocrConfidence * 100).toFixed(1)}% is above ${LOW_OCR_THRESHOLD * 100}% threshold`
        : `OCR confidence ${(ctx.ocrConfidence * 100).toFixed(1)}% is below ${LOW_OCR_THRESHOLD * 100}% threshold`,
    };
  }),

  createRule("confidence.ai_high", "AI confidence is adequate", "confidence", "warning", [], (ctx) => {
    const passed = ctx.extractionConfidence >= LOW_AI_THRESHOLD;
    return {
      passed,
      message: passed
        ? `AI confidence ${(ctx.extractionConfidence * 100).toFixed(1)}% is above ${LOW_AI_THRESHOLD * 100}% threshold`
        : `AI confidence ${(ctx.extractionConfidence * 100).toFixed(1)}% is below ${LOW_AI_THRESHOLD * 100}% threshold`,
    };
  }),

  createRule("confidence.summary_not_empty", "Summary is not empty", "confidence", "warning", [], (ctx) => {
    const passed = ctx.extractionSummary.trim().length > 0;
    return {
      passed,
      message: passed ? "Extraction summary is present" : "Extraction summary is empty",
    };
  }),

  createRule("confidence.no_extraction_warnings", "No AI extraction warnings", "confidence", "warning", [], (ctx) => {
    const passed = ctx.extractionWarnings.length === 0;
    return {
      passed,
      message: passed
        ? "No warnings from AI extraction"
        : `AI extraction produced ${ctx.extractionWarnings.length} warning(s): ${ctx.extractionWarnings.join("; ")}`,
    };
  }),

  createRule("confidence.few_missing_fields", "At most 2 missing fields", "confidence", "warning", [], (ctx) => {
    const passed = ctx.extractionMissingFields.length <= 2;
    return {
      passed,
      message: passed
        ? `${ctx.extractionMissingFields.length} missing field(s) (acceptable)`
        : `${ctx.extractionMissingFields.length} missing field(s) — exceeds threshold of 2`,
    };
  }),

  createRule("confidence.duplicate_fields", "No significant duplicate field values", "confidence", "warning", [], (ctx) => {
    const values = Object.values(ctx.fields)
      .filter((v) => v !== null && v !== undefined)
      .map(String);
    const uniqueValues = new Set(values);
    const hasDuplicates = values.length > uniqueValues.size && values.length > 3;
    return {
      passed: !hasDuplicates,
      message: hasDuplicates
        ? "Multiple fields contain identical values — possible extraction confusion"
        : "No significant duplicate values detected",
    };
  }),
];

// ── IMO DCS Rule Group ────────────────────────────────────────────────────────

const imoDcsRules: ValidationRule[] = [
  createRule("dcs.required_fields", "All DCS required fields present", "structural", "blocking", ["imo_dcs"], (ctx) => {
    const required = ["imoNumber", "vesselName", "shipType", "ratingYear", "ciiRating", "operationalCii", "requiredCii"];
    const missing = required.filter((f) => !present(ctx, f));
    return {
      passed: missing.length === 0,
      message: missing.length === 0
        ? "All DCS required fields present"
        : `Missing DCS fields: ${missing.join(", ")}`,
      field: "imoNumber",
      remediation: missing.length > 0
        ? "Ensure the DCS document contains IMO number, vessel name, ship type, rating year, CII rating, and CII values. Re-run extraction if fields are missing."
        : undefined,
    };
  }),

  createRule("dcs.fuel_total_positive", "Fuel total is positive", "maritime", "error", ["imo_dcs"], (ctx) => {
    const n = num(ctx, "quantityTonnes");
    if (n === undefined) return { passed: true, message: "Fuel total not provided", field: "quantityTonnes" };
    return {
      passed: n > 0,
      message: n > 0 ? `Fuel total ${n} tonnes is positive` : `Fuel total ${n} must be > 0`,
      field: "quantityTonnes",
      remediation: n <= 0 ? "Fuel total must be greater than zero. Verify the extracted value against the DCS document." : undefined,
    };
  }),

  createRule("dcs.hours_underway", "Hours underway is non-negative", "maritime", "error", ["imo_dcs"], (ctx) => {
    const n = num(ctx, "hoursUnderway");
    if (n === undefined) return { passed: true, message: "Hours underway not provided", field: "hoursUnderway" };
    return {
      passed: n >= 0,
      message: n >= 0 ? `Hours underway ${n} is valid` : `Hours underway ${n} must be >= 0`,
      field: "hoursUnderway",
    };
  }),

  createRule("dcs.date_consistency", "Arrival after departure", "maritime", "error", ["imo_dcs"], (ctx) => {
    const dep = getDate(ctx, "departureDate");
    const arr = getDate(ctx, "arrivalDate");
    if (!dep || !arr) return { passed: true, message: "Departure/arrival dates not provided for comparison", field: "departureDate" };
    const passed = arr > dep;
    return {
      passed,
      message: passed ? "Arrival date is after departure date" : "Arrival date must be after departure date",
      field: "arrivalDate",
      remediation: !passed ? "Arrival date is before or equal to departure date. Verify both dates in the source document." : undefined,
    };
  }),

  createRule("dcs.valid_cii_rating", "CII rating is valid letter A-E", "maritime", "error", ["imo_dcs"], (ctx) => {
    const s = str(ctx, "ciiRating");
    if (!s) return { passed: true, message: "CII rating not provided", field: "ciiRating" };
    const passed = /^[A-E]$/.test(s.toUpperCase());
    return {
      passed,
      message: passed ? `CII rating "${s}" is valid` : `CII rating "${s}" must be a single letter A-E`,
      field: "ciiRating",
      remediation: !passed ? "CII rating must be a single letter from A to E. Verify the extracted value." : undefined,
    };
  }),
];

// ── EU MRV Rule Group ─────────────────────────────────────────────────────────

const euMrvRules: ValidationRule[] = [
  createRule("mrv.required_fields", "All MRV required fields present", "structural", "blocking", ["eu_mrv"], (ctx) => {
    const required = ["imoNumber", "vesselName", "reportingPeriod", "totalCo2Tonnes", "monitoringMethodology"];
    const missing = required.filter((f) => !present(ctx, f));
    return {
      passed: missing.length === 0,
      message: missing.length === 0
        ? "All MRV required fields present"
        : `Missing MRV fields: ${missing.join(", ")}`,
      field: "imoNumber",
      remediation: missing.length > 0
        ? "Ensure the EU MRV document contains IMO number, vessel name, reporting period, total CO₂ tonnes, and monitoring methodology. Re-run extraction if fields are missing."
        : undefined,
    };
  }),

  createRule("mrv.emissions_positive", "Emissions values are positive", "maritime", "error", ["eu_mrv"], (ctx) => {
    const fields = ["totalCo2Tonnes", "euVoyageEmissionsTonnes", "euPortEmissionsTonnes"];
    const issues: string[] = [];
    for (const f of fields) {
      const n = num(ctx, f);
      if (n !== undefined && n < 0) issues.push(f);
    }
    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? "All emissions values are non-negative"
        : `Negative emission values: ${issues.join(", ")}`,
      field: fields[0],
      remediation: issues.length > 0
        ? "Emissions values cannot be negative. Verify the extracted values in the MRV document."
        : undefined,
    };
  }),

  createRule("mrv.allocated_allowances_valid", "Allocated allowances is valid", "maritime", "warning", ["eu_mrv"], (ctx) => {
    const n = num(ctx, "allocatedAllowances");
    if (n === undefined) return { passed: true, message: "Allocated allowances not provided", field: "allocatedAllowances" };
    return {
      passed: n >= 0,
      message: n >= 0 ? `Allocated allowances ${n} is valid` : `Allocated allowances ${n} must be >= 0`,
      field: "allocatedAllowances",
      remediation: n !== undefined && n < 0 ? "Allocated allowances must be a non-negative number." : undefined,
    };
  }),

  createRule("mrv.monitoring_methodology", "Monitoring methodology is present", "structural", "warning", ["eu_mrv"], (ctx) => {
    const s = str(ctx, "monitoringMethodology");
    return {
      passed: !!s && s.length > 0,
      message: s ? `Monitoring methodology: ${s}` : "Monitoring methodology is missing",
      field: "monitoringMethodology",
      remediation: !s || s.length === 0 ? "Monitoring methodology is required for EU MRV compliance. Add the methodology (e.g., BDN, direct measurement)." : undefined,
    };
  }),
];

// ── BDN Rule Group ────────────────────────────────────────────────────────────

const bdnRules: ValidationRule[] = [
  createRule("bdn.supplier_present", "Supplier is present", "structural", "error", ["imo_dcs"], (ctx) => {
    const s = str(ctx, "supplier");
    return {
      passed: !!s && s.length > 0,
      message: s ? `Supplier: ${s}` : "Supplier is missing",
      field: "supplier",
      remediation: !s || s.length === 0 ? "Supplier name is required on BDN. Verify the document image." : undefined,
    };
  }),

  createRule("bdn.fuel_grade_present", "Fuel grade/type is present", "structural", "error", ["imo_dcs"], (ctx) => {
    const s = str(ctx, "fuelType");
    return {
      passed: !!s && s.length > 0,
      message: s ? `Fuel grade: ${s}` : "Fuel grade is missing",
      field: "fuelType",
      remediation: !s || s.length === 0 ? "Fuel grade/type is required on BDN. Verify the document image." : undefined,
    };
  }),

  createRule("bdn.quantity_positive", "Quantity is > 0", "maritime", "error", ["imo_dcs"], (ctx) => {
    const n = num(ctx, "quantityTonnes");
    if (n === undefined) return { passed: false, message: "Quantity is missing", field: "quantityTonnes" };
    return {
      passed: n > 0,
      message: n > 0 ? `Quantity ${n} tonnes > 0` : `Quantity ${n} must be > 0`,
      field: "quantityTonnes",
      remediation: n <= 0 ? "Bunkered quantity must be greater than zero. Verify the extracted value." : undefined,
    };
  }),

  createRule("bdn.delivery_date_present", "Delivery date is present", "structural", "error", ["imo_dcs"], (ctx) => {
    const s = str(ctx, "deliveryDate");
    return {
      passed: !!s,
      message: s ? `Delivery date: ${s}` : "Delivery date is missing",
      field: "deliveryDate",
      remediation: !s ? "Delivery date is required on BDN. Verify the document image." : undefined,
    };
  }),

  createRule("bdn.bdn_reference_present", "BDN reference is present", "structural", "warning", ["imo_dcs"], (ctx) => {
    const s = str(ctx, "bdnReference");
    return {
      passed: !!s && s.length > 0,
      message: s ? `BDN reference: ${s}` : "BDN reference is missing",
      field: "bdnReference",
      remediation: !s || s.length === 0 ? "BDN reference number may be required for audit trails. Verify the document image." : undefined,
    };
  }),
];

// ── Noon Report Rule Group ────────────────────────────────────────────────────

const noonReportRules: ValidationRule[] = [
  createRule("noon.required_fields", "All Noon Report required fields present", "structural", "blocking", ["noon_report"], (ctx) => {
    const required = ["imoNumber", "vesselName", "reportDate", "positionLatitude", "positionLongitude"];
    const missing = required.filter((f) => !present(ctx, f));
    return {
      passed: missing.length === 0,
      message: missing.length === 0
        ? "All Noon Report required fields present"
        : `Missing Noon Report fields: ${missing.join(", ")}`,
      field: "imoNumber",
      remediation: missing.length > 0
        ? "Ensure the Noon Report contains IMO number, vessel name, report date, and position coordinates. Re-run extraction if fields are missing."
        : undefined,
    };
  }),

  createRule("noon.rpm_range", "RPM is within valid range", "maritime", "warning", ["noon_report"], (ctx) => {
    const n = num(ctx, "engineRpm");
    if (n === undefined) return { passed: true, message: "RPM not provided", field: "engineRpm" };
    const passed = n >= 0 && n <= 500;
    return {
      passed,
      message: passed ? `RPM ${n} is within 0–500 range` : `RPM ${n} exceeds typical range (0–500)`,
      field: "engineRpm",
      remediation: n !== undefined && !passed ? "RPM value exceeds typical marine engine range (0–500). Verify the extracted value." : undefined,
    };
  }),

  createRule("noon.speed_range", "Speed is within valid range", "maritime", "warning", ["noon_report"], (ctx) => {
    const n = num(ctx, "speedKnots");
    if (n === undefined) return { passed: true, message: "Speed not provided", field: "speedKnots" };
    const passed = n >= 0 && n <= 60;
    return {
      passed,
      message: passed ? `Speed ${n} knots is within 0–60 range` : `Speed ${n} knots exceeds typical range (0–60)`,
      field: "speedKnots",
      remediation: n !== undefined && !passed ? "Vessel speed exceeds typical maximum (60 knots). Verify the extracted value." : undefined,
    };
  }),

  createRule("noon.coordinates_valid", "Position coordinates are valid", "maritime", "error", ["noon_report"], (ctx) => {
    const lat = num(ctx, "positionLatitude");
    const lng = num(ctx, "positionLongitude");
    if (lat === undefined || lng === undefined) {
      return { passed: true, message: "Position coordinates not provided", field: "positionLatitude" };
    }
    const latOk = lat >= -90 && lat <= 90;
    const lngOk = lng >= -180 && lng <= 180;
    return {
      passed: latOk && lngOk,
      message: latOk && lngOk
        ? `Position (${lat}, ${lng}) is within valid ranges`
        : `Position (${lat}, ${lng}) is outside valid range (lat: ±90, lng: ±180)`,
      field: "positionLatitude",
      remediation: !(latOk && lngOk) ? "Latitude must be between -90 and 90, longitude between -180 and 180. Verify coordinates." : undefined,
    };
  }),

  createRule("noon.weather_fields_sanity", "Weather fields are within reasonable range", "maritime", "warning", ["noon_report"], (ctx) => {
    const windKts = num(ctx, "windSpeedKnots");
    const issues: string[] = [];
    if (windKts !== undefined && (windKts < 0 || windKts > 150)) {
      issues.push(`windSpeed ${windKts} knots exceeds typical max 150`);
    }
    return {
      passed: issues.length === 0,
      message: issues.length === 0 ? "Weather fields are reasonable" : issues.join("; "),
      field: "windSpeedKnots",
      remediation: issues.length > 0 ? "Wind speed exceeds typical maximum (150 knots). Verify the extracted value." : undefined,
    };
  }),
];

// ── Logbook Rule Group ────────────────────────────────────────────────────────

const logbookRules: ValidationRule[] = [
  createRule("logbook.required_fields", "All Logbook required fields present", "structural", "blocking", ["logbook"], (ctx) => {
    const required = ["imoNumber", "vesselName", "entryDate", "entryType"];
    const missing = required.filter((f) => !present(ctx, f));
    return {
      passed: missing.length === 0,
      message: missing.length === 0
        ? "All Logbook required fields present"
        : `Missing Logbook fields: ${missing.join(", ")}`,
      field: "imoNumber",
      remediation: missing.length > 0
        ? "Ensure the Logbook entry contains IMO number, vessel name, entry date, and entry type. Re-run extraction if fields are missing."
        : undefined,
    };
  }),

  createRule("logbook.position_continuity", "Position coordinates are valid", "maritime", "warning", ["logbook"], (ctx) => {
    const lat = num(ctx, "positionLatitude");
    const lng = num(ctx, "positionLongitude");
    if (lat === undefined || lng === undefined) {
      return { passed: true, message: "Position not provided for continuity check", field: "positionLatitude" };
    }
    const latOk = lat >= -90 && lat <= 90;
    const lngOk = lng >= -180 && lng <= 180;
    return {
      passed: latOk && lngOk,
      message: latOk && lngOk
        ? `Position (${lat}, ${lng}) is valid`
        : `Position (${lat}, ${lng}) is outside valid range`,
      field: "positionLatitude",
      remediation: !(latOk && lngOk) ? "Latitude must be between -90 and 90, longitude between -180 and 180. Verify coordinates." : undefined,
    };
  }),

  createRule("logbook.engine_hours", "Engine hours are valid", "maritime", "warning", ["logbook"], (ctx) => {
    const n = num(ctx, "engineHours");
    if (n === undefined) return { passed: true, message: "Engine hours not provided", field: "engineHours" };
    const passed = n >= 0 && n <= 500;
    return {
      passed,
      message: passed ? `Engine hours ${n} is plausible` : `Engine hours ${n} seems excessive for a single entry`,
      field: "engineHours",
    };
  }),

  createRule("logbook.entry_type_valid", "Entry type is present", "structural", "warning", ["logbook"], (ctx) => {
    const s = str(ctx, "entryType");
    return {
      passed: !!s && s.length > 0,
      message: s ? `Entry type: ${s}` : "Entry type is missing",
      field: "entryType",
    };
  }),
];

// ── FuelEU Maritime Rule Group ───────────────────────────────────────────────

const fuelEuRules: ValidationRule[] = [
  createRule("fueleu.required_fields", "All FuelEU required fields present", "structural", "blocking", ["fuel_eu"], (ctx) => {
    const required = ["imoNumber", "vesselName", "reportingPeriod", "totalEnergyMwh", "ghgIntensityWtw", "ghgIntensityTtw"];
    const missing = required.filter((f) => !present(ctx, f));
    return {
      passed: missing.length === 0,
      message: missing.length === 0
        ? "All FuelEU required fields present"
        : `Missing FuelEU fields: ${missing.join(", ")}`,
      field: "imoNumber",
      remediation: missing.length > 0
        ? "Ensure the document contains IMO number, vessel name, reporting period, total energy (MWh), and GHG intensity values (WTW and TTW). Re-run extraction if fields are missing."
        : undefined,
    };
  }),

  createRule("fueleu.energy_positive", "Total energy is positive", "maritime", "error", ["fuel_eu"], (ctx) => {
    const n = num(ctx, "totalEnergyMwh");
    if (n === undefined) return { passed: true, message: "Total energy not provided", field: "totalEnergyMwh" };
    return {
      passed: n > 0,
      message: n > 0 ? `Total energy ${n} MWh is positive` : `Total energy ${n} MWh must be > 0`,
      field: "totalEnergyMwh",
      remediation: n <= 0 ? "Total energy consumption must be greater than zero. Verify the extracted value." : undefined,
    };
  }),

  createRule("fueleu.ghg_intensity_range", "GHG intensity values are within plausible range", "maritime", "warning", ["fuel_eu"], (ctx) => {
    const wtw = num(ctx, "ghgIntensityWtw");
    const ttw = num(ctx, "ghgIntensityTtw");
    const issues: string[] = [];
    if (wtw !== undefined && (wtw < 0 || wtw > 200)) issues.push(`WTW ${wtw} outside 0–200 range`);
    if (ttw !== undefined && (ttw < 0 || ttw > 150)) issues.push(`TTW ${ttw} outside 0–150 range`);
    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? "GHG intensity values are within plausible ranges"
        : `GHG intensity issues: ${issues.join("; ")}`,
      field: "ghgIntensityWtw",
      remediation: issues.length > 0
        ? "GHG intensity values outside typical maritime fuel ranges. Verify the extracted values against the source document."
        : undefined,
      ruleConfidence: 0.85,
    };
  }),

  createRule("fueleu.wtw_greater_than_ttw", "WTW intensity >= TTW intensity", "maritime", "error", ["fuel_eu"], (ctx) => {
    const wtw = num(ctx, "ghgIntensityWtw");
    const ttw = num(ctx, "ghgIntensityTtw");
    if (wtw === undefined || ttw === undefined) {
      return { passed: true, message: "Insufficient GHG data for WTW vs TTW comparison", field: "ghgIntensityWtw" };
    }
    const passed = wtw >= ttw;
    return {
      passed,
      message: passed
        ? `WTW (${wtw}) >= TTW (${ttw}) — consistent`
        : `WTW (${wtw}) < TTW (${ttw}) — WTW should be >= TTW as it includes well-to-tank`,
      field: "ghgIntensityWtw",
      remediation: !passed
        ? "Well-to-Wake intensity should be greater than or equal to Tank-to-Wake. This may indicate an extraction error."
        : undefined,
    };
  }),

  createRule("fueleu.compliance_status", "FuelEU compliance status is determinable", "maritime", "info", ["fuel_eu"], (ctx) => {
    const isCompliant = val(ctx, "isCompliant");
    if (isCompliant === undefined || isCompliant === null) {
      return { passed: true, message: "Compliance status not provided", field: "isCompliant" };
    }
    const passed = typeof isCompliant === "boolean";
    return {
      passed,
      message: passed
        ? `Compliance status: ${isCompliant ? "Compliant" : "Non-compliant"}`
        : "Compliance status must be a boolean value",
      field: "isCompliant",
    };
  }),

  createRule("fueleu.fuel_breakdown", "Fuel breakdown data is present when expected", "structural", "info", ["fuel_eu"], (ctx) => {
    const breakdown = val(ctx, "fuelBreakdown");
    if (breakdown === undefined || breakdown === null) {
      return { passed: true, message: "Fuel breakdown not provided (optional)", field: "fuelBreakdown" };
    }
    const arr = Array.isArray(breakdown) ? breakdown : [breakdown];
    const passed = arr.length > 0;
    return {
      passed,
      message: passed
        ? `Fuel breakdown with ${arr.length} fuel type(s) present`
        : "Fuel breakdown is empty",
      field: "fuelBreakdown",
      remediation: !passed
        ? "If the document contains fuel type data, re-run extraction. Otherwise, this is informational."
        : undefined,
    };
  }),

  createRule("fueleu.reduction_percentage", "GHG reduction percentage trend is valid", "maritime", "info", ["fuel_eu"], (ctx) => {
    const reduction = num(ctx, "euRelativeGhgIntensity");
    if (reduction === undefined) return { passed: true, message: "Reduction percentage not provided", field: "euRelativeGhgIntensity" };
    const passed = reduction >= -100 && reduction <= 100;
    return {
      passed,
      message: passed
        ? `Relative GHG intensity ${reduction}% is within valid range`
        : `Relative GHG intensity ${reduction}% is outside expected range (-100% to +100%)`,
      field: "euRelativeGhgIntensity",
      remediation: !passed
        ? "GHG reduction percentage should be between -100% and +100%. Verify the extracted value."
        : undefined,
      ruleConfidence: 0.9,
    };
  }),
];

// ── Cross-Field Validation Rules ──────────────────────────────────────────────

const crossFieldRules: ValidationRule[] = [
  createRule("cross.fuel_consumed_vs_onboard", "Fuel consumed <= fuel onboard", "maritime", "error", [], (ctx) => {
    const consumed = num(ctx, "fuelConsumptionTonnes");
    const robs = num(ctx, "fuelRobsTonnes");
    if (consumed === undefined || robs === undefined) {
      return { passed: true, message: "Insufficient data to compare fuel consumption vs remaining", field: "fuelConsumptionTonnes" };
    }
    const total = consumed + robs;
    const passed = consumed <= total && consumed >= 0;
    return {
      passed,
      message: passed
        ? `Fuel consumed (${consumed}t) ≤ fuel remaining (${total}t)`
        : `Fuel consumed (${consumed}t) exceeds fuel remaining (${total}t) — possible data error`,
      field: "fuelConsumptionTonnes",
      remediation: !passed
        ? "Fuel consumption exceeds the total of consumed + remaining fuel. Verify fuel consumption and ROB values."
        : undefined,
    };
  }),

  createRule("cross.arrival_after_departure", "Arrival date > departure date", "maritime", "error", [], (ctx) => {
    const dep = getDate(ctx, "departureDate");
    const arr = getDate(ctx, "arrivalDate");
    if (!dep || !arr) return { passed: true, message: "Departure/arrival dates not provided for cross-field check", field: "departureDate" };
    const passed = arr > dep;
    return {
      passed,
      message: passed ? "Arrival date is after departure date" : "Arrival date must be after departure date",
      field: "arrivalDate",
      remediation: !passed ? "Arrival date is before or equal to departure date. Verify both dates." : undefined,
    };
  }),

  createRule("cross.distance_vs_speed", "Distance is consistent with speed and time", "maritime", "warning", [], (ctx) => {
    const distance = num(ctx, "distanceToGoNm");
    const speed = num(ctx, "speedKnots");
    if (distance === undefined || speed === undefined || speed <= 0) {
      return { passed: true, message: "Insufficient data for distance vs speed check", field: "distanceToGoNm" };
    }
    const estimatedHours = distance / speed;
    const passed = estimatedHours <= 720;
    return {
      passed,
      message: passed
        ? `Distance ${distance}nm at ${speed}kts gives ~${estimatedHours.toFixed(1)}h voyage — plausible`
        : `Distance ${distance}nm at ${speed}kts gives ~${estimatedHours.toFixed(1)}h — seems excessive`,
      field: "distanceToGoNm",
      remediation: !passed
        ? "Distance at current speed would take more than 30 days. Verify distance or speed values."
        : undefined,
    };
  }),

  createRule("cross.engine_hours_vs_voyage", "Engine hours consistent with voyage duration", "maritime", "warning", [], (ctx) => {
    const engineHrs = num(ctx, "engineHours");
    const distance = num(ctx, "distanceToGoNm");
    const speed = num(ctx, "speedKnots");
    if (engineHrs === undefined || distance === undefined || speed === undefined || speed <= 0) {
      return { passed: true, message: "Insufficient data for engine hours vs voyage check", field: "engineHours" };
    }
    const voyageHrs = distance / speed;
    const ratio = voyageHrs > 0 ? engineHrs / voyageHrs : 0;
    const passed = ratio >= 0 && ratio <= 3;
    return {
      passed,
      message: passed
        ? `Engine hours ${engineHrs}h is consistent with voyage duration ${voyageHrs.toFixed(1)}h`
        : `Engine hours ${engineHrs}h seems inconsistent with voyage duration ${voyageHrs.toFixed(1)}h (ratio ${ratio.toFixed(2)})`,
      field: "engineHours",
      remediation: !passed
        ? "Engine hours are inconsistent with voyage duration. Verify engine hours and voyage distance/speed."
        : undefined,
    };
  }),

  createRule("cross.coordinates_legal_range", "Coordinates are within legal ranges", "maritime", "error", [], (ctx) => {
    const lat = num(ctx, "positionLatitude");
    const lng = num(ctx, "positionLongitude");
    if (lat === undefined || lng === undefined) {
      return { passed: true, message: "Coordinates not provided for range check", field: "positionLatitude" };
    }
    const latOk = lat >= -90 && lat <= 90;
    const lngOk = lng >= -180 && lng <= 180;
    return {
      passed: latOk && lngOk,
      message: latOk && lngOk
        ? `Coordinates (${lat}, ${lng}) are within legal ranges`
        : `Coordinates (${lat}, ${lng}) are outside legal ranges (lat: ±90, lng: ±180)`,
      field: "positionLatitude",
      remediation: !(latOk && lngOk) ? "Latitude must be between -90 and 90, longitude between -180 and 180. Verify coordinates." : undefined,
    };
  }),

  createRule("cross.report_date_not_future", "Report/delivery date is not far in the future", "maritime", "warning", [], (ctx) => {
    const dateField = str(ctx, "deliveryDate") || str(ctx, "reportDate") || str(ctx, "entryDate") || str(ctx, "reportingPeriod");
    if (!dateField) return { passed: true, message: "No date field available for plausibility check" };
    if (!ISO_DATE_REGEX.test(dateField)) return { passed: true, message: "Date format not recognized for plausibility check" };
    const date = new Date(dateField);
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const passed = date <= oneYearFromNow && date >= oneYearAgo;
    return {
      passed,
      message: passed ? "Date is within a reasonable range" : "Date is more than 1 year from today — verify",
      field: "deliveryDate",
      remediation: !passed ? "The date is more than 1 year from the current date. Verify the document date." : undefined,
    };
  }),
];

// ── Rule Registry ─────────────────────────────────────────────────────────────

export function buildRuleRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.registerMany(structuralRules);
  registry.registerMany(maritimeRules);
  registry.registerMany(confidenceRules);
  registry.registerMany(imoDcsRules);
  registry.registerMany(euMrvRules);
  registry.registerMany(bdnRules);
  registry.registerMany(noonReportRules);
  registry.registerMany(logbookRules);
  registry.registerMany(crossFieldRules);
  registry.registerMany(fuelEuRules);
  return registry;
}

/** Pre-built singleton registry. */
export const RULE_REGISTRY = buildRuleRegistry();

// ── Legacy Support ────────────────────────────────────────────────────────────

/**
 * Run all validation rules against the input (legacy API).
 * Returns individual rule results (passed and failed).
 */
export function runAllRules(input: ValidationInput): ValidationRuleResult[] {
  const ctx: ValidationContext = {
    fields: input.extractionFields,
    documentType: input.documentType,
    ocrConfidence: input.ocrConfidence,
    extractionConfidence: input.extractionConfidence,
    extractionSummary: input.extractionSummary,
    extractionWarnings: input.extractionWarnings,
    extractionMissingFields: input.extractionMissingFields,
  };
  const rules = RULE_REGISTRY.getRulesForDocumentType(input.documentType);
  const results = rules.map((rule) => {
    const result = rule.validate(ctx);
    if (!result.passed && result.severity === null) {
      return { ...result, severity: "warning" as const };
    }
    return result;
  });
  return results;
}

/** All rules (legacy export). */
export const ALL_RULES = RULE_REGISTRY.getAllRules();
