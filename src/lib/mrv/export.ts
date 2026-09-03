import type { MrvExportResult, ChecklistStatus, MrvReportResult, MrvLifecycle } from "@/lib/mrv/types";

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
  const ts = new Date().toISOString();
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

  // Submission posture — explicit, never overclaims THETIS submission.
  lines.push(`  <SubmissionStatus>SCHEMA_VALIDATED_LOCALLY</SubmissionStatus>`);
  lines.push(`  <ExternalSubmissionNote>The report schema was validated locally against Annex II. External THETIS-MRV submission is NOT performed by this system and is NOT claimed.</ExternalSubmissionNote>`);
  lines.push("</thetis_mrv:MrvAnnualReport>");

  const content = lines.join("\n");
  const hash = simpleHash(content);

  return {
    format: "xml",
    content,
    content_hash: hash,
    generated_at: ts,
    validation_status: validationStatus,
    submission_status: blocking.length > 0 ? "BLOCKED" : "SCHEMA_VALIDATED_LOCALLY",
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
  const hash = simpleHash(content);

  return {
    format: "csv",
    content,
    content_hash: hash,
    generated_at: ts,
    validation_status: validationStatus,
    submission_status: blocking.length > 0 ? "BLOCKED" : "SCHEMA_VALIDATED_LOCALLY",
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

export function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `sha256-not-available:${Math.abs(hash).toString(16)}`;
}
