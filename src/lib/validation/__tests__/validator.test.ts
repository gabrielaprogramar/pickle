import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { assembleReport, createValidator, createWeightedValidator, computeWeightedConfidence, VALIDATOR_VER } from "../validator";
import { runAllRules } from "../rules";
import type { ValidationInput, ValidationRuleResult } from "../types";

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
      bdnReference: "BDN-2026-001",
      shipType: "Container Ship",
      ratingYear: 2026,
      ciiRating: "C",
      operationalCii: 9.5,
      requiredCii: 10.2,
      attainedEexi: 8.1,
    },
    extractionSummary: "BDN for bunkering at Rotterdam",
    extractionWarnings: [],
    extractionMissingFields: [],
    documentType: "imo_dcs",
    ocrConfidence: 0.92,
    ...overrides,
  };
}

describe("assembleReport", () => {
  it("returns status 'passed' when all rules pass", () => {
    const rules = runAllRules(makeInput());
    const report = assembleReport(rules, makeInput());
    expect(report.status).toBe("passed");
    expect(report.readyForReview).toBe(true);
    expect(report.blockingIssues.length).toBe(0);
  });

  it("returns status 'failed' when errors exist", () => {
    const errorRule: ValidationRuleResult = {
      ruleId: "test.error",
      ruleName: "Test error",
      category: "structural",
      passed: false,
      severity: "error",
      message: "Test error message",
    };
    const passingRule: ValidationRuleResult = {
      ruleId: "test.passing",
      ruleName: "Test passing",
      category: "structural",
      passed: true,
      severity: null,
      message: "Test passed",
    };
    const report = assembleReport([errorRule, passingRule], makeInput());
    expect(report.status).toBe("failed");
    expect(report.readyForReview).toBe(false);
    expect(report.errorCount).toBe(1);
  });

  it("returns status 'warning' when only warnings exist", () => {
    const warningRule: ValidationRuleResult = {
      ruleId: "test.warning",
      ruleName: "Test warning",
      category: "confidence",
      passed: false,
      severity: "warning",
      message: "Test warning message",
    };
    const passingRule: ValidationRuleResult = {
      ruleId: "test.passing",
      ruleName: "Test passing",
      category: "structural",
      passed: true,
      severity: null,
      message: "Test passed",
    };
    const report = assembleReport([warningRule, passingRule], makeInput());
    expect(report.status).toBe("warning");
    expect(report.readyForReview).toBe(true);
    expect(report.warningCount).toBe(1);
  });

  it("calculates score correctly", () => {
    const rules: Array<{
      ruleId: string; ruleName: string; category: "structural" | "maritime" | "confidence";
      passed: boolean; severity: "error" | "warning" | null; message: string;
    }> = [];
    for (let i = 0; i < 10; i++) {
      rules.push({
        ruleId: `passing.${i}`,
        ruleName: `Passing ${i}`,
        category: "structural",
        passed: true,
        severity: null,
        message: "Passed",
      });
    }
    rules.push({
      ruleId: "failing.1",
      ruleName: "Failing 1",
      category: "structural",
      passed: false,
      severity: "warning",
      message: "Failed",
    });

    const report = assembleReport(rules, makeInput());
    expect(report.score).toBe(91);
  });

  it("includes recommended review reasons for warnings", () => {
    const warning: ValidationRuleResult = {
      ruleId: "test.warning",
      ruleName: "Test warning",
      category: "confidence",
      passed: false,
      severity: "warning",
      message: "Warning",
    };
    const report = assembleReport([warning], makeInput());
    expect(report.recommendedReview.length).toBeGreaterThan(0);
    expect(report.recommendedReview[0]).toContainString("warning");
  });

  it("includes recommended review for low OCR confidence", () => {
    const report = assembleReport([], makeInput({ ocrConfidence: 0.5 }));
    expect(report.recommendedReview.length).toBeGreaterThan(0);
    expect(report.recommendedReview.some((r) => r.includes("OCR"))).toBe(true);
  });

  it("includes recommended review for low AI confidence", () => {
    const report = assembleReport([], makeInput({ extractionConfidence: 0.4 }));
    expect(report.recommendedReview.length).toBeGreaterThan(0);
    expect(report.recommendedReview.some((r) => r.includes("AI"))).toBe(true);
  });

  it("includes recommended review for missing fields", () => {
    const report = assembleReport([], makeInput({ extractionMissingFields: ["imoNumber"] }));
    expect(report.recommendedReview.length).toBeGreaterThan(0);
    expect(report.recommendedReview.some((r) => r.includes("field"))).toBe(true);
  });

  it("sets errorCount and warningCount correctly", () => {
    const error: ValidationRuleResult = {
      ruleId: "error", ruleName: "Error", category: "structural",
      passed: false, severity: "error", message: "E",
    };
    const warning: ValidationRuleResult = {
      ruleId: "warning", ruleName: "Warning", category: "confidence",
      passed: false, severity: "warning", message: "W",
    };
    const report = assembleReport([error, warning], makeInput());
    expect(report.errorCount).toBe(1);
    expect(report.warningCount).toBe(1);
    expect(report.failedCount).toBe(2);
  });
});

describe("createValidator", () => {
  it("returns a ValidationProvider that produces a report", async () => {
    const validator = createValidator();
    const report = await validator.validate(makeInput());
    expect(report).toBeTruthy();
    expect(report.status).toBe("passed");
    expect(report.score).toBeGreaterThan(0);
    expect(report.ruleResults.length).toBeGreaterThan(0);
  });

  it("returns blocking issues for errors", async () => {
    const validator = createValidator();
    const report = await validator.validate(
      makeInput({
        extractionFields: {
          imoNumber: "bad",
          vesselName: "Test",
        },
      }),
    );
    expect(report.status).toBe("failed");
    expect(report.blockingIssues.length).toBeGreaterThan(0);
    expect(report.readyForReview).toBe(false);
  });
});

describe("VALIDATOR_VER", () => {
  it("is a non-empty string", () => {
    expect(typeof VALIDATOR_VER).toBe("string");
    expect(VALIDATOR_VER.length).toBeGreaterThan(0);
  });
});

describe("computeWeightedConfidence", () => {
  it("returns 1.0 for perfect scores", () => {
    const result = computeWeightedConfidence(1.0, 1.0, 100);
    expect(result).toBe(1.0);
  });

  it("returns 0.0 for zero scores", () => {
    const result = computeWeightedConfidence(0, 0, 0);
    expect(result).toBe(0);
  });

  it("weights extraction confidence the highest", () => {
    // OCR=1.0, AI=0.5, Validation=1.0 → 0.2*1 + 0.5*0.5 + 0.3*1 = 0.2+0.25+0.3 = 0.75
    const result = computeWeightedConfidence(1.0, 0.5, 100);
    expect(result).toBe(0.75);
  });

  it("gives more weight to extraction than OCR", () => {
    const highOcr = computeWeightedConfidence(1.0, 0, 0);
    const highAi = computeWeightedConfidence(0, 1.0, 0);
    expect(highAi).toBeGreaterThan(highOcr);
  });

  it("rounds to 3 decimal places", () => {
    const result = computeWeightedConfidence(0.33, 0.33, 33);
    expect(result.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(3);
  });
});

describe("createWeightedValidator", () => {
  it("returns a ValidationProvider", () => {
    const validator = createWeightedValidator();
    expect(validator).toBeTruthy();
    expect(typeof validator.validate).toBe("function");
  });

  it("produces a weighted score", async () => {
    const validator = createWeightedValidator();
    const report = await validator.validate({
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
        bdnReference: "BDN-2026-001",
        shipType: "Container Ship",
        ratingYear: 2026,
        ciiRating: "C",
        operationalCii: 9.5,
        requiredCii: 10.2,
        attainedEexi: 8.1,
      },
      extractionSummary: "Summary",
      extractionWarnings: [],
      extractionMissingFields: [],
      documentType: "imo_dcs",
      ocrConfidence: 0.92,
    });
    expect(report.score).toBeGreaterThan(0);
    expect(report.status).toBe("passed");
  });
});

run();
