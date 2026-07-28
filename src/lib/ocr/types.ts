/**
 * types.ts — OCR provider types and document-specific extraction results
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Defines the OCR provider contract and the structured data shapes returned
 * after processing maritime compliance documents (BDN, CII, EU-ETS, FuelEU).
 * Each document type has its own extraction result type, keeping the mock
 * and real OCR providers type-safe.
 *
 * HOW IT FITS
 * The mock provider (mock-provider.ts) and any future real provider implement
 * OcrProvider. The document service calls provider.extract() and persists
 * the OcrResult + extracted entities.
 */

import type { DocumentType } from "@/lib/supabase/types";

// ── OCR Provider Contract ────────────────────────────────────────────────────

/** Raw OCR extraction output returned by the provider. */
export interface OcrResult {
  /** Full raw text extracted from the document (may be multi-page). */
  readonly rawText: string;
  /** Structured data extracted from the document, keyed by field name. */
  readonly extractedData: Record<string, unknown>;
  /** Overall confidence score between 0 and 1. */
  readonly confidence: number;
}

/** The OCR provider contract. Both mock and real implement this. */
export interface OcrProvider {
  /**
   * Extract text and structured data from a document file.
   * @param fileBuffer - The raw file bytes.
   * @param mimeType   - MIME type of the file (e.g. "application/pdf").
   * @param documentType - The classification of the document.
   * @returns The OCR extraction result.
   */
  extract(
    fileBuffer: Buffer,
    mimeType: string,
    documentType: DocumentType,
  ): Promise<OcrResult>;
}

// ── Document-Type-Specific Extraction Results ────────────────────────────────

/** Extracted fields from a Bunker Delivery Note (BDN). */
export interface BdnExtractedData {
  /** IMO number of the vessel. */
  readonly imoNumber: string;
  /** Vessel name. */
  readonly vesselName: string;
  /** Port where fuel was delivered. */
  readonly port: string;
  /** Delivery date (ISO-8601). */
  readonly deliveryDate: string;
  /** Fuel type (e.g. "VLSFO", "MGO", "LNG"). */
  readonly fuelType: string;
  /** Quantity delivered in metric tonnes. */
  readonly quantityTonnes: number;
  /** Sulphur content as percentage. */
  readonly sulphurContentPct: number | null;
  /** Density at 15°C in kg/m³. */
  readonly densityKgM3: number | null;
  /** Supplier name. */
  readonly supplier: string;
  /** BDN reference number. */
  readonly bdnReference: string;
}

/** Extracted fields from a CII (Carbon Intensity Indicator) rating. */
export interface CiiExtractedData {
  /** IMO number of the vessel. */
  readonly imoNumber: string;
  /** Vessel name. */
  readonly vesselName: string;
  /** Ship type code (e.g. "Tanker", "Bulk Carrier"). */
  readonly shipType: string;
  /** Rating year. */
  readonly ratingYear: number;
  /** CII rating letter (A–E). */
  readonly ciiRating: string;
  /** Annual operational carbon intensity. */
  readonly operationalCii: number;
  /** Required CII threshold. */
  readonly requiredCii: number;
  /** Attained EEXI value. */
  readonly attainedEexi: number | null;
  /** Fleet average CII. */
  readonly fleetAverageCii: number | null;
}

/** Extracted fields from an EU-ETS (Emissions Trading System) report. */
export interface EuEtsExtractedData {
  /** IMO number of the vessel. */
  readonly imoNumber: string;
  /** Vessel name. */
  readonly vesselName: string;
  /** Reporting period (e.g. "2025"). */
  readonly reportingPeriod: string;
  /** Total CO₂ emissions in tonnes. */
  readonly totalCo2Tonnes: number;
  /** Emissions from EU voyages in tonnes. */
  readonly euVoyageEmissionsTonnes: number;
  /** Emissions from EU port calls in tonnes. */
  readonly euPortEmissionsTonnes: number;
  /** Allocated allowances (EUAs). */
  readonly allocatedAllowances: number;
  /** Monitoring methodology used. */
  readonly monitoringMethodology: string;
}

/** Extracted fields from a FuelEU Maritime report. */
export interface FuelEuExtractedData {
  /** IMO number of the vessel. */
  readonly imoNumber: string;
  /** Vessel name. */
  readonly vesselName: string;
  /** Reporting period (e.g. "2025"). */
  readonly reportingPeriod: string;
  /** Total energy used on board in MWh. */
  readonly totalEnergyMwh: number;
  /** Well-to-wake GHG intensity in gCO₂eq/MJ. */
  readonly ghgIntensityWtw: number;
  /** Tank-to-wake GHG intensity in gCO₂eq/MJ. */
  readonly ghgIntensityTtw: number;
  /** EU-relative GHG intensity. */
  readonly euRelativeGhgIntensity: number;
  /** Whether the vessel is compliant. */
  readonly isCompliant: boolean;
  /** Penalty amount if non-compliant, in EUR. */
  readonly penaltyEur: number | null;
  /** List of fuels used with their shares. */
  readonly fuelBreakdown: ReadonlyArray<{
    readonly fuelType: string;
    readonly sharePct: number;
    readonly ghgIntensity: number;
  }>;
}
