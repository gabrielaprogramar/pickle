import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  runCrossDocumentValidations,
  bdnFuelQuantityMatchesDcs,
  bdnFuelTypeMatchesEuMrv,
  voyageDistanceConsistency,
  imoConsistencyAcrossDocuments,
  vesselNameConsistency,
  reportingPeriodConsistency,
} from "../cross-document";
import type { CrossDocumentInput, ValidationInput } from "../types";

function bdnDoc(overrides?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "bunker_delivery_note",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      fuelType: "HFO",
      quantityTonnes: 200,
      ...overrides,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "BDN",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

function dcsDoc(overrides?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "imo_dcs",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      fuelConsumptionTonnes: 180,
      reportingPeriod: "2025",
      ...overrides,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "DCS",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

function mrvDoc(overrides?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "eu_mrv",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      fuelType: "HFO",
      reportingPeriod: "2025",
      ...overrides,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "MRV",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

function noonDoc(overrides?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "noon_report",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      distanceActualNm: 120,
      ...overrides,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "Noon Report",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

function logbookDoc(overrides?: Partial<ValidationInput["extractionFields"]>): ValidationInput {
  return {
    documentType: "logbook_entry",
    extractionFields: {
      imoNumber: "1234567",
      vesselName: "Test Vessel",
      distanceToGoNm: 130,
      ...overrides,
    },
    ocrConfidence: 0.95,
    extractionConfidence: 0.9,
    extractionSummary: "Logbook",
    extractionWarnings: [],
    extractionMissingFields: [],
  };
}

function makeInput(extractions: ValidationInput[]): CrossDocumentInput {
  return { extractions, vesselImo: "1234567" };
}

describe("Cross-Document Validation", () => {
  describe("bdnFuelQuantityMatchesDcs", () => {
    it("passes when BDN quantity is consistent with DCS consumption", () => {
      const input = makeInput([bdnDoc(), dcsDoc()]);
      const result = bdnFuelQuantityMatchesDcs(input);
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("warns when BDN quantity is inconsistent with DCS consumption", () => {
      const input = makeInput([
        bdnDoc({ quantityTonnes: 1000 }),
        dcsDoc({ fuelConsumptionTonnes: 100 }),
      ]);
      const result = bdnFuelQuantityMatchesDcs(input);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("warning");
      expect(result.remediation).toBeTruthy();
    });

    it("returns info when only one document is provided", () => {
      const input = makeInput([bdnDoc()]);
      const result = bdnFuelQuantityMatchesDcs(input);
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("returns info when quantities are missing", () => {
      const input = makeInput([
        bdnDoc({ quantityTonnes: undefined }),
        dcsDoc({ fuelConsumptionTonnes: undefined }),
      ]);
      const result = bdnFuelQuantityMatchesDcs(input);
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("has ruleConfidence", () => {
      const input = makeInput([bdnDoc(), dcsDoc()]);
      const result = bdnFuelQuantityMatchesDcs(input);
      expect(result.ruleConfidence).toBe(0.85);
    });
  });

  describe("bdnFuelTypeMatchesEuMrv", () => {
    it("passes when fuel types match", () => {
      const input = makeInput([bdnDoc(), mrvDoc()]);
      const result = bdnFuelTypeMatchesEuMrv(input);
      expect(result.passed).toBe(true);
    });

    it("fails when fuel types differ", () => {
      const input = makeInput([
        bdnDoc({ fuelType: "HFO" }),
        mrvDoc({ fuelType: "MDO" }),
      ]);
      const result = bdnFuelTypeMatchesEuMrv(input);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("error");
      expect(result.remediation).toBeTruthy();
    });

    it("performs case-insensitive comparison", () => {
      const input = makeInput([
        bdnDoc({ fuelType: "HFO" }),
        mrvDoc({ fuelType: "hfo" }),
      ]);
      const result = bdnFuelTypeMatchesEuMrv(input);
      expect(result.passed).toBe(true);
    });
  });

  describe("voyageDistanceConsistency", () => {
    it("passes when distances are within 20%", () => {
      const input = makeInput([noonDoc({ distanceActualNm: 100 }), logbookDoc({ distanceToGoNm: 110 })]);
      const result = voyageDistanceConsistency(input);
      expect(result.passed).toBe(true);
    });

    it("warns when distances differ by more than 20%", () => {
      const input = makeInput([noonDoc({ distanceActualNm: 100 }), logbookDoc({ distanceToGoNm: 50 })]);
      const result = voyageDistanceConsistency(input);
      expect(result.passed).toBe(false);
      expect(result.remediation).toBeTruthy();
    });

    it("returns info when only one document provided", () => {
      const input = makeInput([noonDoc()]);
      const result = voyageDistanceConsistency(input);
      expect(result.passed).toBe(true);
    });

    it("has ruleConfidence", () => {
      const input = makeInput([noonDoc(), logbookDoc()]);
      const result = voyageDistanceConsistency(input);
      expect(result.ruleConfidence).toBe(0.8);
    });
  });

  describe("imoConsistencyAcrossDocuments", () => {
    it("passes when all IMO numbers match", () => {
      const input = makeInput([bdnDoc(), dcsDoc(), mrvDoc()]);
      const result = imoConsistencyAcrossDocuments(input);
      expect(result.passed).toBe(true);
    });

    it("fails when IMO numbers differ", () => {
      const input = makeInput([
        bdnDoc({ imoNumber: "1234567" }),
        dcsDoc({ imoNumber: "7654321" }),
      ]);
      const result = imoConsistencyAcrossDocuments(input);
      expect(result.passed).toBe(false);
    });

    it("returns info with only one document", () => {
      const input = makeInput([bdnDoc()]);
      const result = imoConsistencyAcrossDocuments(input);
      expect(result.passed).toBe(true);
    });
  });

  describe("vesselNameConsistency", () => {
    it("passes when all names match", () => {
      const input = makeInput([bdnDoc(), dcsDoc()]);
      const result = vesselNameConsistency(input);
      expect(result.passed).toBe(true);
    });

    it("warns when names differ", () => {
      const input = makeInput([
        bdnDoc({ vesselName: "Alpha" }),
        dcsDoc({ vesselName: "Beta" }),
      ]);
      const result = vesselNameConsistency(input);
      expect(result.passed).toBe(false);
    });
  });

  describe("reportingPeriodConsistency", () => {
    it("passes when periods match", () => {
      const input = makeInput([dcsDoc(), dcsDoc({ fuelType: "LNG" })]);
      const result = reportingPeriodConsistency(input);
      expect(result.passed).toBe(true);
    });

    it("fails when periods differ", () => {
      const input = makeInput([
        dcsDoc({ reportingPeriod: "2025" }),
        mrvDoc({ reportingPeriod: "2024" }),
      ]);
      const result = reportingPeriodConsistency(input);
      expect(result.passed).toBe(false);
    });
  });

  describe("runCrossDocumentValidations", () => {
    it("runs all rules and returns results", () => {
      const input = makeInput([bdnDoc(), dcsDoc(), mrvDoc(), noonDoc(), logbookDoc()]);
      const results = runCrossDocumentValidations(input);
      expect(results.length).toBe(6);
      for (const r of results) {
        expect(typeof r.passed).toBe("boolean");
      }
    });

    it("handles empty extractions", () => {
      const input = makeInput([]);
      const results = runCrossDocumentValidations(input);
      expect(results.length).toBe(6);
    });
  });
});

run();
