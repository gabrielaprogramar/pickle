/**
 * prompts/index.ts — prompt registry for AI extraction per document type
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Each document type has a specialized extraction prompt that tells GPT-4o
 * exactly what fields to extract and in what JSON format. The registry maps
 * document types to their prompts, with a fallback for unknown types.
 *
 * HOW IT FITS
 * The AI provider calls getPrompt(documentType) to obtain the system prompt
 * + expected fields before invoking the LLM.
 */

import type { DocumentType } from "@/lib/supabase/types";

export interface ExtractionPrompt {
  /** The system prompt sent to the LLM. */
  readonly systemPrompt: string;
  /** Expected field names for validation. */
  readonly expectedFields: string[];
  /** Short description of what this prompt extracts. */
  readonly description: string;
}

const BDN_PROMPT: ExtractionPrompt = {
  description: "Bunker Delivery Note (BDN) — fuel delivery records",
  expectedFields: [
    "imoNumber", "vesselName", "port", "deliveryDate",
    "fuelType", "quantityTonnes", "sulphurContentPct",
    "densityKgM3", "supplier", "bdnReference",
  ],
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a Bunker Delivery Note (BDN).

Return ONLY valid JSON with these fields:
{
  "imoNumber": "string — vessel IMO number (7 digits)",
  "vesselName": "string — vessel name",
  "port": "string — port of delivery",
  "deliveryDate": "string — delivery date in ISO-8601 format",
  "fuelType": "string — fuel type (VLSFO, MGO, LNG, etc.)",
  "quantityTonnes": "number — quantity delivered in metric tonnes",
  "sulphurContentPct": "number or null — sulphur content as percentage",
  "densityKgM3": "number or null — density at 15°C in kg/m³",
  "supplier": "string — fuel supplier name",
  "bdnReference": "string — BDN reference number"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- Use null for fields not found in the document.
- Parse numbers as numeric values, not strings.
- Dates must be ISO-8601 format (YYYY-MM-DD).`,
};

const CII_PROMPT: ExtractionPrompt = {
  description: "CII (Carbon Intensity Indicator) Rating Report",
  expectedFields: [
    "imoNumber", "vesselName", "shipType", "ratingYear",
    "ciiRating", "operationalCii", "requiredCii",
    "attainedEexi", "fleetAverageCii",
  ],
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a CII (Carbon Intensity Indicator) Rating Report.

Return ONLY valid JSON with these fields:
{
  "imoNumber": "string — vessel IMO number (7 digits)",
  "vesselName": "string — vessel name",
  "shipType": "string — ship type (e.g., Bulk Carrier, Tanker)",
  "ratingYear": "number — the rating year",
  "ciiRating": "string — CII rating letter (A, B, C, D, or E)",
  "operationalCii": "number — attained operational CII in gCO₂/tonne-mile",
  "requiredCii": "number — required CII threshold in gCO₂/tonne-mile",
  "attainedEexi": "number or null — attained EEXI value",
  "fleetAverageCii": "number or null — fleet average CII"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- Use null for fields not found in the document.
- Parse numbers as numeric values, not strings.
- Rating must be a single uppercase letter A–E.`,
};

const FUEL_EU_PROMPT: ExtractionPrompt = {
  description: "FuelEU Maritime — GHG intensity compliance report",
  expectedFields: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalEnergyMwh", "ghgIntensityWtw", "ghgIntensityTtw",
    "euRelativeGhgIntensity", "isCompliant", "penaltyEur",
    "fuelBreakdown",
  ],
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from a FuelEU Maritime compliance report.

Return ONLY valid JSON with these fields:
{
  "imoNumber": "string — vessel IMO number (7 digits)",
  "vesselName": "string — vessel name",
  "reportingPeriod": "string — reporting period (e.g., '2025')",
  "totalEnergyMwh": "number — total energy used on board in MWh",
  "ghgIntensityWtw": "number — well-to-wake GHG intensity in gCO₂eq/MJ",
  "ghgIntensityTtw": "number — tank-to-wake GHG intensity in gCO₂eq/MJ",
  "euRelativeGhgIntensity": "number — EU-relative GHG intensity",
  "isCompliant": "boolean — whether the vessel is compliant",
  "penaltyEur": "number or null — penalty amount in EUR if non-compliant",
  "fuelBreakdown": "array of { fuelType: string, sharePct: number, ghgIntensity: number }"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- Use null for fields not found in the document.
- Parse numbers as numeric values, not strings.
- fuelBreakdown should list each fuel with its percentage share and GHG intensity.`,
};

const EU_ETS_PROMPT: ExtractionPrompt = {
  description: "EU ETS (Emissions Trading System) — maritime emissions report",
  expectedFields: [
    "imoNumber", "vesselName", "reportingPeriod",
    "totalCo2Tonnes", "euVoyageEmissionsTonnes",
    "euPortEmissionsTonnes", "allocatedAllowances",
    "monitoringMethodology",
  ],
  systemPrompt: `You are a maritime compliance document analyzer. Extract structured data from an EU ETS (Emissions Trading System) maritime emissions report.

Return ONLY valid JSON with these fields:
{
  "imoNumber": "string — vessel IMO number (7 digits)",
  "vesselName": "string — vessel name",
  "reportingPeriod": "string — reporting period (e.g., '2025')",
  "totalCo2Tonnes": "number — total CO₂ emissions in tonnes",
  "euVoyageEmissionsTonnes": "number — emissions from EU voyages in tonnes",
  "euPortEmissionsTonnes": "number — emissions from EU port calls in tonnes",
  "allocatedAllowances": "number — allocated allowances (EUAs)",
  "monitoringMethodology": "string — monitoring methodology used (e.g., DTZ)"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- Use null for fields not found in the document.
- Parse numbers as numeric values, not strings.`,
};

const UNKNOWN_PROMPT: ExtractionPrompt = {
  description: "Unknown document type — generic extraction",
  expectedFields: [],
  systemPrompt: `You are a maritime compliance document analyzer. The document type is not recognized.

Return ONLY valid JSON with these fields:
{
  "summary": "string — brief summary of what this document contains",
  "isRelevant": "boolean — whether this appears to be a maritime compliance document"
}

Rules:
- Return ONLY the JSON object, no markdown fences, no explanation.
- If you can identify any vessel names, IMO numbers, dates, or other maritime data, include them in a "detectedFields" object.`,
};

const PROMPT_MAP: Record<string, ExtractionPrompt> = {
  imo_dcs: BDN_PROMPT,
  eu_mrv: EU_ETS_PROMPT,
  certificate: UNKNOWN_PROMPT,
  report: CII_PROMPT,
  correspondence: UNKNOWN_PROMPT,
  logbook: UNKNOWN_PROMPT,
  other: UNKNOWN_PROMPT,
};

/**
 * Get the extraction prompt for a document type.
 * Returns the appropriate prompt or the unknown fallback.
 */
export function getExtractionPrompt(documentType: DocumentType): ExtractionPrompt {
  return PROMPT_MAP[documentType] ?? UNKNOWN_PROMPT;
}

/** Export individual prompts for testing. */
export const EXTRACTION_PROMPTS = {
  bdn: BDN_PROMPT,
  cii: CII_PROMPT,
  fuelEu: FUEL_EU_PROMPT,
  euEts: EU_ETS_PROMPT,
  unknown: UNKNOWN_PROMPT,
} as const;
