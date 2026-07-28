/**
 * mock-provider.test.ts — unit tests for the Mock AI Provider
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the mock AI provider:
 *   1. extract — returns BDN fixture data for imo_dcs
 *   2. extract — returns CII fixture data for report
 *   3. extract — returns EU-ETS fixture data for eu_mrv
 *   4. extract — returns FuelEU fixture data (eu_mrv with fuelEU keywords)
 *   5. extract — returns unknown fixture for unclassified types
 *   6. extract — always returns non-null confidence
 *   7. extract — always returns non-null usage stats
 *   8. extract — returns warnings for unknown types
 *
 * Run via: npx tsx src/lib/ai/__tests__/mock-provider.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockAiProvider, MOCK_AI_FIXTURES } from "../mock-provider";
import type { AiExtractionInput } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<AiExtractionInput> & { documentType: AiExtractionInput["documentType"] },
): AiExtractionInput {
  return {
    rawText: "Sample maritime document text",
    ocrConfidence: 0.92,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MockAiProvider — extract", () => {
  it("returns BDN fixture data for imo_dcs documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "imo_dcs" }));

    expect(result.confidence).toBe(0.96);
    expect(result.documentType).toBe("imo_dcs");
    expect(typeof result.fields["imoNumber"]).toBe("string");
    expect(typeof result.fields["vesselName"]).toBe("string");
    expect(typeof result.fields["fuelType"]).toBe("string");
    expect(typeof result.fields["quantityTonnes"]).toBe("number");
    expect(typeof result.fields["sulphurContentPct"]).toBe("number");
    expect(result.warnings.length).toBe(0);
    expect(result.missingFields.length).toBe(0);
  });

  it("returns CII fixture data for report documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "report" }));

    expect(result.confidence).toBe(0.93);
    expect(result.documentType).toBe("report");
    expect(typeof result.fields["ciiRating"]).toBe("string");
    expect(typeof result.fields["operationalCii"]).toBe("number");
    expect(typeof result.fields["requiredCii"]).toBe("number");
    expect(typeof result.fields["attainedEexi"]).toBe("number");
  });

  it("returns EU-ETS fixture data for eu_mrv documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "eu_mrv" }));

    expect(result.confidence).toBe(0.91);
    expect(result.documentType).toBe("eu_mrv");
    expect(typeof result.fields["totalCo2Tonnes"]).toBe("number");
    expect(typeof result.fields["allocatedAllowances"]).toBe("number");
    expect(typeof result.fields["euVoyageEmissionsTonnes"]).toBe("number");
  });

  it("returns unknown fixture for certificate documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "certificate" }));

    expect(result.confidence).toBe(0.45);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns unknown fixture for correspondence documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "correspondence" }));

    expect(result.confidence).toBe(0.45);
    expect(typeof result.fields["summary"]).toBe("string");
  });

  it("returns unknown fixture for logbook documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "logbook" }));

    expect(result.confidence).toBe(0.45);
  });

  it("returns unknown fixture for other documents", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "other" }));

    expect(result.confidence).toBe(0.45);
  });

  it("always returns non-null confidence for all document types", async () => {
    const provider = createMockAiProvider();
    const types: AiExtractionInput["documentType"][] = [
      "imo_dcs", "eu_mrv", "certificate", "report",
      "correspondence", "logbook", "other",
    ];

    for (const docType of types) {
      const result = await provider.extract(makeInput({ documentType: docType }));
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("always returns usage statistics", async () => {
    const provider = createMockAiProvider();
    const types: AiExtractionInput["documentType"][] = [
      "imo_dcs", "eu_mrv", "certificate", "report",
      "correspondence", "logbook", "other",
    ];

    for (const docType of types) {
      const result = await provider.extract(makeInput({ documentType: docType }));
      expect(result.usage).toBeTruthy();
      expect(result.usage!.promptTokens).toBeGreaterThan(0);
      expect(result.usage!.completionTokens).toBeGreaterThan(0);
      expect(result.usage!.totalTokens).toBeGreaterThan(0);
    }
  });

  it("returns warnings for unknown document types", async () => {
    const provider = createMockAiProvider();
    const result = await provider.extract(makeInput({ documentType: "other" }));

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("could not be determined"))).toBe(true);
  });
});

describe("MOCK_AI_FIXTURES — exported fixtures", () => {
  it("has all expected fixture keys", () => {
    expect(MOCK_AI_FIXTURES.bdn).toBeTruthy();
    expect(MOCK_AI_FIXTURES.cii).toBeTruthy();
    expect(MOCK_AI_FIXTURES.euEts).toBeTruthy();
    expect(MOCK_AI_FIXTURES.fuelEu).toBeTruthy();
    expect(MOCK_AI_FIXTURES.unknown).toBeTruthy();
  });

  it("BDN fixture has correct confidence", () => {
    expect(MOCK_AI_FIXTURES.bdn.confidence).toBe(0.96);
  });

  it("CII fixture has correct confidence", () => {
    expect(MOCK_AI_FIXTURES.cii.confidence).toBe(0.93);
  });

  it("EU-ETS fixture has correct confidence", () => {
    expect(MOCK_AI_FIXTURES.euEts.confidence).toBe(0.91);
  });

  it("FuelEU fixture has correct confidence", () => {
    expect(MOCK_AI_FIXTURES.fuelEu.confidence).toBe(0.94);
  });

  it("unknown fixture has correct confidence", () => {
    expect(MOCK_AI_FIXTURES.unknown.confidence).toBe(0.45);
  });
});

run();
