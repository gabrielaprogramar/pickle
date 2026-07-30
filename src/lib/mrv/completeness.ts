import type { MrvCompletenessCheck, MrvCompletenessStatus } from "@/lib/mrv/types";

export interface MrvDatasetInfo {
  readonly hasVoyages: boolean;
  readonly hasFuelDeliveries: boolean;
  readonly hasAisData: boolean;
  readonly hasBdnCoverage: boolean;
  readonly hasUnmatchedBdns: boolean;
  readonly vesselName: string | null;
  readonly vesselImo: string | null;
  readonly monitoringPlanVersion: string | null;
  readonly methodology: string;
  readonly hasUnresolvedValidationErrors: boolean;
  readonly deliveryCount: number;
  readonly voyageCount: number;
}

export interface MrvCompletenessResult {
  readonly status: MrvCompletenessStatus;
  readonly checks: ReadonlyArray<MrvCompletenessCheck>;
  readonly blocking_issues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Run deterministic completeness check on MRV dataset.
 * Returns BLOCKED when blocking issues exist (report cannot be generated).
 */
export function runMrvCompletenessCheck(data: MrvDatasetInfo): MrvCompletenessResult {
  const checks: MrvCompletenessCheck[] = [];
  const blocking: string[] = [];
  const warnings: string[] = [];

  // 1. Voyages present
  checks.push({
    check_name: "voyages_present",
    passed: data.hasVoyages,
    severity: data.hasVoyages ? "warning" : "error",
    message: data.hasVoyages
      ? `${data.voyageCount} voyage(s) found`
      : "No voyages found for reporting year",
  });
  if (!data.hasVoyages) blocking.push("No voyages found for reporting year");

  // 2. Fuel deliveries present
  checks.push({
    check_name: "fuel_deliveries_present",
    passed: data.hasFuelDeliveries,
    severity: "error",
    message: data.hasFuelDeliveries
      ? `${data.deliveryCount} fuel delivery(ies) found`
      : "No fuel deliveries found for reporting year",
  });
  if (!data.hasFuelDeliveries) blocking.push("No fuel deliveries found");

  // 3. BDN coverage
  checks.push({
    check_name: "bdn_coverage",
    passed: data.hasBdnCoverage,
    severity: "warning",
    message: data.hasBdnCoverage
      ? "BDN coverage adequate"
      : "Insufficient BDN coverage — some deliveries lack BDN references",
  });
  if (!data.hasBdnCoverage) warnings.push("Insufficient BDN coverage");

  // 4. Unmatched BDNs
  checks.push({
    check_name: "unmatched_bdns",
    passed: !data.hasUnmatchedBdns,
    severity: "error",
    message: data.hasUnmatchedBdns
      ? "Unmatched BDNs exist — reconciliation incomplete"
      : "All BDNs matched to voyages",
  });
  if (data.hasUnmatchedBdns) blocking.push("Unmatched BDNs — reconciliation incomplete");

  // 5. AIS data
  checks.push({
    check_name: "ais_data_available",
    passed: data.hasAisData,
    severity: "warning",
    message: data.hasAisData
      ? "AIS data available"
      : "AIS data gaps detected — voyage distance/route may be incomplete",
  });
  if (!data.hasAisData) warnings.push("AIS data gaps detected");

  // 6. Vessel metadata
  checks.push({
    check_name: "vessel_metadata_complete",
    passed: !!(data.vesselName && data.vesselImo),
    severity: "error",
    message: data.vesselName && data.vesselImo
      ? `Vessel metadata complete (${data.vesselName}, IMO ${data.vesselImo})`
      : "Vessel metadata incomplete — name or IMO missing",
  });
  if (!data.vesselName || !data.vesselImo) blocking.push("Vessel metadata incomplete");

  // 7. Validation errors
  checks.push({
    check_name: "no_unresolved_validation_errors",
    passed: !data.hasUnresolvedValidationErrors,
    severity: "error",
    message: data.hasUnresolvedValidationErrors
      ? "Unresolved validation errors exist"
      : "No unresolved validation errors",
  });
  if (data.hasUnresolvedValidationErrors) blocking.push("Unresolved validation errors");

  // 8. Monitoring plan
  checks.push({
    check_name: "monitoring_plan_available",
    passed: !!data.monitoringPlanVersion,
    severity: "warning",
    message: data.monitoringPlanVersion
      ? `Monitoring Plan version: ${data.monitoringPlanVersion}`
      : "Monitoring Plan version not recorded",
  });
  if (!data.monitoringPlanVersion) warnings.push("Monitoring Plan version missing");

  // 9. Methodology
  checks.push({
    check_name: "methodology_consistent",
    passed: data.methodology === "default" || data.methodology === "alternative",
    severity: "error",
    message: data.methodology === "default" || data.methodology === "alternative"
      ? `Methodology: ${data.methodology}`
      : "Methodology not set or inconsistent",
  });
  if (data.methodology !== "default" && data.methodology !== "alternative") {
    blocking.push("Methodology not set or inconsistent");
  }

  let status: MrvCompletenessStatus = "VALID";
  if (blocking.length > 0) status = "BLOCKED";
  else if (warnings.length > 0) status = "WARNING";

  return { status, checks, blocking_issues: blocking, warnings };
}
