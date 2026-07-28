/**
 * mock-provider.ts — deterministic mock AI provider for tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The extraction pipeline needs an AI provider that works without GPT-4o.
 * This mock returns fixture data based on the document type, matching the
 * OCR mock's fixture data but at the AI understanding level.
 *
 * HOW IT FITS
 * When AI_USE_MOCK=true (default), the provider factory creates this mock.
 * Each document type maps to a deterministic fixture with realistic fields,
 * warnings, and confidence scores.
 */

import type { DocumentType } from "@/lib/supabase/types";
import type {
  AiExtractionInput,
  AiExtractionResult,
  AiProvider,
} from "./types";

// ── Fixture data ─────────────────────────────────────────────────────────────

const BDN_EXTRACTION: AiExtractionResult = {
  confidence: 0.96,
  summary:
    "Bunker Delivery Note for MV Poseidon Explorer (IMO 9876543). " +
    "1,200.5 tonnes of VLSFO delivered at Rotterdam on 2026-06-15 " +
    "by Global Marine Fuels B.V. Sulphur content 0.48% m/m, within " +
    "IMO 2020 limits. BDN reference: BDN-2026-001234.",
  documentType: "imo_dcs",
  fields: {
    imoNumber: "9876543",
    vesselName: "MV Poseidon Explorer",
    port: "Rotterdam",
    deliveryDate: "2026-06-15",
    fuelType: "VLSFO",
    quantityTonnes: 1200.5,
    sulphurContentPct: 0.48,
    densityKgM3: 985.0,
    supplier: "Global Marine Fuels B.V.",
    bdnReference: "BDN-2026-001234",
  },
  warnings: [],
  missingFields: [],
  usage: { promptTokens: 850, completionTokens: 420, totalTokens: 1270 },
};

const CII_EXTRACTION: AiExtractionResult = {
  confidence: 0.93,
  summary:
    "CII Rating Report for MV Poseidon Explorer (IMO 9876543). " +
    "Rated B for 2025 with operational CII of 3.12 gCO₂/tonne-mile, " +
    "below the required threshold of 3.50. EEXI attained: 4.28.",
  documentType: "report",
  fields: {
    imoNumber: "9876543",
    vesselName: "MV Poseidon Explorer",
    shipType: "Bulk Carrier",
    ratingYear: 2025,
    ciiRating: "B",
    operationalCii: 3.12,
    requiredCii: 3.5,
    attainedEexi: 4.28,
    fleetAverageCii: 3.45,
  },
  warnings: [],
  missingFields: [],
  usage: { promptTokens: 780, completionTokens: 380, totalTokens: 1160 },
};

const EU_ETS_EXTRACTION: AiExtractionResult = {
  confidence: 0.91,
  summary:
    "EU ETS maritime emissions report for MV Poseidon Explorer (IMO 9876543). " +
    "Total CO₂: 8,450 tonnes. EU voyage emissions: 3,200 tonnes. " +
    "EU port emissions: 420 tonnes. Allocated allowances: 3,620 EUAs. " +
    "Monitoring methodology: DTZ.",
  documentType: "eu_mrv",
  fields: {
    imoNumber: "9876543",
    vesselName: "MV Poseidon Explorer",
    reportingPeriod: "2025",
    totalCo2Tonnes: 8450.0,
    euVoyageEmissionsTonnes: 3200.0,
    euPortEmissionsTonnes: 420.0,
    allocatedAllowances: 3620,
    monitoringMethodology: "DTZ (Distance-Time-Zone)",
  },
  warnings: [],
  missingFields: [],
  usage: { promptTokens: 820, completionTokens: 400, totalTokens: 1220 },
};

const FUEL_EU_EXTRACTION: AiExtractionResult = {
  confidence: 0.94,
  summary:
    "FuelEU Maritime compliance report for MV Poseidon Explorer (IMO 9876543). " +
    "COMPLIANT. Well-to-wake GHG intensity: 89.2 gCO₂eq/MJ. " +
    "Total energy: 24,500 MWh. Fuel mix: 65% VLSFO, 25% MGO, 10% LNG.",
  documentType: "eu_mrv",
  fields: {
    imoNumber: "9876543",
    vesselName: "MV Poseidon Explorer",
    reportingPeriod: "2025",
    totalEnergyMwh: 24500.0,
    ghgIntensityWtw: 89.2,
    ghgIntensityTtw: 82.1,
    euRelativeGhgIntensity: 91.5,
    isCompliant: true,
    penaltyEur: null,
    fuelBreakdown: [
      { fuelType: "VLSFO", sharePct: 65.0, ghgIntensity: 91.2 },
      { fuelType: "MGO", sharePct: 25.0, ghgIntensity: 89.0 },
      { fuelType: "LNG", sharePct: 10.0, ghgIntensity: 67.0 },
    ],
  },
  warnings: [],
  missingFields: [],
  usage: { promptTokens: 900, completionTokens: 450, totalTokens: 1350 },
};

const UNKNOWN_EXTRACTION: AiExtractionResult = {
  confidence: 0.45,
  summary:
    "Unrecognized document type. The document appears to contain " +
    "maritime-related text but cannot be classified into a known " +
    "compliance category.",
  documentType: "other",
  fields: {
    summary: "Unrecognized maritime document",
    isRelevant: true,
  },
  warnings: [
    "Document type could not be determined automatically",
    "Manual classification recommended",
  ],
  missingFields: [],
  usage: { promptTokens: 600, completionTokens: 200, totalTokens: 800 },
};

const FIXTURE_MAP: Record<DocumentType, AiExtractionResult> = {
  imo_dcs: BDN_EXTRACTION,
  eu_mrv: EU_ETS_EXTRACTION,
  certificate: UNKNOWN_EXTRACTION,
  report: CII_EXTRACTION,
  correspondence: UNKNOWN_EXTRACTION,
  logbook: UNKNOWN_EXTRACTION,
  other: UNKNOWN_EXTRACTION,
};

// ── Provider implementation ──────────────────────────────────────────────────

/**
 * Creates a deterministic mock AI provider.
 * Returns fixture data based on document type. The rawText is not inspected —
 * this is a test double, not a real LLM.
 */
export function createMockAiProvider(): AiProvider {
  return {
    async extract(input: AiExtractionInput): Promise<AiExtractionResult> {
      const fixture = FIXTURE_MAP[input.documentType] ?? UNKNOWN_EXTRACTION;
      if (!fixture) {
        throw new Error(`No AI fixture for document type: ${input.documentType}`);
      }
      return { ...fixture, documentType: input.documentType };
    },
  };
}

/** Export fixtures for tests. */
export const MOCK_AI_FIXTURES = {
  bdn: BDN_EXTRACTION,
  cii: CII_EXTRACTION,
  euEts: EU_ETS_EXTRACTION,
  fuelEu: FUEL_EU_EXTRACTION,
  unknown: UNKNOWN_EXTRACTION,
} as const;
