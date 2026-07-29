import type { DocumentType } from "@/lib/supabase/types";

export interface ExtractionPrompt {
  readonly systemPrompt: string;
  readonly expectedFields: string[];
  readonly description: string;
  readonly jsonSchema: Record<string, unknown>;
}

const BDN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    port: { type: "string" },
    deliveryDate: { type: "string" },
    fuelType: { type: "string" },
    quantityTonnes: { type: "number" },
    sulphurContentPct: { type: ["number", "null"] },
    densityKgM3: { type: ["number", "null"] },
    supplier: { type: "string" },
    bdnReference: { type: "string" },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "port", "deliveryDate",
    "fuelType", "quantityTonnes", "sulphurContentPct",
    "densityKgM3", "supplier", "bdnReference", "summary", "warnings",
  ],
  additionalProperties: false,
};

const CII_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    shipType: { type: "string" },
    ratingYear: { type: "number" },
    ciiRating: { type: "string" },
    operationalCii: { type: "number" },
    requiredCii: { type: "number" },
    attainedEexi: { type: ["number", "null"] },
    fleetAverageCii: { type: ["number", "null"] },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "shipType", "ratingYear",
    "ciiRating", "operationalCii", "requiredCii",
    "attainedEexi", "fleetAverageCii", "summary", "warnings",
  ],
  additionalProperties: false,
};

const FUEL_EU_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    reportingPeriod: { type: "string" },
    totalEnergyMwh: { type: "number" },
    ghgIntensityWtw: { type: "number" },
    ghgIntensityTtw: { type: "number" },
    euRelativeGhgIntensity: { type: "number" },
    isCompliant: { type: "boolean" },
    penaltyEur: { type: ["number", "null"] },
    fuelBreakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fuelType: { type: "string" },
          sharePct: { type: "number" },
          ghgIntensity: { type: "number" },
        },
        required: ["fuelType", "sharePct", "ghgIntensity"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalEnergyMwh", "ghgIntensityWtw", "ghgIntensityTtw",
    "euRelativeGhgIntensity", "isCompliant", "penaltyEur",
    "fuelBreakdown", "summary", "warnings",
  ],
  additionalProperties: false,
};

const EU_ETS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    reportingPeriod: { type: "string" },
    totalCo2Tonnes: { type: "number" },
    euVoyageEmissionsTonnes: { type: "number" },
    euPortEmissionsTonnes: { type: "number" },
    allocatedAllowances: { type: "number" },
    monitoringMethodology: { type: "string" },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalCo2Tonnes", "euVoyageEmissionsTonnes",
    "euPortEmissionsTonnes", "allocatedAllowances",
    "monitoringMethodology", "summary", "warnings",
  ],
  additionalProperties: false,
};

const NOON_REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    reportDate: { type: "string" },
    positionLatitude: { type: ["number", "null"] },
    positionLongitude: { type: ["number", "null"] },
    speedKnots: { type: ["number", "null"] },
    courseDegrees: { type: ["number", "null"] },
    distanceToGoNm: { type: ["number", "null"] },
    fuelConsumptionTonnes: { type: ["number", "null"] },
    fuelRobsTonnes: { type: ["number", "null"] },
    engineRpm: { type: ["number", "null"] },
    seaState: { type: ["string", "null"] },
    windSpeedKnots: { type: ["number", "null"] },
    windDirection: { type: ["string", "null"] },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "reportDate",
    "positionLatitude", "positionLongitude",
    "speedKnots", "courseDegrees", "distanceToGoNm",
    "fuelConsumptionTonnes", "fuelRobsTonnes",
    "engineRpm", "seaState", "windSpeedKnots", "windDirection",
    "summary", "warnings",
  ],
  additionalProperties: false,
};

const LOGBOOK_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    imoNumber: { type: "string" },
    vesselName: { type: "string" },
    entryDate: { type: "string" },
    entryType: { type: "string" },
    positionLatitude: { type: ["number", "null"] },
    positionLongitude: { type: ["number", "null"] },
    speedKnots: { type: ["number", "null"] },
    courseDegrees: { type: ["number", "null"] },
    engineHours: { type: ["number", "null"] },
    fuelConsumptionTonnes: { type: ["number", "null"] },
    cargoOperations: { type: ["string", "null"] },
    incidents: { type: "array", items: { type: "string" } },
    crewChanges: { type: ["string", "null"] },
    remarks: { type: ["string", "null"] },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imoNumber", "vesselName", "entryDate", "entryType",
    "positionLatitude", "positionLongitude",
    "speedKnots", "courseDegrees", "engineHours",
    "fuelConsumptionTonnes", "cargoOperations",
    "incidents", "crewChanges", "remarks",
    "summary", "warnings",
  ],
  additionalProperties: false,
};

const UNKNOWN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    isRelevant: { type: "boolean" },
    detectedFields: { type: "object", properties: {}, additionalProperties: true },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "isRelevant", "detectedFields", "warnings"],
  additionalProperties: false,
};

const BDN_PROMPT: ExtractionPrompt = {
  description: "Bunker Delivery Note (BDN) — fuel delivery records",
  expectedFields: [
    "imoNumber", "vesselName", "port", "deliveryDate",
    "fuelType", "quantityTonnes", "sulphurContentPct",
    "densityKgM3", "supplier", "bdnReference",
  ],
  jsonSchema: BDN_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a Bunker Delivery Note (BDN).

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings. Dates must be ISO-8601 format (YYYY-MM-DD).

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const CII_PROMPT: ExtractionPrompt = {
  description: "CII (Carbon Intensity Indicator) Rating Report",
  expectedFields: [
    "imoNumber", "vesselName", "shipType", "ratingYear",
    "ciiRating", "operationalCii", "requiredCii",
    "attainedEexi", "fleetAverageCii",
  ],
  jsonSchema: CII_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a CII (Carbon Intensity Indicator) Rating Report.

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings. Rating must be a single uppercase letter A–E.

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const FUEL_EU_PROMPT: ExtractionPrompt = {
  description: "FuelEU Maritime — GHG intensity compliance report",
  expectedFields: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalEnergyMwh", "ghgIntensityWtw", "ghgIntensityTtw",
    "euRelativeGhgIntensity", "isCompliant", "penaltyEur",
    "fuelBreakdown",
  ],
  jsonSchema: FUEL_EU_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a FuelEU Maritime compliance report.

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings. fuelBreakdown should list each fuel with its percentage share and GHG intensity.

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const EU_ETS_PROMPT: ExtractionPrompt = {
  description: "EU ETS (Emissions Trading System) — maritime emissions report",
  expectedFields: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalCo2Tonnes", "euVoyageEmissionsTonnes",
    "euPortEmissionsTonnes", "allocatedAllowances",
    "monitoringMethodology",
  ],
  jsonSchema: EU_ETS_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from an EU ETS (Emissions Trading System) maritime emissions report.

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings.

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const NOON_REPORT_PROMPT: ExtractionPrompt = {
  description: "Noon Report — daily vessel operational report",
  expectedFields: [
    "imoNumber", "vesselName", "reportDate",
    "positionLatitude", "positionLongitude",
    "speedKnots", "courseDegrees", "distanceToGoNm",
    "fuelConsumptionTonnes", "fuelRobsTonnes",
    "engineRpm", "seaState", "windSpeedKnots", "windDirection",
  ],
  jsonSchema: NOON_REPORT_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a vessel Noon Report (daily operational report).

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings. Dates must be ISO-8601 format (YYYY-MM-DD).

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const LOGBOOK_PROMPT: ExtractionPrompt = {
  description: "Logbook — vessel deck or engine logbook entry",
  expectedFields: [
    "imoNumber", "vesselName", "entryDate", "entryType",
    "positionLatitude", "positionLongitude",
    "speedKnots", "courseDegrees", "engineHours",
    "fuelConsumptionTonnes", "cargoOperations",
    "incidents", "crewChanges", "remarks",
  ],
  jsonSchema: LOGBOOK_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a vessel Logbook (deck or engine room logbook entry).

Return ONLY the fields specified in the JSON schema. Use null for fields not found in the document. Parse numbers as numeric values, not strings. Dates must be ISO-8601 format (YYYY-MM-DD).

entryType should describe the type of log entry (e.g., "deck", "engine", "navigation", "cargo").

Provide a brief "summary" of the document contents and include any data quality "warnings" as an array of strings.`,
};

const UNKNOWN_PROMPT: ExtractionPrompt = {
  description: "Unknown document type — generic extraction",
  expectedFields: [],
  jsonSchema: UNKNOWN_SCHEMA,
  systemPrompt: `You are a maritime compliance document analyzer. The document type is not recognized.

Return ONLY the fields specified in the JSON schema. Include a brief summary of what this document contains and set isRelevant to true if it appears to be a maritime compliance document. If you can identify any vessel names, IMO numbers, dates, or other maritime data, include them in the detectedFields object.

Provide any data quality "warnings" as an array of strings.`,
};

const PROMPT_MAP: Record<string, ExtractionPrompt> = {
  imo_dcs: BDN_PROMPT,
  report: CII_PROMPT,
  eu_mrv: EU_ETS_PROMPT,
  noon_report: NOON_REPORT_PROMPT,
  certificate: UNKNOWN_PROMPT,
  correspondence: UNKNOWN_PROMPT,
  logbook: LOGBOOK_PROMPT,
  other: UNKNOWN_PROMPT,
};

export function getExtractionPrompt(documentType: DocumentType): ExtractionPrompt {
  return PROMPT_MAP[documentType] ?? UNKNOWN_PROMPT;
}

export const EXTRACTION_PROMPTS = {
  bdn: BDN_PROMPT,
  cii: CII_PROMPT,
  fuelEu: FUEL_EU_PROMPT,
  euEts: EU_ETS_PROMPT,
  noonReport: NOON_REPORT_PROMPT,
  logbook: LOGBOOK_PROMPT,
  unknown: UNKNOWN_PROMPT,
} as const;
