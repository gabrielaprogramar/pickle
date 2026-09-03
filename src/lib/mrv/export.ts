import type { MrvExportResult, ChecklistStatus, MrvReportResult, MrvLifecycle } from "@/lib/mrv/types";
import { createHash } from "node:crypto";

/**
 * PART 4.6 — real SHA-256 content hash using Node's crypto (NOT the legacy
 * 31-bit rolling hash, which was mislabelled "sha256-not-available").
 */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Backwards-compatible alias so existing callers/tests keep working while the
 * underlying implementation is now a real SHA-256 (plain hex).
 */
export const simpleHash = sha256Hex;

/**
 * THETIS-MRV Annex II Part D field mapping (Implementing Reg. (EU) 2023/2449).
 *
 * This export is a deterministic serialisation of the annual emissions report
 * matching the Annex II structure used by THETIS-MRV:
 *   Part C — voyage list (per-voyage fuel consumption + CO2 from the canonical
 *            `voyage_consumption` model);
 *   Part D — annual aggregates: fuel consumption + emission factor per fuel
 *            type, total fuel, CO2/CH4/N2O disaggregated in tCO2e, total
 *            distance (nm), total time at sea (hours).
 *
 * IMPORTANT — submission posture
 * This system performs LOCAL, DETERMINISTIC schema validation ONLY. It does NOT
 * submit to THETIS (there is no public THETIS-MRV REST API; submission happens
 * through the EMSA web portal). The export therefore reports
 * `submission_status: 'SCHEMA_VALIDATED_LOCALLY'` and NEVER claims a successful
 * THETIS direct submission. Export is BLOCKED when any blocking evidence is
 * unresolved (see `blockingExportIssues`).
 */

export interface ThEtisFieldMapping {
  readonly voyage_part: ReadonlyArray<{
    readonly annex_field: string;
    readonly report_source: string;
  }>;
  readonly annual_part: ReadonlyArray<{
    readonly annex_field: string;
    readonly report_source: string;
  }>;
}

export const THETIS_FIELD_MAPPING: ThEtisFieldMapping = {
  voyage_part: [
    { annex_field: "Arrival/Departure port", report_source: "voyage_entries[].departure_port / arrival_port" },
    { annex_field: "Date/time of arrival/departure", report_source: "voyage_entries[].arrival_date / departure_date" },
    { annex_field: "Distance travelled (nm)", report_source: "voyage_entries[].distance_nm (AUDITED only)" },
    { annex_field: "Fuel consumption (mt) per fuel type", report_source: "voyage_consumption (canonical)" },
    { annex_field: "CO2 emitted (t)", report_source: "voyage_entries[].co2_tonnes" },
  ],
  annual_part: [
    { annex_field: "Fuel consumption + emission factor per fuel type", report_source: "fuel_stocktakes[]" },
    { annex_field: "Total fuel consumption", report_source: "total_fuel_mt" },
    { annex_field: "CO2 disaggregated", report_source: "fuel_stocktakes[].co2_tonnes" },
    { annex_field: "CH4 disaggregated (tCO2e)", report_source: "version.ch4_co2e_tonnes" },
    { annex_field: "N2O disaggregated (tCO2e)", report_source: "version.n2o_co2e_tonnes" },
    { annex_field: "Total CO2e", report_source: "total_co2e_tonnes" },
    { annex_field: "Total distance travelled (nm)", report_source: "total_distance_nm" },
    { annex_field: "Total time at sea (hours)", report_source: "total_time_at_sea_hours" },
  ],
};

/**
 * Deterministic blocking gate evaluated BEFORE export. If any blocking evidence
 * is unresolved, export is refused (BLOCKED) — we never emit an export that
 * would misreport a DATA_INCOMPLETE / REQUIRES_REVIEW report.
 */
export function blockingExportIssues(
  report: MrvReportResult,
): ReadonlyArray<string> {
  const issues: string[] = [];

  const unexportableLifecycles: ReadonlyArray<MrvLifecycle> = [
    "DATA_INCOMPLETE",
    "REQUIRES_REVIEW",
  ];
  if (unexportableLifecycles.includes(report.lifecycle)) {
    issues.push(`Report lifecycle ${report.lifecycle} is not exportable (blocking evidence unresolved).`);
  }
  if (report.completeness_status === "BLOCKED") {
    issues.push("Completeness is BLOCKED.");
  }
  if (report.total_distance_nm === null) {
    issues.push("Total distance is DATA_INCOMPLETE — no value fabricated.");
  }
  if (report.total_time_at_sea_hours === null) {
    issues.push("Total time at sea is DATA_INCOMPLETE — no value fabricated.");
  }
  if (report.voyage_entries.length === 0) {
    issues.push("No voyage entries to export.");
  }
  return issues;
}

export function generateXmlExport(report: MrvReportResult): MrvExportResult {
  // Deterministic per snapshot: derive the artifact timestamp from the report's
  // persisted `generated_at` (fall back to now only for the legacy inline case)
  // so that re-exporting the SAME persisted snapshot is byte-identical (the
  // audit requires repeat export of identical content => identical hash).
  const ts = report.generated_at ?? new Date().toISOString();
  const blocking = blockingExportIssues(report);
  const validationStatus: ChecklistStatus = blocking.length > 0 ? "BLOCKED" : "PASS";

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<thetis_mrv:MrvAnnualReport xmlns:thetis_mrv=\"https://emsa.europa.eu/thetis-mrv\">");
  lines.push(`  <CalculationVersion>${escapeXml(report.calculation_version)}</CalculationVersion>`);
  lines.push(`  <GeneratedAt>${ts}</GeneratedAt>`);
  lines.push(`  <ReportingYear>${report.reporting_year}</ReportingYear>`);
  lines.push(`  <PeriodStart>${escapeXml(report.monitored_period_start ?? "")}</PeriodStart>`);
  lines.push(`  <PeriodEnd>${escapeXml(report.monitored_period_end ?? "")}</PeriodEnd>`);
  lines.push(`  <MonitoringPlanVersion>${escapeXml(report.monitoring_plan_version ?? "")}</MonitoringPlanVersion>`);
  lines.push(`  <Methodology>${escapeXml(report.methodology)}</Methodology>`);

  // Part D — annual aggregates (fuel consumption + emission factor per type).
  lines.push("  <PartD_AnnualAggregates>");
  lines.push(`    <TotalVoyages>${report.total_voyages}</TotalVoyages>`);
  lines.push(`    <TotalFuelConsumptionMt>${report.total_fuel_mt}</TotalFuelConsumptionMt>`);
  lines.push(`    <TotalCo2Tonnes>${report.total_co2_tonnes}</TotalCo2Tonnes>`);
  lines.push(`    <TotalCo2eTonnes>${report.total_co2e_tonnes ?? report.total_co2_tonnes}</TotalCo2eTonnes>`);
  lines.push(`    <TotalDistanceNm>${report.total_distance_nm ?? ""}</TotalDistanceNm>`);
  lines.push(`    <TotalTimeAtSeaHours>${report.total_time_at_sea_hours ?? ""}</TotalTimeAtSeaHours>`);
  lines.push("    <FuelStocktakes>");
  for (const s of report.fuel_stocktakes) {
    lines.push("      <FuelStocktake>");
    lines.push(`        <FuelType>${escapeXml(s.fuel_type)}</FuelType>`);
    lines.push(`        <QuantityMt>${s.quantity_mt}</QuantityMt>`);
    lines.push(`        <Co2Factor>${s.co2_factor}</Co2Factor>`);
    lines.push(`        <Co2Tonnes>${s.co2_tonnes}</Co2Tonnes>`);
    lines.push(`        <EmissionFactorSource>${escapeXml(s.source)}</EmissionFactorSource>`);
    lines.push("      </FuelStocktake>");
  }
  lines.push("    </FuelStocktakes>");
  if (report.version) {
    lines.push(`    <Ch4TonnesCo2e>${report.version.ch4_co2e_tonnes}</Ch4TonnesCo2e>`);
    lines.push(`    <N2oTonnesCo2e>${report.version.n2o_co2e_tonnes}</N2oTonnesCo2e>`);
  }
  lines.push("  </PartD_AnnualAggregates>");

  // Part C — per-voyage list.
  lines.push("  <PartC_VoyageList>");
  for (const v of report.voyage_entries) {
    lines.push("    <Voyage>");
    lines.push(`      <VoyageId>${escapeXml(v.voyage_id)}</VoyageId>`);
    lines.push(`      <ArrivalPort>${escapeXml(v.arrival_port)}</ArrivalPort>`);
    lines.push(`      <DeparturePort>${escapeXml(v.departure_port)}</DeparturePort>`);
    lines.push(`      <ArrivalDate>${escapeXml(v.arrival_date)}</ArrivalDate>`);
    lines.push(`      <DepartureDate>${escapeXml(v.departure_date)}</DepartureDate>`);
    lines.push(`      <DistanceNm>${v.distance_nm ?? ""}</DistanceNm>`);
    lines.push(`      <DataType>${escapeXml(v.voyage_type)}</DataType>`);
    if (v.distance_quality) lines.push(`      <DistanceQuality>${escapeXml(v.distance_quality)}</DistanceQuality>`);
    if (v.time_quality) lines.push(`      <TimeQuality>${escapeXml(v.time_quality)}</TimeQuality>`);
    lines.push("      <FuelDataPerVoyage>");
    // Single fuel per voyage row in the canonical model; distance/time remain
    // auditable and per-voyage.
    lines.push(`        <FuelType>${escapeXml(v.fuel_type)}</FuelType>`);
    lines.push(`        <FuelConsumptionMt>${v.fuel_consumption_mt}</FuelConsumptionMt>`);
    lines.push(`        <Co2Tonnes>${v.co2_tonnes}</Co2Tonnes>`);
    lines.push(`        <ConsumptionMethod>${escapeXml(v.consumption_method)}</ConsumptionMethod>`);
    lines.push(`        <DataQuality>${escapeXml(v.data_quality)}</DataQuality>`);
    lines.push("      </FuelDataPerVoyage>");
    lines.push("    </Voyage>");
  }
  lines.push("  </PartC_VoyageList>");

  if (blocking.length > 0) {
    lines.push("  <BlockingIssues>");
    for (const b of blocking) lines.push(`    <Issue>${escapeXml(b)}</Issue>`);
    lines.push("  </BlockingIssues>");
  }

  // Explicit field mapping reference so the export is traceable to Annex II.
  lines.push("  <FieldMappingReference>");
  lines.push("    <Annex>II</Annex>");
  lines.push("    <ImplementingRegulation>(EU) 2023/2449</ImplementingRegulation>");
  lines.push("    <VoyageFields>" + escapeXml(THETIS_FIELD_MAPPING.voyage_part.map((f) => f.annex_field).join("; ")) + "</VoyageFields>");
  lines.push("    <AnnualFields>" + escapeXml(THETIS_FIELD_MAPPING.annual_part.map((f) => f.annex_field).join("; ")) + "</AnnualFields>");
  lines.push("  </FieldMappingReference>");

  // Submission posture — explicit, based on whether any blocking issue remains.
  lines.push(`  <SubmissionStatus>${blocking.length > 0 ? "SUBMISSION_BLOCKED" : "SCHEMA_VALIDATED_LOCALLY"}</SubmissionStatus>`);
  lines.push(`  <ExternalSubmissionNote>The report ${blocking.length > 0 ? "has unresolved blocking evidence, so this export is a diagnostic artifact and MUST NOT be submitted." : "was serialised and validated locally against Annex II (IR (EU) 2023/2449); external THETIS-MRV submission is NOT performed by this system and is NOT claimed."}</ExternalSubmissionNote>`);
  lines.push(`  <ContentHashAlgorithm>sha256</ContentHashAlgorithm>`);
  lines.push("</thetis_mrv:MrvAnnualReport>");

  const content = lines.join("\n");
  const hash = sha256Hex(content);

  return {
    format: "xml",
    content,
    content_hash: hash,
    content_hash_algorithm: "sha256",
    generated_at: ts,
    validation_status: validationStatus,
    submission_status: blocking.length > 0 ? "SUBMISSION_BLOCKED" : "SCHEMA_VALIDATED_LOCALLY",
    external_submission_note:
      "The report was serialised against the Annex II field set (IR (EU) 2023/2449) " +
      (blocking.length > 0
        ? "but blocks any external submission because unresolved evidence remains — this file is a diagnostic artifact only."
        : "and validated locally against that field set. No external THETIS-MRV submission is performed or claimed by this system."),
  };
}

/**
 * Generate CSV (debug / local review) export.
 */
export function generateCsvExport(report: MrvReportResult): MrvExportResult {
  const ts = new Date().toISOString();
  const blocking = blockingExportIssues(report);
  const validationStatus: ChecklistStatus = blocking.length > 0 ? "BLOCKED" : "PASS";

  const headers = [
    "VoyageId", "ArrivalPort", "DeparturePort",
    "ArrivalDate", "DepartureDate", "DistanceNm",
    "FuelType", "FuelConsumptionMt", "Co2Tonnes",
    "ConsumptionMethod", "DataQuality", "DistanceQuality", "TimeQuality",
  ];

  const rows = [headers.map(escapeCsv).join(",")];
  for (const v of report.voyage_entries) {
    rows.push([
      v.voyage_id, v.arrival_port, v.departure_port,
      v.arrival_date, v.departure_date, v.distance_nm?.toString() ?? "",
      v.fuel_type, v.fuel_consumption_mt.toString(), v.co2_tonnes.toString(),
      v.consumption_method, v.data_quality, v.distance_quality ?? "", v.time_quality ?? "",
    ].map(escapeCsv).join(","));
  }

  const content = rows.join("\n");
  const hash = sha256Hex(content);

  return {
    format: "csv",
    content,
    content_hash: hash,
    content_hash_algorithm: "sha256",
    generated_at: ts,
    validation_status: validationStatus,
    submission_status: blocking.length > 0 ? "SUBMISSION_BLOCKED" : "SCHEMA_VALIDATED_LOCALLY",
    external_submission_note:
      "CSV is a local review artifact. External submission is not performed or claimed.",
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
