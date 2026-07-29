/**
 * prompts.test.ts — unit tests for the AI extraction prompt registry
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the prompt system:
 *   1. getExtractionPrompt — returns BDN prompt for imo_dcs
 *   2. getExtractionPrompt — returns CII prompt for report
 *   3. getExtractionPrompt — returns EU-ETS prompt for eu_mrv
 *   4. getExtractionPrompt — returns unknown prompt for certificate/logbook/other
 *   5. getExtractionPrompt — every prompt has non-empty systemPrompt
 *   6. getExtractionPrompt — every prompt has description
 *   7. EXTRACTION_PROMPTS — exported prompts have expected keys
 *
 * Run via: npx tsx src/lib/ai/__tests__/prompts.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { getExtractionPrompt, EXTRACTION_PROMPTS } from "../prompts/index";
import type { DocumentType } from "@/lib/supabase/types";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getExtractionPrompt — document type mapping", () => {
  it("returns BDN prompt for imo_dcs", () => {
    const prompt = getExtractionPrompt("imo_dcs");
    expect(prompt.description).toContainString("Bunker Delivery Note");
    expect(prompt.expectedFields.length).toBeGreaterThan(0);
    expect(prompt.expectedFields).toContain("imoNumber");
    expect(prompt.expectedFields).toContain("fuelType");
    expect(prompt.expectedFields).toContain("quantityTonnes");
    expect(prompt.systemPrompt.length).toBeGreaterThan(100);
  });

  it("returns CII prompt for report", () => {
    const prompt = getExtractionPrompt("report");
    expect(prompt.description).toContainString("CII");
    expect(prompt.expectedFields).toContain("ciiRating");
    expect(prompt.expectedFields).toContain("operationalCii");
    expect(prompt.expectedFields).toContain("attainedEexi");
  });

  it("returns EU-ETS prompt for eu_mrv", () => {
    const prompt = getExtractionPrompt("eu_mrv");
    expect(prompt.description).toContainString("EU ETS");
    expect(prompt.expectedFields).toContain("totalCo2Tonnes");
    expect(prompt.expectedFields).toContain("allocatedAllowances");
    expect(prompt.expectedFields).toContain("monitoringMethodology");
  });

  it("returns noon_report prompt for noon_report", () => {
    const prompt = getExtractionPrompt("noon_report");
    expect(prompt.description).toContainString("Noon Report");
    expect(prompt.expectedFields).toContain("positionLatitude");
    expect(prompt.expectedFields).toContain("positionLongitude");
    expect(prompt.expectedFields).toContain("engineRpm");
  });

  it("returns unknown prompt for certificate", () => {
    const prompt = getExtractionPrompt("certificate");
    expect(prompt.description).toContainString("Unknown");
    expect(prompt.expectedFields.length).toBe(0);
  });

  it("returns unknown prompt for correspondence", () => {
    const prompt = getExtractionPrompt("correspondence");
    expect(prompt.description).toContainString("Unknown");
  });

  it("returns logbook prompt for logbook", () => {
    const prompt = getExtractionPrompt("logbook");
    expect(prompt.description).toContainString("Logbook");
    expect(prompt.expectedFields).toContain("entryDate");
    expect(prompt.expectedFields).toContain("entryType");
    expect(prompt.expectedFields).toContain("incidents");
  });

  it("returns unknown prompt for other", () => {
    const prompt = getExtractionPrompt("other");
    expect(prompt.description).toContainString("Unknown");
  });
});

describe("getExtractionPrompt — prompt quality", () => {
  const allTypes: DocumentType[] = [
    "imo_dcs", "eu_mrv", "certificate", "report",
    "correspondence", "logbook", "other",
  ];

  it("every prompt has a non-empty systemPrompt", () => {
    for (const docType of allTypes) {
      const prompt = getExtractionPrompt(docType);
      expect(prompt.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  it("every prompt has a non-empty description", () => {
    for (const docType of allTypes) {
      const prompt = getExtractionPrompt(docType);
      expect(prompt.description.length).toBeGreaterThan(0);
    }
  });

  it("all known type prompts have expected fields", () => {
    const bdn = getExtractionPrompt("imo_dcs");
    expect(bdn.expectedFields).toContain("imoNumber");
    expect(bdn.expectedFields).toContain("vesselName");

    const cii = getExtractionPrompt("report");
    expect(cii.expectedFields).toContain("ciiRating");

    const euEts = getExtractionPrompt("eu_mrv");
    expect(euEts.expectedFields).toContain("totalCo2Tonnes");

    const noonReport = getExtractionPrompt("noon_report");
    expect(noonReport.expectedFields).toContain("positionLatitude");
    expect(noonReport.expectedFields).toContain("positionLongitude");

    const logbookP = getExtractionPrompt("logbook");
    expect(logbookP.expectedFields).toContain("entryDate");
    expect(logbookP.expectedFields).toContain("entryType");
  });
});

describe("EXTRACTION_PROMPTS — exported prompts", () => {
  it("has all expected keys", () => {
    expect(EXTRACTION_PROMPTS.bdn).toBeTruthy();
    expect(EXTRACTION_PROMPTS.cii).toBeTruthy();
    expect(EXTRACTION_PROMPTS.fuelEu).toBeTruthy();
    expect(EXTRACTION_PROMPTS.euEts).toBeTruthy();
    expect(EXTRACTION_PROMPTS.noonReport).toBeTruthy();
    expect(EXTRACTION_PROMPTS.logbook).toBeTruthy();
    expect(EXTRACTION_PROMPTS.unknown).toBeTruthy();
  });

  it("BDN prompt matches getExtractionPrompt for imo_dcs", () => {
    const fromRegistry = getExtractionPrompt("imo_dcs");
    expect(EXTRACTION_PROMPTS.bdn.systemPrompt).toBe(fromRegistry.systemPrompt);
  });

  it("CII prompt matches getExtractionPrompt for report", () => {
    const fromRegistry = getExtractionPrompt("report");
    expect(EXTRACTION_PROMPTS.cii.systemPrompt).toBe(fromRegistry.systemPrompt);
  });

  it("EU-ETS prompt matches getExtractionPrompt for eu_mrv", () => {
    const fromRegistry = getExtractionPrompt("eu_mrv");
    expect(EXTRACTION_PROMPTS.euEts.systemPrompt).toBe(fromRegistry.systemPrompt);
  });
});

run();
