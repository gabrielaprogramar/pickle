/**
 * noon-report/parser.ts — normalise a raw extraction into NoonReportDomain
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The AI extraction pipeline returns free-form fields (NOON_REPORT_SCHEMA).
 * The parser converts them into the strict NoonReportDomain shape:
 *
 *   - every numeric value is validated (finite) or set to `null` — never guessed
 *   - the raw values are preserved in `rawFields` for provenance
 *   - missing/invalid values surface as warnings + missingFields entries
 *
 * The parser is pure and synchronous — it does not read from any store.
 */

import type {
  NoonReportDomain,
  NoonReportExtractionInput,
  NoonReportParsed,
} from "./types";

/** Required extraction fields for a usable noon report (per NOON_REPORT_SCHEMA). */
export const NOON_REQUIRED_FIELDS = [
  "imoNumber",
  "vesselName",
  "reportDate",
  "positionLatitude",
  "positionLongitude",
] as const;

const NUMERIC_FIELDS = [
  "positionLatitude",
  "positionLongitude",
  "speedKnots",
  "courseDegrees",
  "distanceToGoNm",
  "fuelConsumptionTonnes",
  "fuelRobsTonnes",
  "engineRpm",
  "windSpeedKnots",
] as const;

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function parseNoonReportExtraction(
  input: NoonReportExtractionInput,
): NoonReportParsed {
  const fields = input.extractionFields ?? {};
  const warnings: string[] = [...(input.warnings ?? [])];
  const missing: string[] = [...(input.missingFields ?? [])];

  const imoNumber = toTrimmedString(fields["imoNumber"]) ?? "";
  const vesselName = toTrimmedString(fields["vesselName"]);
  const reportDate = toTrimmedString(fields["reportDate"]) ?? "";

  for (const key of NOON_REQUIRED_FIELDS) {
    const value = fields[key];
    const present =
      value !== undefined &&
      value !== null &&
      !(typeof value === "string" && value.trim() === "");
    if (!present && !missing.includes(key)) {
      missing.push(key);
    }
  }

  const numeric = new Map<string, number | null>();
  for (const key of NUMERIC_FIELDS) {
    const value = toFiniteNumber(fields[key]);
    numeric.set(key, value);
    if (value === null && fields[key] !== undefined && fields[key] !== null) {
      warnings.push(`noon.parser: "${key}" is not a finite number — value rejected`);
    }
  }

  if (imoNumber === "") {
    warnings.push("noon.parser: IMO number is missing");
  }
  if (reportDate === "") {
    warnings.push("noon.parser: report date is missing");
  }

  const report: NoonReportDomain = {
    id: null,
    vesselId: null,
    imo: imoNumber,
    vesselName,
    reportDate,
    positionLatitude: numeric.get("positionLatitude") ?? null,
    positionLongitude: numeric.get("positionLongitude") ?? null,
    speedKnots: numeric.get("speedKnots") ?? null,
    courseDegrees: numeric.get("courseDegrees") ?? null,
    distanceToGoNm: numeric.get("distanceToGoNm") ?? null,
    fuelConsumptionTonnes: numeric.get("fuelConsumptionTonnes") ?? null,
    fuelRobsTonnes: numeric.get("fuelRobsTonnes") ?? null,
    engineRpm: numeric.get("engineRpm") ?? null,
    seaState: toTrimmedString(fields["seaState"]),
    windSpeedKnots: numeric.get("windSpeedKnots") ?? null,
    windDirection: toTrimmedString(fields["windDirection"]),
    summary: toTrimmedString(fields["summary"]),
    warnings: [...warnings],
    confidence: clampConfidence(input.confidence),
    source: input.source ?? "ai_extraction",
    sourceDocumentId: input.documentId ?? null,
    reviewState: toTrimmedString(fields["reviewState"]),
    isBlocked: false,
  };

  return {
    report,
    missingFields: missing,
    warnings,
    dataConfidence: clampConfidence(input.confidence),
    rawFields: fields,
  };
}

/** Convert a persisted supabase row into the domain shape. */
export function noonReportFromRow(
  row: {
    readonly id: string;
    readonly vessel_id: string;
    readonly imo: string;
    readonly vessel_name: string | null;
    readonly report_date: string;
    readonly position_latitude: number | null;
    readonly position_longitude: number | null;
    readonly speed_knots: number | null;
    readonly course_degrees: number | null;
    readonly distance_to_go_nm: number | null;
    readonly fuel_consumption_tonnes: number | null;
    readonly fuel_robs_tonnes: number | null;
    readonly engine_rpm: number | null;
    readonly sea_state: string | null;
    readonly wind_speed_knots: number | null;
    readonly wind_direction: string | null;
    readonly summary: string | null;
    readonly warnings: ReadonlyArray<string>;
    readonly confidence: number;
    readonly source: string;
    readonly source_document_id: string | null;
    readonly review_state: string | null;
    readonly is_blocked: boolean;
  },
): NoonReportDomain {
  return {
    id: row.id,
    vesselId: row.vessel_id,
    imo: row.imo,
    vesselName: row.vessel_name,
    reportDate: row.report_date,
    positionLatitude: row.position_latitude,
    positionLongitude: row.position_longitude,
    speedKnots: row.speed_knots,
    courseDegrees: row.course_degrees,
    distanceToGoNm: row.distance_to_go_nm,
    fuelConsumptionTonnes: row.fuel_consumption_tonnes,
    fuelRobsTonnes: row.fuel_robs_tonnes,
    engineRpm: row.engine_rpm,
    seaState: row.sea_state,
    windSpeedKnots: row.wind_speed_knots,
    windDirection: row.wind_direction,
    summary: row.summary,
    warnings: row.warnings ?? [],
    confidence: row.confidence,
    source: row.source,
    sourceDocumentId: row.source_document_id,
    reviewState: row.review_state,
    isBlocked: row.is_blocked,
  };
}
