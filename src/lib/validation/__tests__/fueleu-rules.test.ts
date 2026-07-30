import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { runAllRules } from "../rules";
import type { ValidationInput } from "../types";

function fuelEuInput(extra?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "fuel_eu",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      reportingPeriod: "2025",
      totalEnergyMwh: 5000,
      ghgIntensityWtw: 80,
      ghgIntensityTtw: 70,
      ...extra,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "FuelEU test",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

describe("FuelEU Validation Rules", () => {
  describe("fueleu.required_fields", () => {
    it("passes when all required fields present", () => {
      const results = runAllRules(fuelEuInput());
      const rule = results.find((r) => r.ruleId === "fueleu.required_fields");
      expect(rule?.passed).toBe(true);
    });

    it("fails when fields are missing", () => {
      const results = runAllRules(fuelEuInput({ imoNumber: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.required_fields");
      expect(rule?.passed).toBe(false);
      expect(rule?.severity).toBe("blocking");
      expect(rule?.remediation).toBeTruthy();
    });

    it("returns remediation on failure", () => {
      const results = runAllRules(fuelEuInput({ ghgIntensityWtw: undefined, ghgIntensityTtw: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.required_fields");
      expect(rule?.passed).toBe(false);
      expect(rule?.remediation).toBeTruthy();
    });
  });

  describe("fueleu.energy_positive", () => {
    it("passes when energy > 0", () => {
      const results = runAllRules(fuelEuInput());
      const rule = results.find((r) => r.ruleId === "fueleu.energy_positive");
      expect(rule?.passed).toBe(true);
    });

    it("fails when energy <= 0", () => {
      const results = runAllRules(fuelEuInput({ totalEnergyMwh: -10 }));
      const rule = results.find((r) => r.ruleId === "fueleu.energy_positive");
      expect(rule?.passed).toBe(false);
      expect(rule?.severity).toBe("error");
      expect(rule?.remediation).toBeTruthy();
    });

    it("passes when energy not provided", () => {
      const results = runAllRules(fuelEuInput({ totalEnergyMwh: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.energy_positive");
      expect(rule?.passed).toBe(true);
    });
  });

  describe("fueleu.ghg_intensity_range", () => {
    it("passes when GHG values in range", () => {
      const results = runAllRules(fuelEuInput());
      const rule = results.find((r) => r.ruleId === "fueleu.ghg_intensity_range");
      expect(rule?.passed).toBe(true);
    });

    it("fails when WTW is out of range", () => {
      const results = runAllRules(fuelEuInput({ ghgIntensityWtw: 999 }));
      const rule = results.find((r) => r.ruleId === "fueleu.ghg_intensity_range");
      expect(rule?.passed).toBe(false);
      expect(rule?.remediation).toBeTruthy();
    });

    it("has ruleConfidence", () => {
      const results = runAllRules(fuelEuInput({ ghgIntensityWtw: 999 }));
      const rule = results.find((r) => r.ruleId === "fueleu.ghg_intensity_range");
      expect(rule?.ruleConfidence).toBe(0.85);
    });
  });

  describe("fueleu.wtw_greater_than_ttw", () => {
    it("passes when WTW >= TTW", () => {
      const results = runAllRules(fuelEuInput());
      const rule = results.find((r) => r.ruleId === "fueleu.wtw_greater_than_ttw");
      expect(rule?.passed).toBe(true);
    });

    it("fails when WTW < TTW", () => {
      const results = runAllRules(fuelEuInput({ ghgIntensityWtw: 60, ghgIntensityTtw: 80 }));
      const rule = results.find((r) => r.ruleId === "fueleu.wtw_greater_than_ttw");
      expect(rule?.passed).toBe(false);
      expect(rule?.remediation).toBeTruthy();
    });

    it("passes when GHG data insufficient", () => {
      const results = runAllRules(fuelEuInput({ ghgIntensityWtw: undefined, ghgIntensityTtw: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.wtw_greater_than_ttw");
      expect(rule?.passed).toBe(true);
    });
  });

  describe("fueleu.compliance_status", () => {
    it("passes when isCompliant is boolean", () => {
      const results = runAllRules(fuelEuInput({ isCompliant: true }));
      const rule = results.find((r) => r.ruleId === "fueleu.compliance_status");
      expect(rule?.passed).toBe(true);
      expect(rule?.message).toContainString("Compliant");
    });

    it("passes when not provided", () => {
      const results = runAllRules(fuelEuInput({ isCompliant: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.compliance_status");
      expect(rule?.passed).toBe(true);
    });

    it("fails when isCompliant is non-boolean", () => {
      const results = runAllRules(fuelEuInput({ isCompliant: "yes" }));
      const rule = results.find((r) => r.ruleId === "fueleu.compliance_status");
      expect(rule?.passed).toBe(false);
    });
  });

  describe("fueleu.fuel_breakdown", () => {
    it("passes when breakdown present", () => {
      const results = runAllRules(fuelEuInput({ fuelBreakdown: [{ fuelType: "HFO", quantity: 100 }] }));
      const rule = results.find((r) => r.ruleId === "fueleu.fuel_breakdown");
      expect(rule?.passed).toBe(true);
    });

    it("passes when breakdown not provided", () => {
      const results = runAllRules(fuelEuInput());
      const rule = results.find((r) => r.ruleId === "fueleu.fuel_breakdown");
      expect(rule?.passed).toBe(true);
    });

    it("fails when breakdown empty", () => {
      const results = runAllRules(fuelEuInput({ fuelBreakdown: [] }));
      const rule = results.find((r) => r.ruleId === "fueleu.fuel_breakdown");
      expect(rule?.passed).toBe(false);
      expect(rule?.remediation).toBeTruthy();
    });
  });

  describe("fueleu.reduction_percentage", () => {
    it("passes when reduction in valid range", () => {
      const results = runAllRules(fuelEuInput({ euRelativeGhgIntensity: -5 }));
      const rule = results.find((r) => r.ruleId === "fueleu.reduction_percentage");
      expect(rule?.passed).toBe(true);
    });

    it("fails when reduction out of range", () => {
      const results = runAllRules(fuelEuInput({ euRelativeGhgIntensity: 200 }));
      const rule = results.find((r) => r.ruleId === "fueleu.reduction_percentage");
      expect(rule?.passed).toBe(false);
      expect(rule?.remediation).toBeTruthy();
    });

    it("passes when not provided", () => {
      const results = runAllRules(fuelEuInput({ euRelativeGhgIntensity: undefined }));
      const rule = results.find((r) => r.ruleId === "fueleu.reduction_percentage");
      expect(rule?.passed).toBe(true);
    });

    it("has ruleConfidence", () => {
      const results = runAllRules(fuelEuInput({ euRelativeGhgIntensity: 200 }));
      const rule = results.find((r) => r.ruleId === "fueleu.reduction_percentage");
      expect(rule?.ruleConfidence).toBe(0.9);
    });
  });

  describe("cross-field and existing rules still pass", () => {
    it("runs all rules without error", () => {
      const results = runAllRules(fuelEuInput());
      expect(results.length).toBeGreaterThan(0);
      const structural = results.filter((r) => r.category === "structural");
      expect(structural.length).toBeGreaterThan(0);
    });

    it("has remediation on some rules", () => {
      const results = runAllRules(fuelEuInput({ totalEnergyMwh: 0 }));
      const withRemediation = results.filter((r) => r.remediation !== undefined);
      expect(withRemediation.length).toBeGreaterThan(0);
    });
  });
});

run();
