import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { runAllRules } from "../rules";
import type { ValidationInput } from "../types";

function makeInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    extractionConfidence: 0.95,
    extractionFields: {
      imoNumber: "9876543",
      vesselName: "Test Vessel",
      deliveryDate: "2026-06-15",
      quantityTonnes: 1500,
      sulphurContentPct: 0.5,
      densityKgM3: 950,
      port: "Rotterdam",
      fuelType: "VLSFO",
      supplier: "Supplier Co",
    },
    extractionSummary: "BDN for bunkering at Rotterdam",
    extractionWarnings: [],
    extractionMissingFields: [],
    documentType: "imo_dcs",
    ocrConfidence: 0.92,
    ...overrides,
  };
}

describe("Validation Rules — structural", () => {
  it("passes all structural rules for valid input", () => {
    const results = runAllRules(makeInput());
    const structural = results.filter((r) => r.category === "structural");
    const failed = structural.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails required field rule when imoNumber is missing", () => {
    const results = runAllRules(makeInput({
      extractionFields: { vesselName: "Test" },
    }));
    const rule = results.find((r) => r.ruleId === "structural.required.imoNumber");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails type rule when imoNumber is not a string", () => {
    const results = runAllRules(makeInput({
      extractionFields: { imoNumber: 12345, vesselName: "Test" },
    }));
    const rule = results.find((r) => r.ruleId === "structural.type.imoNumber");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes date rule for valid ISO date", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "structural.date.deliveryDate");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails date rule for invalid date", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        deliveryDate: "not-a-date",
      },
    }));
    const rule = results.find((r) => r.ruleId === "structural.date.deliveryDate");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails numeric rule when quantity is not a number", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        quantityTonnes: "abc",
      },
    }));
    const rule = results.find((r) => r.ruleId === "structural.numeric.quantityTonnes");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("Validation Rules — maritime", () => {
  it("passes IMO format for valid 7-digit IMO", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "maritime.imo_format");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails IMO format for invalid IMO", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "123",
        vesselName: "Test",
      },
    }));
    const rule = results.find((r) => r.ruleId === "maritime.imo_format");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes sulphur range for 0.5%", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "maritime.sulphur_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails sulphur range for 15%", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        sulphurContentPct: 15,
      },
    }));
    const rule = results.find((r) => r.ruleId === "maritime.sulphur_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes density range for 950 kg/m³", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "maritime.density_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails density range for 500 kg/m³", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        densityKgM3: 500,
      },
    }));
    const rule = results.find((r) => r.ruleId === "maritime.density_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes quantity positive for positive values", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "maritime.quantity_positive");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails quantity positive for zero", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        quantityTonnes: 0,
      },
    }));
    const rule = results.find((r) => r.ruleId === "maritime.quantity_positive");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails quantity positive for negative values", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        quantityTonnes: -100,
      },
    }));
    const rule = results.find((r) => r.ruleId === "maritime.quantity_positive");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("Validation Rules — confidence", () => {
  it("passes OCR confidence at 0.92", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "confidence.ocr_high");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails OCR confidence below 0.7", () => {
    const results = runAllRules(makeInput({ ocrConfidence: 0.5 }));
    const rule = results.find((r) => r.ruleId === "confidence.ocr_high");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails AI confidence below 0.6", () => {
    const results = runAllRules(makeInput({ extractionConfidence: 0.4 }));
    const rule = results.find((r) => r.ruleId === "confidence.ai_high");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails when summary is empty", () => {
    const results = runAllRules(makeInput({ extractionSummary: "" }));
    const rule = results.find((r) => r.ruleId === "confidence.summary_not_empty");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails when AI extraction has warnings", () => {
    const results = runAllRules(makeInput({
      extractionWarnings: ["Low quality scan"],
    }));
    const rule = results.find((r) => r.ruleId === "confidence.no_extraction_warnings");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails when more than 2 missing fields", () => {
    const results = runAllRules(makeInput({
      extractionMissingFields: ["imoNumber", "vesselName", "port"],
    }));
    const rule = results.find((r) => r.ruleId === "confidence.few_missing_fields");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("returns all rule results from all categories", () => {
    const results = runAllRules(makeInput());
    const categories = new Set(results.map((r) => r.category));
    expect(categories.has("structural")).toBe(true);
    expect(categories.has("maritime")).toBe(true);
    expect(categories.has("confidence")).toBe(true);
  });
});

run();
