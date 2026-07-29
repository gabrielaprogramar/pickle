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
      bdnReference: "BDN-2026-001",
      shipType: "Container Ship",
      ratingYear: 2026,
      ciiRating: "C",
      operationalCii: 9.5,
      requiredCii: 10.2,
      attainedEexi: 8.1,
      fleetAverageCii: 9.8,
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

describe("IMO DCS rule group", () => {
  it("passes all DCS rules for valid DCS input", () => {
    const results = runAllRules(makeInput());
    const dcsRules = results.filter((r) => r.ruleId.startsWith("dcs."));
    const failed = dcsRules.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails dcs.required_fields when mandatory fields missing", () => {
    const results = runAllRules(makeInput({
      extractionFields: { imoNumber: "9876543", vesselName: "Test" },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.required_fields");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
    expect(rule!.severity).toBe("blocking");
  });

  it("fails dcs.hours_underway for negative hours", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, hoursUnderway: -1 },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.hours_underway");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes dcs.hours_underway for zero hours", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, hoursUnderway: 0 },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.hours_underway");
    expect(rule!.passed).toBe(true);
  });

  it("fails dcs.date_consistency when arrival <= departure", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        departureDate: "2026-06-20",
        arrivalDate: "2026-06-15",
      },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.date_consistency");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes dcs.date_consistency when arrival > departure", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        departureDate: "2026-06-15",
        arrivalDate: "2026-06-20",
      },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.date_consistency");
    expect(rule!.passed).toBe(true);
  });

  it("fails dcs.valid_cii_rating for invalid rating", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, ciiRating: "X" },
    }));
    const rule = results.find((r) => r.ruleId === "dcs.valid_cii_rating");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("EU MRV rule group", () => {
  function mrvInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
    return {
      extractionConfidence: 0.95,
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test Vessel",
        reportingPeriod: "2026",
        totalCo2Tonnes: 12500,
        euVoyageEmissionsTonnes: 8000,
        euPortEmissionsTonnes: 500,
        monitoringMethodology: "B2",
      },
      extractionSummary: "MRV report",
      extractionWarnings: [],
      extractionMissingFields: [],
      documentType: "eu_mrv",
      ocrConfidence: 0.92,
      ...overrides,
    };
  }

  it("passes all MRV rules for valid MRV input", () => {
    const results = runAllRules(mrvInput());
    const mrvRules = results.filter((r) => r.ruleId.startsWith("mrv."));
    const failed = mrvRules.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails mrv.required_fields when fields missing", () => {
    const results = runAllRules(mrvInput({
      extractionFields: { imoNumber: "9876543" },
    }));
    const rule = results.find((r) => r.ruleId === "mrv.required_fields");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
    expect(rule!.severity).toBe("blocking");
  });

  it("fails mrv.emissions_positive for negative values", () => {
    const results = runAllRules(mrvInput({
      extractionFields: {
        ...mrvInput().extractionFields,
        totalCo2Tonnes: -100,
      },
    }));
    const rule = results.find((r) => r.ruleId === "mrv.emissions_positive");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails mrv.allocated_allowances_valid for negative allowances", () => {
    const results = runAllRules(mrvInput({
      extractionFields: {
        ...mrvInput().extractionFields,
        allocatedAllowances: -1,
      },
    }));
    const rule = results.find((r) => r.ruleId === "mrv.allocated_allowances_valid");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails mrv.monitoring_methodology when missing", () => {
    const results = runAllRules(mrvInput({
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test",
        reportingPeriod: "2026",
        totalCo2Tonnes: 100,
      },
    }));
    const rule = results.find((r) => r.ruleId === "mrv.monitoring_methodology");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("BDN rule group", () => {
  it("passes all BDN rules for valid BDN input", () => {
    const results = runAllRules(makeInput());
    const bdnRules = results.filter((r) => r.ruleId.startsWith("bdn."));
    const failed = bdnRules.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails bdn.supplier_present when supplier missing", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, supplier: "" },
    }));
    const rule = results.find((r) => r.ruleId === "bdn.supplier_present");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails bdn.fuel_grade_present when fuel type missing", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, fuelType: "" },
    }));
    const rule = results.find((r) => r.ruleId === "bdn.fuel_grade_present");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails bdn.quantity_positive for zero quantity", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, quantityTonnes: 0 },
    }));
    const rule = results.find((r) => r.ruleId === "bdn.quantity_positive");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails bdn.delivery_date_present when missing", () => {
    const results = runAllRules(makeInput({
      extractionFields: { ...makeInput().extractionFields, deliveryDate: undefined },
    }));
    const rule = results.find((r) => r.ruleId === "bdn.delivery_date_present");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes bdn.bdn_reference_present as warning when present", () => {
    const results = runAllRules(makeInput());
    const rule = results.find((r) => r.ruleId === "bdn.bdn_reference_present");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });
});

describe("Noon Report rule group", () => {
  function noonInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
    return {
      extractionConfidence: 0.95,
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test Vessel",
        reportDate: "2026-06-15",
        positionLatitude: 41.5,
        positionLongitude: -71.3,
        speedKnots: 14.5,
        engineRpm: 120,
        windSpeedKnots: 25,
      },
      extractionSummary: "Noon report",
      extractionWarnings: [],
      extractionMissingFields: [],
      documentType: "noon_report",
      ocrConfidence: 0.92,
      ...overrides,
    };
  }

  it("passes all Noon Report rules for valid input", () => {
    const results = runAllRules(noonInput());
    const noonRules = results.filter((r) => r.ruleId.startsWith("noon."));
    const failed = noonRules.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails noon.required_fields when fields missing", () => {
    const results = runAllRules(noonInput({
      extractionFields: { imoNumber: "9876543" },
    }));
    const rule = results.find((r) => r.ruleId === "noon.required_fields");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
    expect(rule!.severity).toBe("blocking");
  });

  it("fails noon.rpm_range for excessive RPM", () => {
    const results = runAllRules(noonInput({
      extractionFields: { ...noonInput().extractionFields, engineRpm: 999 },
    }));
    const rule = results.find((r) => r.ruleId === "noon.rpm_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails noon.speed_range for excessive speed", () => {
    const results = runAllRules(noonInput({
      extractionFields: { ...noonInput().extractionFields, speedKnots: 80 },
    }));
    const rule = results.find((r) => r.ruleId === "noon.speed_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails noon.coordinates_valid for latitude > 90", () => {
    const results = runAllRules(noonInput({
      extractionFields: { ...noonInput().extractionFields, positionLatitude: 100 },
    }));
    const rule = results.find((r) => r.ruleId === "noon.coordinates_valid");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails noon.weather_fields_sanity for impossible wind", () => {
    const results = runAllRules(noonInput({
      extractionFields: { ...noonInput().extractionFields, windSpeedKnots: 300 },
    }));
    const rule = results.find((r) => r.ruleId === "noon.weather_fields_sanity");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("Logbook rule group", () => {
  function logbookInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
    return {
      extractionConfidence: 0.95,
      extractionFields: {
        imoNumber: "9876543",
        vesselName: "Test Vessel",
        entryDate: "2026-06-15",
        entryType: "deck",
        positionLatitude: 41.5,
        positionLongitude: -71.3,
        engineHours: 12,
      },
      extractionSummary: "Log entry",
      extractionWarnings: [],
      extractionMissingFields: [],
      documentType: "logbook",
      ocrConfidence: 0.92,
      ...overrides,
    };
  }

  it("passes all Logbook rules for valid input", () => {
    const results = runAllRules(logbookInput());
    const logRules = results.filter((r) => r.ruleId.startsWith("logbook."));
    const failed = logRules.filter((r) => !r.passed);
    expect(failed.length).toBe(0);
  });

  it("fails logbook.required_fields when fields missing", () => {
    const results = runAllRules(logbookInput({
      extractionFields: { imoNumber: "9876543" },
    }));
    const rule = results.find((r) => r.ruleId === "logbook.required_fields");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
    expect(rule!.severity).toBe("blocking");
  });

  it("fails logbook.position_continuity for invalid lat", () => {
    const results = runAllRules(logbookInput({
      extractionFields: { ...logbookInput().extractionFields, positionLatitude: 200 },
    }));
    const rule = results.find((r) => r.ruleId === "logbook.position_continuity");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails logbook.engine_hours for excessive hours", () => {
    const results = runAllRules(logbookInput({
      extractionFields: { ...logbookInput().extractionFields, engineHours: 999 },
    }));
    const rule = results.find((r) => r.ruleId === "logbook.engine_hours");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("fails logbook.entry_type_valid when missing", () => {
    const results = runAllRules(logbookInput({
      extractionFields: { ...logbookInput().extractionFields, entryType: "" },
    }));
    const rule = results.find((r) => r.ruleId === "logbook.entry_type_valid");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("Cross-field validation rules", () => {
  it("passes cross.fuel_consumed_vs_onboard for valid data", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        fuelConsumptionTonnes: 30,
        fuelRobsTonnes: 70,
      },
    }));
    const rule = results.find((r) => r.ruleId === "cross.fuel_consumed_vs_onboard");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails cross.arrival_after_departure when arrival <= departure", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        departureDate: "2026-06-20",
        arrivalDate: "2026-06-15",
      },
    }));
    const rule = results.find((r) => r.ruleId === "cross.arrival_after_departure");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });

  it("passes cross.distance_vs_speed for reasonable distance", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        distanceToGoNm: 500,
        speedKnots: 20,
      },
    }));
    const rule = results.find((r) => r.ruleId === "cross.distance_vs_speed");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(true);
  });

  it("fails cross.coordinates_legal_range for latitude > 90", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        ...makeInput().extractionFields,
        positionLatitude: 100,
        positionLongitude: 0,
      },
    }));
    const rule = results.find((r) => r.ruleId === "cross.coordinates_legal_range");
    expect(rule).toBeTruthy();
    expect(rule!.passed).toBe(false);
  });
});

describe("Severity level aggregation", () => {
  it("includes blocking severity rules", () => {
    const results = runAllRules(makeInput({
      extractionFields: { imoNumber: "9876543" },
    }));
    const blocking = results.filter((r) => r.severity === "blocking");
    expect(blocking.length).toBeGreaterThan(0);
  });

  it("includes error severity rules", () => {
    const results = runAllRules(makeInput({
      extractionFields: {
        imoNumber: "123",
        vesselName: "Test",
      },
    }));
    const errors = results.filter((r) => r.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("includes warning severity rules", () => {
    const results = runAllRules(makeInput({
      extractionFields: { vesselName: "T" },
    }));
    const warnings = results.filter((r) => r.severity === "warning" && !r.passed);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("Document type filtering", () => {
  it("returns only general rules for unknown document type", () => {
    const results = runAllRules(makeInput({ documentType: "other" }));
    const dcsRules = results.filter((r) => r.ruleId.startsWith("dcs."));
    const mrvRules = results.filter((r) => r.ruleId.startsWith("mrv."));
    const bdnRules = results.filter((r) => r.ruleId.startsWith("bdn."));
    expect(dcsRules.length).toBe(0);
    expect(mrvRules.length).toBe(0);
    expect(bdnRules.length).toBe(0);
  });

  it("returns only general and MRV rules for eu_mrv", () => {
    const results = runAllRules(makeInput({ documentType: "eu_mrv" }));
    const mrvRules = results.filter((r) => r.ruleId.startsWith("mrv."));
    expect(mrvRules.length).toBeGreaterThan(0);
    const dcsRules = results.filter((r) => r.ruleId.startsWith("dcs."));
    expect(dcsRules.length).toBe(0);
  });
});

run();
