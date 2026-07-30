import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  calculateFuelTotals,
  calculateEmissionsMetrics,
  calculateVoyageMetrics,
  calculateCiiMetrics,
  calculateFuelEuMetrics,
  checkEmissionsConsistency,
} from "../calculations";
import type { ValidationInput } from "../types";

function makeInput(extra?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "imo_dcs",
    extractionFields: {
      quantityTonnes: 100,
      fuelConsumptionTonnes: 80,
      fuelRobsTonnes: 20,
      totalCo2Tonnes: 300,
      totalEnergyMwh: 1000,
      ...extra,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "test",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

describe("Calculations", () => {
  describe("calculateFuelTotals", () => {
    it("returns correct totals", () => {
      const input = makeInput();
      const result = calculateFuelTotals(input);
      expect(result.totalBunkeredTonnes).toBe(100);
      expect(result.totalConsumedTonnes).toBe(80);
      expect(result.totalRemainingTonnes).toBe(20);
    });

    it("falls back to alternative field names for consumption", () => {
      const input = makeInput({ fuelConsumptionTonnes: undefined, fuelUsedTonnes: 75 });
      const result = calculateFuelTotals(input);
      expect(result.totalConsumedTonnes).toBe(75);
    });

    it("calculates remaining as max(0, bunkered - consumed) when no ROB", () => {
      const input = makeInput({ fuelRobsTonnes: undefined });
      const result = calculateFuelTotals(input);
      expect(result.totalRemainingTonnes).toBe(20);
    });

    it("handles missing data gracefully", () => {
      const input = makeInput({ quantityTonnes: undefined, fuelConsumptionTonnes: undefined, fuelRobsTonnes: undefined });
      const result = calculateFuelTotals(input);
      expect(result.totalBunkeredTonnes).toBe(0);
      expect(result.totalConsumedTonnes).toBe(0);
      expect(result.totalRemainingTonnes).toBe(0);
    });
  });

  describe("calculateEmissionsMetrics", () => {
    it("returns CO2 per energy unit", () => {
      const input = makeInput({ totalCo2Tonnes: 500, totalEnergyMwh: 1000 });
      const result = calculateEmissionsMetrics(input);
      expect(result.co2PerEnergyUnit).toBe(0.5);
    });

    it("returns null for missing energy", () => {
      const input = makeInput({ totalEnergyMwh: undefined });
      const result = calculateEmissionsMetrics(input);
      expect(result.co2PerEnergyUnit).toBeNull();
    });

    it("calculates voyage/total ratio", () => {
      const input = makeInput({ totalCo2Tonnes: 500, euVoyageEmissionsTonnes: 300, euPortEmissionsTonnes: 200 });
      const result = calculateEmissionsMetrics(input);
      expect(result.voyageToTotalRatio).toBe(0.6);
      expect(result.portToTotalRatio).toBe(0.4);
    });
  });

  describe("calculateVoyageMetrics", () => {
    it("returns distance from distanceActualNm", () => {
      const input = makeInput({ distanceActualNm: 500, speedKnots: 25 });
      const result = calculateVoyageMetrics(input);
      expect(result.distanceNm).toBe(500);
    });

    it("calculates duration from departure/arrival dates", () => {
      const input = makeInput({
        departureDate: "2025-01-01T00:00:00Z",
        arrivalDate: "2025-01-04T00:00:00Z",
      });
      const result = calculateVoyageMetrics(input);
      expect(result.durationDays).toBe(3);
    });

    it("returns average speed from distance and duration", () => {
      const input = makeInput({
        distanceActualNm: 720,
        departureDate: "2025-01-01T00:00:00Z",
        arrivalDate: "2025-01-02T00:00:00Z",
      });
      const result = calculateVoyageMetrics(input);
      expect(result.averageSpeedKnots).toBe(30);
    });

    it("falls back to speedKnots when no distance", () => {
      const input = makeInput({ speedKnots: 22 });
      const result = calculateVoyageMetrics(input);
      expect(result.averageSpeedKnots).toBe(22);
    });
  });

  describe("calculateCiiMetrics", () => {
    it("returns compliance when operational <= required", () => {
      const input = makeInput({ operationalCii: 5, requiredCii: 10 });
      const result = calculateCiiMetrics(input);
      expect(result.operationalCii).toBe(5);
      expect(result.requiredCii).toBe(10);
      expect(result.ciiRatio).toBe(0.5);
      expect(result.isCompliant).toBe(true);
    });

    it("returns non-compliant when operational > required", () => {
      const input = makeInput({ operationalCii: 12, requiredCii: 10 });
      const result = calculateCiiMetrics(input);
      expect(result.isCompliant).toBe(false);
    });

    it("returns nulls when data missing", () => {
      const input = makeInput({ operationalCii: undefined, requiredCii: undefined });
      const result = calculateCiiMetrics(input);
      expect(result.operationalCii).toBeNull();
      expect(result.isCompliant).toBeNull();
    });
  });

  describe("calculateFuelEuMetrics", () => {
    it("returns GHG intensity values", () => {
      const input = makeInput({ ghgIntensityWtw: 80, ghgIntensityTtw: 70, euRelativeGhgIntensity: -5 });
      const result = calculateFuelEuMetrics(input);
      expect(result.ghgIntensityWtw).toBe(80);
      expect(result.ghgIntensityTtw).toBe(70);
      expect(result.ghgReductionPct).toBe(-5);
    });

    it("returns nulls when missing", () => {
      const input = makeInput({ ghgIntensityWtw: undefined });
      const result = calculateFuelEuMetrics(input);
      expect(result.ghgIntensityWtw).toBeNull();
    });
  });

  describe("checkEmissionsConsistency", () => {
    it("detects consistent emissions", () => {
      const input = makeInput({ totalCo2Tonnes: 500, totalEnergyMwh: 1000 });
      const result = checkEmissionsConsistency(input);
      expect(result.isConsistent).toBe(true);
    });

    it("detects missing data", () => {
      const input = makeInput({ totalCo2Tonnes: undefined, totalEnergyMwh: undefined });
      const result = checkEmissionsConsistency(input);
      expect(result.isConsistent).toBeNull();
    });

    it("returns null CO2/fuel ratio when consumption is 0", () => {
      const input = makeInput({ fuelConsumptionTonnes: 0 });
      const result = checkEmissionsConsistency(input);
      expect(result.co2VsFuelRatio).toBeNull();
    });
  });
});

run();
