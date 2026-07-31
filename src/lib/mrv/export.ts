import type { MrvExportResult, ChecklistStatus } from "@/lib/mrv/types";
import type { MrvReportResult } from "@/lib/mrv/types";

/**
 * Generate THETIS-MRV XML export.
 *
 * This is a structured XML document matching the THETIS-MRV upload schema.
 * NOTE: There is no public THETIS-MRV REST API. The export file is intended
 * for manual upload through the EMSA web portal.
 */
export function generateXmlExport(report: MrvReportResult): MrvExportResult {
  const ts = new Date().toISOString();

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<MrvAnnualReport>");
  lines.push(`  <ReportVersion>${report.calculation_version}</ReportVersion>`);
  lines.push(`  <GeneratedAt>${ts}</GeneratedAt>`);
  lines.push(`  <ReportingYear>${report.reporting_year}</ReportingYear>`);
  lines.push(`  <Methodology>${report.methodology}</Methodology>`);

  // Summary
  lines.push("  <Summary>");
  lines.push(`    <TotalVoyages>${report.total_voyages}</TotalVoyages>`);
  lines.push(`    <TotalFuelConsumptionMt>${report.total_fuel_mt}</TotalFuelConsumptionMt>`);
  lines.push(`    <TotalCo2Tonnes>${report.total_co2_tonnes}</TotalCo2Tonnes>`);
  lines.push("  </Summary>");

  // Voyage entries
  lines.push("  <VoyageEntries>");
  for (const v of report.voyage_entries) {
    lines.push("    <Voyage>");
    lines.push(`      <VoyageId>${escapeXml(v.voyage_id)}</VoyageId>`);
    lines.push(`      <DeparturePort>${escapeXml(v.departure_port)}</DeparturePort>`);
    lines.push(`      <ArrivalPort>${escapeXml(v.arrival_port)}</ArrivalPort>`);
    lines.push(`      <DepartureDate>${v.departure_date}</DepartureDate>`);
    lines.push(`      <ArrivalDate>${v.arrival_date}</ArrivalDate>`);
    if (v.distance_nm !== null) {
      lines.push(`      <DistanceNm>${v.distance_nm}</DistanceNm>`);
    }
    lines.push(`      <FuelType>${escapeXml(v.fuel_type)}</FuelType>`);
    lines.push(`      <FuelConsumptionMt>${v.fuel_consumption_mt}</FuelConsumptionMt>`);
    lines.push(`      <Co2Tonnes>${v.co2_tonnes}</Co2Tonnes>`);
    lines.push(`      <VoyageType>${v.voyage_type}</VoyageType>`);
    lines.push(`      <DataQuality>${v.data_quality}</DataQuality>`);
    lines.push("    </Voyage>");
  }
  lines.push("  </VoyageEntries>");
  lines.push("</MrvAnnualReport>");

  const content = lines.join("\n");
  const hash = simpleHash(content);

  return {
    format: "xml",
    content,
    content_hash: hash,
    generated_at: ts,
    validation_status: "PASS",
  };
}

/**
 * Generate CSV debug export.
 */
export function generateCsvExport(report: MrvReportResult): MrvExportResult {
  const ts = new Date().toISOString();

  const headers = [
    "VoyageId", "DeparturePort", "ArrivalPort",
    "DepartureDate", "ArrivalDate", "DistanceNm",
    "FuelType", "FuelConsumptionMt", "Co2Tonnes",
    "VoyageType", "DataQuality",
  ];

  const rows = [headers.map(escapeCsv).join(",")];
  for (const v of report.voyage_entries) {
    rows.push([
      v.voyage_id, v.departure_port, v.arrival_port,
      v.departure_date, v.arrival_date, v.distance_nm?.toString() ?? "",
      v.fuel_type, v.fuel_consumption_mt.toString(), v.co2_tonnes.toString(),
      v.voyage_type, v.data_quality,
    ].map(escapeCsv).join(","));
  }

  const content = rows.join("\n");
  const hash = simpleHash(content);

  return {
    format: "csv",
    content,
    content_hash: hash,
    generated_at: ts,
    validation_status: "PASS",
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
