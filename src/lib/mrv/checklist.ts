import type { MrvChecklistResult, MrvChecklistItem, MrvCompletenessCheck } from "@/lib/mrv/types";

export interface MrvPreSubmissionInput {
  readonly completeness_checks: ReadonlyArray<MrvCompletenessCheck>;
  readonly hasExportContent: boolean;
  readonly reportingYear: number;
  readonly vesselName: string | null;
  readonly vesselImo: string | null;
  readonly voyageCount: number;
  readonly deliveryCount: number;
  readonly monitoringPlanVersion: string | null;
  readonly methodology: string;
  readonly calculationVersion: string;
}

export function runPreSubmissionChecklist(input: MrvPreSubmissionInput): MrvChecklistResult {
  const items: MrvChecklistItem[] = [];
  const blocking: string[] = [];
  const warnings: string[] = [];

  // 1. Required fields populated
  const reqFields = [
    { name: "vessel_name", value: input.vesselName, label: "Vessel name" },
    { name: "vessel_imo", value: input.vesselImo, label: "IMO number" },
    { name: "reporting_year", value: input.reportingYear, label: "Reporting year" },
  ];
  for (const f of reqFields) {
    const passed = !!f.value;
    items.push({
      name: `field_${f.name}`,
      passed,
      message: passed ? `${f.label}: present` : `${f.label}: missing`,
    });
    if (!passed) blocking.push(`${f.label} is missing`);
  }

  // 2. Completeness checks
  for (const c of input.completeness_checks) {
    items.push({
      name: `completeness_${c.check_name}`,
      passed: c.passed,
      message: c.message,
    });
    if (!c.passed && c.severity === "error") blocking.push(c.message);
    if (!c.passed && c.severity === "warning") warnings.push(c.message);
  }

  // 3. Methodology consistent
  const methodOk = input.methodology === "default" || input.methodology === "alternative";
  items.push({
    name: "methodology_consistent",
    passed: methodOk,
    message: methodOk
      ? `Methodology: ${input.methodology}`
      : `Methodology inconsistent: ${input.methodology}`,
  });
  if (!methodOk) blocking.push("Methodology is not set consistently");

  // 4. Reporting year correct
  const yearOk = input.reportingYear >= 2024;
  items.push({
    name: "reporting_year_valid",
    passed: yearOk,
    message: yearOk
      ? `Reporting year: ${input.reportingYear}`
      : `Reporting year ${input.reportingYear} is before 2024`,
  });
  if (!yearOk) blocking.push("Reporting year is before EU ETS start (2024)");

  // 5. Voyage coverage
  const voyageOk = input.voyageCount > 0;
  items.push({
    name: "voyage_coverage_complete",
    passed: voyageOk,
    message: voyageOk
      ? `${input.voyageCount} voyage(s) covered`
      : "No voyages covered in report",
  });
  if (!voyageOk) blocking.push("No voyages in report");

  // 6. BDN reconciliation
  const deliveryOk = input.deliveryCount > 0;
  items.push({
    name: "bdn_reconciliation_resolved",
    passed: deliveryOk,
    message: deliveryOk
      ? `${input.deliveryCount} fuel delivery(ies) reconciled`
      : "No fuel deliveries reconciled",
  });
  if (!deliveryOk) blocking.push("No reconciled fuel deliveries");

  // 7. Monitoring plan
  items.push({
    name: "monitoring_plan_version_present",
    passed: !!input.monitoringPlanVersion,
    message: input.monitoringPlanVersion
      ? `Monitoring Plan version: ${input.monitoringPlanVersion}`
      : "Monitoring Plan version not recorded",
  });
  if (!input.monitoringPlanVersion) warnings.push("Monitoring Plan version missing");

  // 8. Calculation version
  items.push({
    name: "calculation_version_recorded",
    passed: !!input.calculationVersion,
    message: input.calculationVersion
      ? `Calculation version: ${input.calculationVersion}`
      : "Calculation version not recorded",
  });
  if (!input.calculationVersion) blocking.push("Calculation version not recorded");

  // 9. Export content
  items.push({
    name: "export_content_generated",
    passed: input.hasExportContent,
    message: input.hasExportContent
      ? "Export content generated"
      : "Export content not yet generated",
  });
  if (!input.hasExportContent) blocking.push("Export content not generated — run export first");

  const status = blocking.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "PASS";

  return {
    status,
    items,
    blocking_items: blocking,
    warning_items: warnings,
  };
}
