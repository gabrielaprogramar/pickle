/**
 * parser.test.ts — noon report extraction normalisation tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Covers parseNoonReportExtraction (field normalisation, numeric validation,
 * warnings + missing fields, confidence clamping) and noonReportFromRow
 * (snake_case row → camelCase domain mapping).
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/parser.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  parseNoonReportExtraction,
  noonReportFromRow,
  NOON_REQUIRED_FIELDS,
  toFiniteNumber,
  toTrimmedString,
} from "../parser";
import type { NoonReportExtractionInput } from "../types";

function extraction(
  fields: Record<string, unknown>,
  overrides: Partial<NoonReportExtractionInput> = {},
): NoonReportExtractionInput {
  return {
    extractionFields: fields,
    confidence: 0.94,
    warnings: [],
    missingFields: [],
    documentId: null,
    ...overrides,
  };
}

function fullFields(overrides: Record<string, unknown> = {}) {
  return {
    imoNumber: "9488754",
    vesselName: "POSEIDON PIONEER",
    reportDate: "2026-08-01T12:00:00.000Z",
    positionLatitude: 10.5,
    positionLongitude: 106.8,
    speedKnots: 14.2,
    courseDegrees: 295,
    distanceToGoNm: 1100,
    fuelConsumptionTonnes: 32.4,
    fuelRobsTonnes: 860,
    engineRpm: 82,
    seaState: "MODERATE",
    windSpeedKnots: 18,
    windDirection: "NE",
    summary: "All systems normal.",
    ...overrides,
  };
}

describe("toFiniteNumber", () => {
  it("passes finite numbers through", () => {
    expect(toFiniteNumber(14.2)).toBe(14.2);
  });

  it("parses numeric strings", () => {
    expect(toFiniteNumber("14.2")).toBe(14.2);
  });

  it("returns null for non-numeric strings", () => {
    expect(toFiniteNumber("n/a")).toBeNull();
  });

  it("returns null for non-finite numbers", () => {
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
  });
});

describe("toTrimmedString", () => {
  it("trims whitespace", () => {
    expect(toTrimmedString("  MODERATE  ")).toBe("MODERATE");
  });

  it("returns null for empty strings", () => {
    expect(toTrimmedString("   ")).toBeNull();
  });

  it("returns null for non-string values", () => {
    expect(toTrimmedString(42)).toBeNull();
  });
});

describe("NOON_REQUIRED_FIELDS", () => {
  it("requires the five identity/position fields", () => {
    expect(NOON_REQUIRED_FIELDS).toEqual([
      "imoNumber",
      "vesselName",
      "reportDate",
      "positionLatitude",
      "positionLongitude",
    ]);
  });
});

describe("parseNoonReportExtraction", () => {
  it("maps a complete extraction into the domain shape", () => {
    const parsed = parseNoonReportExtraction(extraction(fullFields()));

    expect(parsed.report.imo).toBe("9488754");
    expect(parsed.report.vesselName).toBe("POSEIDON PIONEER");
    expect(parsed.report.reportDate).toBe("2026-08-01T12:00:00.000Z");
    expect(parsed.report.positionLatitude).toBe(10.5);
    expect(parsed.report.positionLongitude).toBe(106.8);
    expect(parsed.report.speedKnots).toBe(14.2);
    expect(parsed.report.fuelConsumptionTonnes).toBe(32.4);
    expect(parsed.report.engineRpm).toBe(82);
    expect(parsed.report.confidence).toBe(0.94);
    expect(parsed.report.source).toBe("ai_extraction");
    expect(parsed.report.warnings.length).toBe(0);
    expect(parsed.missingFields.length).toBe(0);
  });

  it("parses string numerics into numbers", () => {
    const fields = fullFields({
      positionLatitude: "10.5",
      speedKnots: "14.2",
      fuelConsumptionTonnes: "32.4",
    });
    const parsed = parseNoonReportExtraction(extraction(fields));
    expect(parsed.report.positionLatitude).toBe(10.5);
    expect(parsed.report.speedKnots).toBe(14.2);
    expect(parsed.report.fuelConsumptionTonnes).toBe(32.4);
  });

  it("nulls non-finite numerics and records a warning", () => {
    const fields = fullFields({ speedKnots: "garbled" });
    const parsed = parseNoonReportExtraction(extraction(fields));

    expect(parsed.report.speedKnots).toBeNull();
    expect(parsed.warnings.some((w) => w.includes("speedKnots"))).toBe(true);
  });

  it("flags missing required fields without duplicating", () => {
    const fields = fullFields({ imoNumber: "", reportDate: null, positionLatitude: undefined, positionLongitude: "", vesselName: undefined });
    const parsed = parseNoonReportExtraction(extraction(fields, { missingFields: ["reportDate"] }));

    expect(parsed.missingFields.includes("imoNumber")).toBe(true);
    expect(parsed.missingFields.includes("reportDate")).toBe(true);
    expect(parsed.missingFields.includes("positionLatitude")).toBe(true);
    expect(parsed.missingFields.includes("positionLongitude")).toBe(true);
    expect(parsed.missingFields.includes("vesselName")).toBe(true);
  });

  it("adds a missing-IMO warning", () => {
    const parsed = parseNoonReportExtraction(extraction(fullFields({ imoNumber: "" })));
    expect(parsed.warnings.some((w) => w.includes("IMO number is missing"))).toBe(true);
  });

  it("adds a missing-report-date warning", () => {
    const parsed = parseNoonReportExtraction(extraction(fullFields({ reportDate: "" })));
    expect(parsed.warnings.some((w) => w.includes("report date is missing"))).toBe(true);
  });

  it("preserves upstream warnings", () => {
    const parsed = parseNoonReportExtraction(
      extraction(fullFields(), { warnings: ["upstream: OCR blurred"] }),
    );
    expect(parsed.warnings.includes("upstream: OCR blurred")).toBe(true);
    expect(parsed.report.warnings.includes("upstream: OCR blurred")).toBe(true);
  });

  it("clamps confidence into [0,1]", () => {
    const high = parseNoonReportExtraction(extraction(fullFields(), { confidence: 1.7 }));
    const low = parseNoonReportExtraction(extraction(fullFields(), { confidence: -0.3 }));
    const nan = parseNoonReportExtraction(extraction(fullFields(), { confidence: Number.NaN }));

    expect(high.report.confidence).toBe(1);
    expect(low.report.confidence).toBe(0);
    expect(nan.report.confidence).toBe(0);
    expect(nan.dataConfidence).toBe(0);
  });

  it("preserves the raw fields for provenance", () => {
    const fields = fullFields();
    const parsed = parseNoonReportExtraction(extraction(fields, { documentId: "doc-noon-1" }));
    expect(parsed.rawFields).toEqual(fields);
    expect(parsed.report.sourceDocumentId).toBe("doc-noon-1");
  });

  it("nulls out optional string fields when missing", () => {
    const parsed = parseNoonReportExtraction(
      extraction(fullFields({ seaState: null, windDirection: "", summary: "  " })),
    );
    expect(parsed.report.seaState).toBeNull();
    expect(parsed.report.windDirection).toBeNull();
    expect(parsed.report.summary).toBeNull();
  });

  it("nulls optional numeric fields when missing", () => {
    const parsed = parseNoonReportExtraction(
      extraction(fullFields({ windSpeedKnots: null, courseDegrees: undefined })),
    );
    expect(parsed.report.windSpeedKnots).toBeNull();
    expect(parsed.report.courseDegrees).toBeNull();
  });
});

describe("noonReportFromRow", () => {
  it("maps a persisted snake_case row into the domain", () => {
    const row = {
      id: "noon-001",
      vessel_id: "vsl-poseidon",
      imo: "9488754",
      vessel_name: "POSEIDON PIONEER",
      report_date: "2026-08-01T12:00:00.000Z",
      position_latitude: 10.5,
      position_longitude: 106.8,
      speed_knots: 14.2,
      course_degrees: 295,
      distance_to_go_nm: 1100,
      fuel_consumption_tonnes: 32.4,
      fuel_robs_tonnes: 860,
      engine_rpm: 82,
      sea_state: "MODERATE",
      wind_speed_knots: 18,
      wind_direction: "NE",
      summary: "All systems normal.",
      warnings: ["noon.parser: speed rejected"],
      confidence: 0.94,
      source: "ai_extraction",
      source_document_id: "doc-1",
      review_state: null,
      is_blocked: false,
    };

    const domain = noonReportFromRow(row);
    expect(domain.id).toBe("noon-001");
    expect(domain.vesselId).toBe("vsl-poseidon");
    expect(domain.imo).toBe("9488754");
    expect(domain.reportDate).toBe("2026-08-01T12:00:00.000Z");
    expect(domain.fuelConsumptionTonnes).toBe(32.4);
    expect(domain.sourceDocumentId).toBe("doc-1");
    expect(domain.warnings).toEqual(["noon.parser: speed rejected"]);
    expect(domain.isBlocked).toBe(false);
  });

  it("defaults warnings to an empty array", () => {
    const row = {
      id: "noon-1",
      vessel_id: "vsl-1",
      imo: "9488754",
      vessel_name: null,
      report_date: "2026-08-01T12:00:00.000Z",
      position_latitude: null,
      position_longitude: null,
      speed_knots: null,
      course_degrees: null,
      distance_to_go_nm: null,
      fuel_consumption_tonnes: null,
      fuel_robs_tonnes: null,
      engine_rpm: null,
      sea_state: null,
      wind_speed_knots: null,
      wind_direction: null,
      summary: null,
      warnings: undefined as unknown as readonly string[],
      confidence: 0.9,
      source: "ai_extraction",
      source_document_id: null,
      review_state: null,
      is_blocked: false,
    };
    const domain = noonReportFromRow(row);
    expect(domain.warnings).toEqual([]);
    expect(domain.positionLatitude).toBeNull();
  });
});

run();
