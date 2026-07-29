import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  getValidationProvider,
  createValidationProvider,
  _resetValidationProviderForTest,
} from "../provider";
import type { ValidationInput } from "../types";

const SAMPLE_INPUT: ValidationInput = {
  extractionConfidence: 0.95,
  extractionFields: { imoNumber: "9876543", vesselName: "Test" },
  extractionSummary: "Test summary",
  extractionWarnings: [],
  extractionMissingFields: [],
  documentType: "imo_dcs",
  ocrConfidence: 0.92,
};

describe("ValidationProvider — getValidationProvider", () => {
  it("returns a provider instance", () => {
    _resetValidationProviderForTest();
    const provider = getValidationProvider();
    expect(provider).toBeTruthy();
    expect(typeof provider.validate).toBe("function");
  });

  it("returns the same cached instance on repeated calls", () => {
    _resetValidationProviderForTest();
    const a = getValidationProvider();
    const b = getValidationProvider();
    expect(a).toBe(b);
  });

  it("produces a deterministic validation report", async () => {
    _resetValidationProviderForTest();
    const provider = getValidationProvider();
    const report = await provider.validate(SAMPLE_INPUT);
    expect(report).toBeTruthy();
    expect(report.score).toBeGreaterThan(-1);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.ruleResults)).toBe(true);
    expect(typeof report.readyForReview).toBe("boolean");
  });
});

describe("ValidationProvider — createValidationProvider", () => {
  it("returns a fresh mock provider instance", () => {
    const provider = createValidationProvider();
    expect(provider).toBeTruthy();
    expect(typeof provider.validate).toBe("function");
  });

  it("returns deterministic fixture data for BDN documents", async () => {
    const provider = createValidationProvider();
    const report = await provider.validate({
      ...SAMPLE_INPUT,
      documentType: "imo_dcs",
    });
    expect(report.score).toBe(100);
    expect(report.status).toBe("passed");
    expect(report.passedCount).toBe(23);
  });

  it("returns warning data for unknown document types", async () => {
    const provider = createValidationProvider();
    const report = await provider.validate({
      ...SAMPLE_INPUT,
      documentType: "unknown_type",
    });
    expect(report.status).toBe("warning");
    expect(report.warningCount).toBeGreaterThan(0);
  });

  it("produces different results for different document types", async () => {
    const provider = createValidationProvider();
    const bdn = await provider.validate({
      ...SAMPLE_INPUT,
      documentType: "imo_dcs",
    });
    const euEts = await provider.validate({
      ...SAMPLE_INPUT,
      documentType: "eu_mrv",
    });
    const report = await provider.validate({
      ...SAMPLE_INPUT,
      documentType: "report",
    });
    expect(bdn.score).toBe(100);
    expect(euEts.score).toBe(95);
    expect(report.score).toBe(100);
  });
});

run();
