/**
 * validator.test.ts — noon report validation → findings tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Exercises validateNoonReport: shared RuleRegistry integration (noon.*,
 * maritime.*, confidence.* rules), data-quality findings, heavy-weather
 * findings, engine-deviation findings, and the score / status / blocked /
 * readyForReview derivation. Never uses an LLM.
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/validator.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { analyzeNoonReport } from "../engine";
import { validateNoonReport } from "../validator";
import type { NoonReportAnalysis, NoonReportDomain } from "../types";
import {
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockEngineReference,
  mockVoyagePlan,
  MOCK_VESSEL_ID,
  MOCK_IMO,
  MOCK_VESSEL_NAME,
} from "../mock-data";

const NOW = "2026-08-01T13:00:00.000Z";

function evaluate(report: NoonReportDomain): {
  analysis: NoonReportAnalysis;
  validator: ReturnType<typeof validateNoonReport>;
} {
  const analysis = analyzeNoonReport({
    report,
    vessel: { vesselId: MOCK_VESSEL_ID, imo: MOCK_IMO, name: MOCK_VESSEL_NAME },
    previous: mockPreviousNoonReport(),
    engineReference: mockEngineReference(),
    voyagePlan: mockVoyagePlan(),
    now: NOW,
  });
  return { analysis, validator: validateNoonReport({ report, analysis }) };
}

function findingIds(validator: ReturnType<typeof validateNoonReport>): string[] {
  return validator.findings.map((f) => f.id);
}

describe("validateNoonReport — clean at sea", () => {
  const { validator } = evaluate(mockNoonReportDomain());

  it("reports the shared port rule as the only warning", () => {
    expect(findingIds(validator)).toContain("maritime.port_not_empty");
    expect(validator.findings.length).toBe(1);
    const port = validator.findings[0]!;
    expect(port.severity).toBe("WARNING");
    expect(port.category).toBe("data_quality");
  });

  it("derives score 95, WARNING, not blocked, ready for review", () => {
    expect(validator.score).toBe(95);
    expect(validator.status).toBe("WARNING");
    expect(validator.blocked).toBe(false);
    expect(validator.readyForReview).toBe(true);
  });
});

describe("validateNoonReport — scenario findings", () => {
  it("flags significant weather as a warning and drops the score", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({ windSpeedKnots: 34, seaState: "ROUGH" }),
    );
    expect(findingIds(validator)).toContain("noon.weather.significant");
    const w = validator.findings.find((f) => f.id === "noon.weather.significant");
    expect(w!.severity).toBe("WARNING");
    expect(w!.category).toBe("weather");
    expect(w!.field).toBe("windSpeedKnots");
    expect(validator.score).toBe(90);
  });

  it("maps engine deviations into ERROR findings for high consumption", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({ fuelConsumptionTonnes: 46.2, speedKnots: 15.8, engineRpm: 90 }),
    );
    expect(findingIds(validator)).toContain("noon.deviation.consumption");
    expect(findingIds(validator)).toContain("noon.deviation.rpm");
    expect(findingIds(validator)).toContain("noon.deviation.slip");

    const consumption = validator.findings.find((f) => f.id === "noon.deviation.consumption");
    expect(consumption!.severity).toBe("ERROR");
    expect(consumption!.category).toBe("fuel");
    expect(validator.status).toBe("FAILED");
    expect(validator.readyForReview).toBe(false);
  });

  it("maps a speed deviation into a voyage-category ERROR", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({ distanceToGoNm: 1240, speedKnots: 11, engineRpm: 74 }),
    );
    expect(findingIds(validator)).toContain("noon.deviation.speed");
    const speed = validator.findings.find((f) => f.id === "noon.deviation.speed");
    expect(speed!.severity).toBe("ERROR");
    expect(speed!.category).toBe("voyage");
  });

  it("maps a ROB deviation into a fuel-category ERROR", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({ distanceToGoNm: 50000, fuelRobsTonnes: 300 }),
    );
    expect(findingIds(validator)).toContain("noon.deviation.rob");
    const rob = validator.findings.find((f) => f.id === "noon.deviation.rob");
    expect(rob!.severity).toBe("ERROR");
    expect(rob!.category).toBe("fuel");
    expect(rob!.remediation).toContainString("bunkering");
  });
});

describe("validateNoonReport — data quality", () => {
  it("flags low confidence and parser warnings", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({
        confidence: 0.42,
        summary: null,
        seaState: null,
        windSpeedKnots: null,
        warnings: ["noon.parser: seaState missing — value rejected"],
      }),
    );
    expect(findingIds(validator)).toContain("noon.data_quality.low_confidence");
    expect(findingIds(validator)).toContain("noon.data_quality.warning");
    expect(findingIds(validator)).toContain("confidence.ai_high");
    expect(findingIds(validator)).toContain("confidence.summary_not_empty");
    expect(findingIds(validator)).toContain("confidence.no_extraction_warnings");

    const low = validator.findings.find((f) => f.id === "noon.data_quality.low_confidence");
    expect(low!.severity).toBe("WARNING");
    expect(low!.reason).toContainString("0.42");

    expect(validator.readyForReview).toBe(false);
  });

  it("flags duplicated field values", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({ speedKnots: 0, engineRpm: 0, distanceToGoNm: 0 }),
    );
    expect(findingIds(validator)).toContain("confidence.duplicate_fields");
  });
});

describe("validateNoonReport — structural / range rules", () => {
  it("blocks a report missing required fields", () => {
    const { validator } = evaluate(mockNoonReportDomain({ imo: "", positionLatitude: null, positionLongitude: null }));
    expect(findingIds(validator)).toContain("noon.required_fields");
    const required = validator.findings.find((f) => f.id === "noon.required_fields");
    expect(required!.severity).toBe("BLOCKING");
    expect(validator.blocked).toBe(true);
    expect(validator.status).toBe("FAILED");
    expect(validator.readyForReview).toBe(false);
    expect(validator.score).toBe(30);
  });

  it("flags out-of-range coordinates as an error", () => {
    const { validator } = evaluate(mockNoonReportDomain({ positionLatitude: 91 }));
    expect(findingIds(validator)).toContain("noon.coordinates_valid");
    const coord = validator.findings.find((f) => f.id === "noon.coordinates_valid");
    expect(coord!.severity).toBe("ERROR");
  });

  it("flags out-of-range RPM", () => {
    const { validator } = evaluate(mockNoonReportDomain({ engineRpm: 600 }));
    expect(findingIds(validator)).toContain("noon.rpm_range");
  });

  it("flags an implausible wind speed", () => {
    const { validator } = evaluate(mockNoonReportDomain({ windSpeedKnots: 250 }));
    expect(findingIds(validator)).toContain("noon.weather_fields_sanity");
  });
});

describe("validateNoonReport — score derivation", () => {
  it("clamps the score into [0,100]", () => {
    const { validator } = evaluate(
      mockNoonReportDomain({
        confidence: 0.42,
        summary: null,
        windSpeedKnots: null,
        warnings: ["noon.parser: wind missing"],
        engineRpm: 600,
      }),
    );
    expect(validator.score).toBeGreaterThan(0);
    expect(validator.score).toBeLessThanOrEqual(100);
  });

  it("marks a blocked report not ready for review", () => {
    const { validator } = evaluate(mockNoonReportDomain({ imo: "" }));
    expect(validator.blocked).toBe(true);
    expect(validator.readyForReview).toBe(false);
  });
});

run();
