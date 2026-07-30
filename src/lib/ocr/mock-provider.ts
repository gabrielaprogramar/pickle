/**
 * mock-provider.ts — deterministic mock OCR provider for tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The document processing pipeline needs an OCR provider that works without
 * external services. This mock returns fixture data based on the document
 * type, simulating realistic extraction results for maritime compliance
 * documents (BDN, CII, EU-ETS, FuelEU).
 *
 * HOW IT FITS
 * When OCR_USE_MOCK=true (default), the provider factory creates this mock.
 * Each document type maps to a deterministic fixture, making tests repeatable.
 */

import type { DocumentType } from "@/lib/supabase/types";
import type {
  BdnExtractedData,
  CiiExtractedData,
  EuEtsExtractedData,
  FuelEuExtractedData,
  OcrProvider,
  OcrResult,
} from "./types";

// ── Fixture data ─────────────────────────────────────────────────────────────

const BDN_FIXTURE: BdnExtractedData = {
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
};

const CII_FIXTURE: CiiExtractedData = {
  imoNumber: "9876543",
  vesselName: "MV Poseidon Explorer",
  shipType: "Bulk Carrier",
  ratingYear: 2025,
  ciiRating: "B",
  operationalCii: 3.12,
  requiredCii: 3.5,
  attainedEexi: 4.28,
  fleetAverageCii: 3.45,
};

const EU_ETS_FIXTURE: EuEtsExtractedData = {
  imoNumber: "9876543",
  vesselName: "MV Poseidon Explorer",
  reportingPeriod: "2025",
  totalCo2Tonnes: 8450.0,
  euVoyageEmissionsTonnes: 3200.0,
  euPortEmissionsTonnes: 420.0,
  allocatedAllowances: 3620,
  monitoringMethodology: "DTZ (Distance-Time-Zone)",
};

const FUEL_EU_FIXTURE: FuelEuExtractedData = {
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
};

const BDN_RAW_TEXT = `BUNKER DELIVERY NOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BDN Reference: BDN-2026-001234
Vessel: MV Poseidon Explorer (IMO 9876543)
Port of Delivery: Rotterdam
Date of Delivery: 15 June 2026

Fuel Type: Very Low Sulphur Fuel Oil (VLSFO)
Quantity Delivered: 1,200.5 metric tonnes
Sulphur Content: 0.48% m/m
Density at 15°C: 985.0 kg/m³

Supplier: Global Marine Fuels B.V.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const CII_RAW_TEXT = `CARBON INTENSITY INDICATOR (CII) RATING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vessel: MV Poseidon Explorer (IMO 9876543)
Ship Type: Bulk Carrier
Rating Year: 2025

CII Rating: B
Attained CII: 3.12 gCO₂/tonne-mile
Required CII: 3.50 gCO₂/tonne-mile
Attained EEXI: 4.28 gCO₂/tonne-mile
Fleet Average CII: 3.45 gCO₂/tonne-mile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const EU_ETS_RAW_TEXT = `EU EMISSIONS TRADING SYSTEM — MARITIME REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vessel: MV Poseidon Explorer (IMO 9876543)
Reporting Period: 2025

Total CO₂ Emissions: 8,450.0 t
EU Voyage Emissions: 3,200.0 t
EU Port Emissions: 420.0 t
Allocated Allowances (EUAs): 3,620
Monitoring Methodology: DTZ (Distance-Time-Zone)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const FUEL_EU_RAW_TEXT = `FUELEU MARITIME — COMPLIANCE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vessel: MV Poseidon Explorer (IMO 9876543)
Reporting Period: 2025

Total Energy on Board: 24,500.0 MWh
GHG Intensity (WTW): 89.2 gCO₂eq/MJ
GHG Intensity (TTW): 82.1 gCO₂eq/MJ
EU-Relative GHG Intensity: 91.5 gCO₂eq/MJ
Compliance Status: COMPLIANT

Fuel Breakdown:
  VLSFO — 65.0% — 91.2 gCO₂eq/MJ
  MGO   — 25.0% — 89.0 gCO₂eq/MJ
  LNG   — 10.0% — 67.0 gCO₂eq/MJ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ── Fixture map ──────────────────────────────────────────────────────────────

interface FixtureEntry {
  readonly rawText: string;
  readonly extractedData: Record<string, unknown>;
  readonly confidence: number;
}

const FIXTURES: Record<DocumentType, FixtureEntry> = {
  bdn: { rawText: BDN_RAW_TEXT, extractedData: BDN_FIXTURE as unknown as Record<string, unknown>, confidence: 0.95 },
  imo_dcs: { rawText: BDN_RAW_TEXT, extractedData: BDN_FIXTURE as unknown as Record<string, unknown>, confidence: 0.95 },
  eu_mrv: { rawText: EU_ETS_RAW_TEXT, extractedData: EU_ETS_FIXTURE as unknown as Record<string, unknown>, confidence: 0.92 },
  certificate: { rawText: "Certificate text placeholder", extractedData: {}, confidence: 0.88 },
  report: { rawText: "Report text placeholder", extractedData: CII_FIXTURE as unknown as Record<string, unknown>, confidence: 0.90 },
  correspondence: { rawText: "Correspondence text placeholder", extractedData: {}, confidence: 0.85 },
  logbook: { rawText: "Logbook text placeholder", extractedData: {}, confidence: 0.87 },
  other: { rawText: "Generic document text", extractedData: {}, confidence: 0.80 },
};

// ── Provider implementation ──────────────────────────────────────────────────

/**
 * Creates a deterministic mock OCR provider.
 * Returns fixture data based on document type. The file buffer is not
 * inspected — this is a test double, not a real OCR engine.
 */
export function createMockOcrProvider(): OcrProvider {
  return {
    async extract(
      _fileBuffer: Buffer,
      _mimeType: string,
      documentType: DocumentType,
    ): Promise<OcrResult> {
      const fixture = FIXTURES[documentType] ?? FIXTURES.other;
      if (!fixture) {
        throw new Error(`No fixture for document type: ${documentType}`);
      }
      return {
        rawText: fixture.rawText,
        extractedData: fixture.extractedData,
        confidence: fixture.confidence,
      };
    },
  };
}

// ── Exported fixtures (for tests) ────────────────────────────────────────────

export const MOCK_FIXTURES: Record<string, FixtureEntry> = {
  bdn: FIXTURES.imo_dcs,
  cii: FIXTURES.report,
  eu_ets: FIXTURES.eu_mrv,
  fuel_eu: FIXTURES.report,
};
