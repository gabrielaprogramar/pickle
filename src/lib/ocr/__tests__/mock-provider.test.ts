/**
 * mock-provider.test.ts — unit tests for the Mock OCR Provider
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the mock OCR provider:
 *   1. extract — returns fixture data for imo_dcs (BDN)
 *   2. extract — returns fixture data for eu_mrv (EU-ETS)
 *   3. extract — returns fixture data for certificate
 *   4. extract — returns non-null confidence for all document types
 *
 * Run via: npx tsx src/lib/ocr/__tests__/mock-provider.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockOcrProvider } from "../mock-provider";
import type { DocumentType } from "@/lib/supabase/types";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MockOcrProvider — extract", () => {
  it("returns BDN fixture data for imo_dcs documents", async () => {
    const provider = createMockOcrProvider();
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "imo_dcs");

    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.confidence).toBe(0.95);
    expect(typeof result.extractedData["imoNumber"]).toBe("string");
    expect(typeof result.extractedData["vesselName"]).toBe("string");
    expect(typeof result.extractedData["fuelType"]).toBe("string");
  });

  it("returns EU-ETS fixture data for eu_mrv documents", async () => {
    const provider = createMockOcrProvider();
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "eu_mrv");

    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.confidence).toBe(0.92);
    expect(typeof result.extractedData["totalCo2Tonnes"]).toBe("number");
    expect(typeof result.extractedData["allocatedAllowances"]).toBe("number");
  });

  it("returns fixture data for certificate documents", async () => {
    const provider = createMockOcrProvider();
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "certificate");

    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.confidence).toBe(0.88);
  });

  it("returns fixture data for report documents", async () => {
    const provider = createMockOcrProvider();
    const result = await provider.extract(Buffer.from("test"), "application/pdf", "report");

    expect(result.rawText.length).toBeGreaterThan(0);
    expect(result.confidence).toBe(0.90);
    expect(typeof result.extractedData["ciiRating"]).toBe("string");
  });

  it("returns non-null confidence for all document types", async () => {
    const provider = createMockOcrProvider();
    const types: DocumentType[] = [
      "imo_dcs", "eu_mrv", "certificate", "report",
      "correspondence", "logbook", "other",
    ];

    for (const docType of types) {
      const result = await provider.extract(Buffer.from("test"), "application/pdf", docType);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.rawText.length).toBeGreaterThan(0);
    }
  });

  it("returns non-null extractedData for all document types", async () => {
    const provider = createMockOcrProvider();
    const types: DocumentType[] = [
      "imo_dcs", "eu_mrv", "certificate", "report",
      "correspondence", "logbook", "other",
    ];

    for (const docType of types) {
      const result = await provider.extract(Buffer.from("test"), "application/pdf", docType);
      expect(typeof result.extractedData).toBe("object");
    }
  });
});

run();
