import { describe, it, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { runMrvCompletenessCheck } from "@/lib/mrv/completeness";
import type { MrvDatasetInfo } from "@/lib/mrv/completeness";
import { runPreSubmissionChecklist } from "@/lib/mrv/checklist";
import type { MrvPreSubmissionInput } from "@/lib/mrv/checklist";
import { generateXmlExport, generateCsvExport, simpleHash, blockingExportIssues } from "@/lib/mrv/export";
import { buildVerifierPackage } from "@/lib/mrv/verifier-package";
import { MrvReportService } from "@/lib/mrv/service";
import type { MrvReportResult, MrvReportInsert, MrvReportRow, MrvVoyageEntry, MrvReportVersion } from "@/lib/mrv/types";
import { resolveActiveMonitoringPlan, nextMonitoringPlanVersion } from "@/lib/mrv/monitoring-plan";
import type { MrvMonitoringPlan } from "@/lib/mrv/types";
import { refineMrvApplicability } from "@/lib/mrv/applicability";
import { canTransition } from "@/lib/mrv/lifecycle";
import { aggregateAnnualMrv } from "@/lib/mrv/aggregation";
import { generateAnnualMrvReport, type MrvPipelineInput } from "@/lib/mrv/pipeline";
import type { ApplicabilityDecision } from "@/lib/regulatory/applicability";

function makeApplicability(applicability: ApplicabilityDecision["applicability"] = "APPLICABLE"): ApplicabilityDecision {
  return {
    applicability,
    is_decision_final: true,
    rule_version: 1,
    rule_effective_from: "2024-01-01",
    rule_effective_until: null,
    basis: { facts_used: { gt: 12000 }, missing_facts: [], conflicts: [] },
    notes: "EU MRV scope applies",
  };
}

function makePlan(overrides: Partial<MrvMonitoringPlan> = {}): MrvMonitoringPlan {
  return {
    id: "plan-1",
    vessel_id: "v1",
    version: 1,
    status: "APPROVED",
    methodology: "default",
    monitoring_method: "A",
    effective_from: "2024-01-01",
    effective_until: null,
    emission_factors_snapshot: {},
    activity_data_procedures: {},
    data_gap_methods: {},
    source_reference: "Annex I template",
    approved_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDataset(overrides: Partial<MrvDatasetInfo> = {}): MrvDatasetInfo {
  return {
    hasVoyages: true,
    hasFuelDeliveries: true,
    hasAisData: true,
    hasBdnCoverage: true,
    hasUnmatchedBdns: false,
    vesselName: "TestVessel",
    vesselImo: "9074729",
    monitoringPlanVersion: "approved",
    methodology: "default",
    hasUnresolvedValidationErrors: false,
    deliveryCount: 3,
    voyageCount: 1,
    ...overrides,
  };
}

function makePipelineInput(overrides: Partial<MrvPipelineInput> = {}): MrvPipelineInput {
  const voyages = [{
    id: "v1",
    departure_port: "Rotterdam",
    arrival_port: "Hamburg",
    departure_time: "2026-01-01T00:00:00.000Z",
    arrival_time: "2026-01-05T00:00:00.000Z",
    distance_nm: 350,
    scope_type: "INTRA_EU",
  }];
  const consumption = [{
    voyage_id: "v1",
    fuel_type: "hfo_380",
    quantity_mt: 100,
    method: "BDN_METHOD_A",
    status: "VERIFIED",
    source_type: "BDN",
    source_record_ids: ["bdn-1", "bdn-2"],
  }];
  const consumptionByVoyage = new Map<string, ReadonlyArray<{ fuel_type: string; quantity_mt: number; method: string; status: string }>>();
  consumptionByVoyage.set("v1", consumption.map((c) => ({ fuel_type: c.fuel_type, quantity_mt: c.quantity_mt, method: c.method, status: c.status })));

  return {
    vessel_id: "v1",
    reporting_year: 2026,
    dataset: makeDataset({ monitoringPlanResolved: true }),
    applicability: makeApplicability(),
    monitoringPlanResolution: { status: "RESOLVED", plan: makePlan() },
    consumption,
    consumptionByVoyage,
    voyages,
    methodology: "default",
    ets_record_id: null,
    ...overrides,
  };
}

// ── Completeness ───────────────────────────────────────────────────────────

describe("MRV completeness", () => {
  it("returns VALID for complete dataset", () => {
    const result = runMrvCompletenessCheck(makeDataset());
    if (result.status !== "VALID") throw new Error(`Expected VALID, got ${result.status}`);
    if (result.blocking_issues.length !== 0) throw new Error("Expected no blocking issues");
  });

  it("returns BLOCKED when no voyages", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasVoyages: false, voyageCount: 0 }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when no fuel deliveries", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasFuelDeliveries: false, deliveryCount: 0 }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when unmatched BDNs exist", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasUnmatchedBdns: true }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when vessel metadata missing", () => {
    const result = runMrvCompletenessCheck(makeDataset({ vesselName: null, vesselImo: null }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when unresolved validation errors exist", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasUnresolvedValidationErrors: true }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when distance is DATA_INCOMPLETE", () => {
    const result = runMrvCompletenessCheck(makeDataset({
      aggregationChecks: [{
        check_name: "distance_audited",
        passed: false,
        severity: "error",
        message: "1 voyage(s) missing auditable distance",
      }],
    }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns WARNING when AIS data missing", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasAisData: false }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });

  it("returns WARNING when monitoring plan version string missing", () => {
    const result = runMrvCompletenessCheck(makeDataset({ monitoringPlanVersion: null }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });
});

// ── Monitoring Plan resolution ─────────────────────────────────────────────

describe("MRV monitoring plan resolution", () => {
  it("resolves a single approved effective plan", () => {
    const plan = makePlan();
    const r = resolveActiveMonitoringPlan([plan], "2025-06-01");
    if (r.status !== "RESOLVED") throw new Error(`Expected RESOLVED, got ${r.status}`);
  });

  it("returns NOT_FOUND when no approved plan exists", () => {
    const plan = makePlan({ status: "DRAFT" });
    const r = resolveActiveMonitoringPlan([plan], "2025-06-01");
    if (r.status !== "NOT_FOUND") throw new Error(`Expected NOT_FOUND, got ${r.status}`);
  });

  it("returns REQUIRES_REVIEW on ambiguous overlap", () => {
    const p1 = makePlan({ id: "p1", version: 1, status: "APPROVED", effective_from: "2024-01-01", effective_until: null });
    const p2 = makePlan({ id: "p2", version: 2, status: "APPROVED", effective_from: "2025-01-01", effective_until: null });
    const r = resolveActiveMonitoringPlan([p1, p2], "2025-06-01");
    if (r.status !== "REQUIRES_REVIEW") throw new Error(`Expected REQUIRES_REVIEW, got ${r.status}`);
    if (!r.candidates || r.candidates.length !== 2) throw new Error("Expected 2 candidates");
  });

  it("resolves when a superseded marker breaks the tie", () => {
    const p1 = makePlan({ id: "p1", version: 1, status: "SUPERSEDED", effective_from: "2024-01-01", effective_until: null });
    const p2 = makePlan({ id: "p2", version: 2, status: "APPROVED", effective_from: "2025-01-01", effective_until: null });
    const r = resolveActiveMonitoringPlan([p1, p2], "2025-06-01");
    if (r.status !== "RESOLVED") throw new Error(`Expected RESOLVED, got ${r.status}`);
  });

  it("returns NOT_FOUND when approved but not yet effective (gapped)", () => {
    const plan = makePlan({ effective_from: "2026-01-01" });
    const r = resolveActiveMonitoringPlan([plan], "2025-06-01");
    if (r.status !== "NOT_FOUND") throw new Error(`Expected NOT_FOUND, got ${r.status}`);
  });

  it("computes next version deterministically", () => {
    const plans = [{ version: 1 }, { version: 3 }];
    if (nextMonitoringPlanVersion(plans) !== 4) throw new Error("Expected 4");
    if (nextMonitoringPlanVersion([]) !== 1) throw new Error("Expected 1");
  });
});

// ── Applicability refinement ───────────────────────────────────────────────

describe("MRV applicability refinement", () => {
  it("keeps APPLICABLE when EU-scoped voyages exist", () => {
    const r = refineMrvApplicability(makeApplicability("APPLICABLE"), [
      { id: "v1", scope_type: "INTRA_EU" },
    ]);
    if (r.applicability !== "APPLICABLE") throw new Error(`Expected APPLICABLE, got ${r.applicability}`);
  });

  it("returns NOT_APPLICABLE when all voyages are NON_EU", () => {
    const r = refineMrvApplicability(makeApplicability("APPLICABLE"), [
      { id: "v1", scope_type: "NON_EU" },
      { id: "v2", scope_type: "NON_EU" },
    ]);
    if (r.applicability !== "NOT_APPLICABLE") throw new Error(`Expected NOT_APPLICABLE, got ${r.applicability}`);
  });

  it("returns REQUIRES_REVIEW when no voyage activity recorded", () => {
    const r = refineMrvApplicability(makeApplicability("APPLICABLE"), []);
    if (r.applicability !== "REQUIRES_REVIEW") throw new Error(`Expected REQUIRES_REVIEW, got ${r.applicability}`);
  });

  it("does not override a non-APPLICABLE base decision", () => {
    const r = refineMrvApplicability(makeApplicability("NOT_APPLICABLE"), [
      { id: "v1", scope_type: "NON_EU" },
    ]);
    if (r.applicability !== "NOT_APPLICABLE") throw new Error(`Expected NOT_APPLICABLE, got ${r.applicability}`);
  });
});

// ── Lifecycle state machine ────────────────────────────────────────────────

describe("MRV lifecycle state machine", () => {
  it("permits DRAFT -> VALIDATED", () => {
    const t = canTransition("DRAFT", "VALIDATED");
    if (!t.ok) throw new Error("Expected allowed transition");
  });

  it("blocks DATA_INCOMPLETE -> VERIFIED", () => {
    const t = canTransition("DATA_INCOMPLETE", "VERIFIED");
    if (t.ok) throw new Error("Expected DATA_INCOMPLETE -> VERIFIED to be forbidden");
  });

  it("blocks DATA_INCOMPLETE -> EXPORTED", () => {
    const t = canTransition("DATA_INCOMPLETE", "EXPORTED");
    if (t.ok) throw new Error("Expected DATA_INCOMPLETE -> EXPORTED to be forbidden");
  });

  it("blocks REQUIRES_REVIEW -> EXPORTED", () => {
    const t = canTransition("REQUIRES_REVIEW", "EXPORTED");
    if (t.ok) throw new Error("Expected REQUIRES_REVIEW -> EXPORTED to be forbidden");
  });

  it("ensures VERIFIED requires prior scheme validation", () => {
    const t = canTransition("SCHEMA_VALIDATED_LOCALLY", "VERIFIED");
    if (!t.ok) throw new Error("Expected SCHEMA_VALIDATED_LOCALLY -> VERIFIED allowed");
    const back = canTransition("VERIFIED", "SCHEMA_VALIDATED_LOCALLY");
    if (!back.ok) throw new Error("Expected VERIFIED -> SCHEMA_VALIDATED_LOCALLY allowed");
  });
});

// ── Aggregation (no equal-share, auditable metrics) ────────────────────────

describe("MRV aggregation", () => {
  it("sums canonical consumption WITHOUT equal-share", () => {
    const consumptionByVoyage = new Map<string, ReadonlyArray<{ fuel_type: string; quantity_mt: number; method: string; status: string }>>();
    consumptionByVoyage.set("v1", [{ fuel_type: "hfo_380", quantity_mt: 100, method: "BDN_METHOD_A", status: "VERIFIED" }]);
    consumptionByVoyage.set("v2", [{ fuel_type: "hfo_380", quantity_mt: 0, method: "INSUFFICIENT_DATA", status: "INSUFFICIENT_DATA" }]);
    const result = aggregateAnnualMrv({
      consumption: [
        { voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100, method: "BDN_METHOD_A", status: "VERIFIED", source_type: "BDN", source_record_ids: ["bdn-1"] },
        { voyage_id: "v2", fuel_type: "hfo_380", quantity_mt: 0, method: "INSUFFICIENT_DATA", status: "INSUFFICIENT_DATA", source_type: "BDN", source_record_ids: [] },
      ],
      voyages: [
        { id: "v1", departure_port: "A", arrival_port: "B", departure_time: "2026-01-01T00:00:00.000Z", arrival_time: "2026-01-02T00:00:00.000Z", distance_nm: 100 },
        { id: "v2", departure_port: "B", arrival_port: "A", departure_time: "2026-01-03T00:00:00.000Z", arrival_time: "2026-01-04T00:00:00.000Z", distance_nm: 100 },
      ],
      consumptionByVoyage,
    });
    // v1 holds all 100 mt; v2 (INSUFFICIENT_DATA) contributes 0 — NOT split 50/50.
    if (result.total_fuel_mt !== 100) throw new Error(`Expected 100 total fuel (no equal-share), got ${result.total_fuel_mt}`);
    if (result.unresolved_consumption_count !== 1) throw new Error("Expected 1 unresolved consumption row");
  });

  it("surface DATA_INCOMPLETE distance rather than fabricate", () => {
    const result = aggregateAnnualMrv({
      consumption: [],
      voyages: [{ id: "v1", departure_port: "A", arrival_port: "B", departure_time: "2026-01-01T00:00:00.000Z", arrival_time: "2026-01-02T00:00:00.000Z", distance_nm: null }],
    });
    if (result.total_distance_nm !== null) throw new Error("Expected null distance, not a fabricated value");
    if (result.missing_distance_voyages.length !== 1) throw new Error("Expected missing distance flagged");
    if (result.distance_checks[0]?.passed !== false) throw new Error("Expected distance check to fail");
  });

  it("detects cross-year voyages", () => {
    const result = aggregateAnnualMrv({
      consumption: [],
      voyages: [{ id: "vX", departure_port: "A", arrival_port: "B", departure_time: "2026-12-31T00:00:00.000Z", arrival_time: "2027-01-02T00:00:00.000Z", distance_nm: 100 }],
    });
    if (result.cross_year_voyages.length !== 1) throw new Error("Expected cross-year voyage detected");
  });
});

// ── Pipeline (lifecycle + version) ─────────────────────────────────────────

describe("MRV pipeline", () => {
  it("produces VALIDATED lifecycle for clean data", () => {
    const out = generateAnnualMrvReport(makePipelineInput());
    if (out.result.lifecycle !== "VALIDATED") throw new Error(`Expected VALIDATED, got ${out.result.lifecycle}`);
    if (out.result.total_fuel_mt !== 100) throw new Error(`Expected 100 total fuel, got ${out.result.total_fuel_mt}`);
    if (out.result.total_co2_tonnes !== 311.4) throw new Error(`Expected 311.4 CO2, got ${out.result.total_co2_tonnes}`);
    if (out.version.total_distance_nm !== 350) throw new Error("Expected distance in version");
  });

  it("marks REQUIRES_REVIEW when the active plan is unresolved", () => {
    const input = makePipelineInput({ monitoringPlanResolution: { status: "NOT_FOUND", reason: "no approved plan" } });
    const out = generateAnnualMrvReport(input);
    if (out.result.lifecycle !== "REQUIRES_REVIEW") throw new Error(`Expected REQUIRES_REVIEW, got ${out.result.lifecycle}`);
  });

  it("marks DATA_INCOMPLETE when completeness is blocked", () => {
    const input = makePipelineInput({ dataset: makeDataset({ vesselName: null, vesselImo: null }) });
    const out = generateAnnualMrvReport(input);
    if (out.result.lifecycle !== "DATA_INCOMPLETE") throw new Error(`Expected DATA_INCOMPLETE, got ${out.result.lifecycle}`);
    if (out.result.status !== "blocked") throw new Error("Expected status blocked");
  });

  it("reflects the reporting year boundaries in the version", () => {
    const out = generateAnnualMrvReport(makePipelineInput());
    if (out.version.period_start !== "2026-01-01") throw new Error("Expected period_start 2026-01-01");
    if (out.version.period_end !== "2026-12-31") throw new Error("Expected period_end 2026-12-31");
  });
});

// ── MRV ↔ EU ETS and MRV ↔ FuelEU consistency (shared truth) ──────────────

describe("MRV cross-regulation consistency", () => {
  it("MRV CO2 equals CO2 computed from the SAME canonical consumption (EU ETS parity)", () => {
    const out = generateAnnualMrvReport(makePipelineInput());
    const expectCo2 = 100 * 3.114; // hfo_380 shared factor
    if (out.result.total_co2_tonnes !== expectCo2) {
      throw new Error(`Expected MRV CO2 ${expectCo2} to equal shared-factor result, got ${out.result.total_co2_tonnes}`);
    }
  });

  it("MRV total fuel equals FuelEU total fuel from the same consumption", () => {
    const input = makePipelineInput();
    const fuelFromMrv = generateAnnualMrvReport(input).result.total_fuel_mt;
    const fuelDirect = input.consumption.reduce((s, c) => s + c.quantity_mt, 0);
    if (fuelFromMrv !== fuelDirect) throw new Error("MRV total fuel diverges from shared consumption sum");
  });
});

// ── Export (THETIS mapping + local-only posture + blocking gate) ───────────

describe("MRV export", () => {
  function makeDummyReport(overrides: Partial<MrvReportResult> = {}): MrvReportResult {
    const version: MrvReportVersion = {
      version_number: 1,
      submission_status: "DRAFT",
      period_start: "2026-01-01",
      period_end: "2026-12-31",
      total_fuel_mt: 100,
      fuel_by_type: { hfo_380: 100 },
      co2_tonnes: 311.4,
      ch4_co2e_tonnes: 0,
      n2o_co2e_tonnes: 0,
      total_co2e_tonnes: 311.4,
      total_distance_nm: 350,
      total_time_at_sea_hours: 96,
      source_consumption_ids: ["bdn-1"],
      source_voyage_ids: ["v1"],
    };
    const base: MrvReportResult = {
      calculation_version: "2.0.0",
      parameter_version: "2025.1",
      vessel_id: "vessel-uuid-001",
      reporting_year: 2026,
      status: "validated",
      lifecycle: "VALIDATED",
      completeness_status: "VALID",
      completeness_checks: [],
      blocking_issues: [],
      warnings: [],
      total_voyages: 1,
      total_fuel_mt: 100,
      total_co2_tonnes: 311.4,
      total_co2e_tonnes: 311.4,
      total_distance_nm: 350,
      total_time_at_sea_hours: 96,
      fuel_stocktakes: [{ fuel_type: "hfo_380", quantity_mt: 100, co2_factor: 3.114, co2_tonnes: 311.4, source: "IMO GHG Study / IPCC 2006 Guidelines" }],
      monitored_period_start: "2026-01-01",
      monitored_period_end: "2026-12-31",
      monitoring_plan_version: "approved",
      monitoring_plan_ver: 1,
      methodology: "default",
      voyage_entries: [{
        voyage_id: "v1",
        departure_port: "Rotterdam",
        arrival_port: "Hamburg",
        departure_date: "2026-01-01T00:00:00.000Z",
        arrival_date: "2026-01-05T00:00:00.000Z",
        distance_nm: 350,
        time_at_sea_hours: 96,
        fuel_type: "hfo_380",
        fuel_consumption_mt: 100,
        co2_tonnes: 311.4,
        voyage_type: "INTRA_EU",
        distance_quality: "AUDITED",
        time_quality: "AUDITED",
        consumption_method: "BDN_METHOD_A",
        consumption_status: "VERIFIED",
        data_quality: "audited",
      }],
      delivery_ids: ["d1"],
      voyage_ids: ["v1"],
      version,
      report_data: {},
      generated_at: "2026-07-30T00:00:00.000Z",
    };
    return { ...base, ...overrides };
  }

  it("generates XML export with Annex II field mapping and local-only posture", () => {
    const result = generateXmlExport(makeDummyReport());
    if (result.format !== "xml") throw new Error("Expected xml");
    if (!result.content.includes("<PartD_AnnualAggregates>")) throw new Error("Expected Part D");
    if (!result.content.includes("<PartC_VoyageList>")) throw new Error("Expected Part C");
    if (!result.content.includes("(EU) 2023/2449")) throw new Error("Expected implementing regulation reference");
    if (result.submission_status !== "SCHEMA_VALIDATED_LOCALLY") throw new Error("Expected local-only posture, no THETIS claim");
    if (result.content.includes("SUBMITTED_TO_THETIS")) throw new Error("Must never claim THETIS submission");
  });

  it("blocks export when blocking evidence unresolved", () => {
    const blocked = generateXmlExport(makeDummyReport({ lifecycle: "REQUIRES_REVIEW" }));
    if (blocked.submission_status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${blocked.submission_status}`);
    if (blocked.validation_status !== "BLOCKED") throw new Error("Expected validation BLOCKED");
  });

  it("blocks export when distance is DATA_INCOMPLETE", () => {
    const issues = blockingExportIssues(makeDummyReport({ total_distance_nm: null }));
    if (issues.length === 0) throw new Error("Expected distance blocking issue");
  });

  it("generates CSV export", () => {
    const result = generateCsvExport(makeDummyReport());
    if (result.format !== "csv") throw new Error("Expected csv");
    if (!result.content.includes("VoyageId")) throw new Error("Expected CSV header");
    if (!result.content.includes("v1")) throw new Error("Expected voyage id in CSV");
  });

  it("XML escapes special characters", () => {
    const report = makeDummyReport();
    const original = report.voyage_entries[0];
    const modifiedReport: MrvReportResult = {
      ...report,
      voyage_entries: [{
        voyage_id: original!.voyage_id,
        departure_port: "Port & < > \" ' City",
        arrival_port: original!.arrival_port,
        departure_date: original!.departure_date,
        arrival_date: original!.arrival_date,
        distance_nm: original!.distance_nm,
        time_at_sea_hours: original!.time_at_sea_hours,
        fuel_type: original!.fuel_type,
        fuel_consumption_mt: original!.fuel_consumption_mt,
        co2_tonnes: original!.co2_tonnes,
        voyage_type: original!.voyage_type,
        distance_quality: original!.distance_quality,
        time_quality: original!.time_quality,
        consumption_method: original!.consumption_method,
        consumption_status: original!.consumption_status,
        data_quality: original!.data_quality,
      }],
    };
    const result = generateXmlExport(modifiedReport);
    if (!result.content.includes("&amp;")) throw new Error("Expected &amp;");
    if (!result.content.includes("&lt;")) throw new Error("Expected &lt;");
  });

  it("generates consistent hashes", () => {
    const report = makeDummyReport();
    const r1 = generateXmlExport(report);
    if (r1.content_hash !== simpleHash(r1.content)) throw new Error("Expected hash to match content");
  });
});

// ── Verifier package ───────────────────────────────────────────────────────

describe("verifier package", () => {
  it("builds package with reproducibility hash from stored records", () => {
    const pkg = buildVerifierPackage({
      reportId: "report-uuid-001",
      reportContent: "<xml>...</xml>",
      sourceBdnCount: 5,
      voyageExportCount: 10,
      discrepancyNotes: ["Note 1", "Note 2"],
      validationResultsRef: "val-ref-001",
      auditReferences: ["audit-ref-001", "audit-ref-002"],
      sourceRecordIds: ["consumption-1", "voyage-1", "bdn-1"],
      calculationVersion: "2.0.0",
    });
    if (pkg.report_id !== "report-uuid-001") throw new Error("Expected report id");
    if (!pkg.reproducibility_hash) throw new Error("Expected reproducibility hash");
    // Deterministic: same inputs -> same hash.
    const pkg2 = buildVerifierPackage({
      reportId: "report-uuid-001",
      reportContent: "<xml>...</xml>",
      sourceBdnCount: 5,
      voyageExportCount: 10,
      discrepancyNotes: ["Note 1", "Note 2"],
      validationResultsRef: "val-ref-001",
      auditReferences: ["audit-ref-001", "audit-ref-002"],
      sourceRecordIds: ["consumption-1", "voyage-1", "bdn-1"],
      calculationVersion: "2.0.0",
    });
    if (pkg2.reproducibility_hash !== pkg.reproducibility_hash) throw new Error("Expected reproducible hash");
  });

  it("handles empty arrays", () => {
    const pkg = buildVerifierPackage({
      reportId: "r1",
      reportContent: "",
      sourceBdnCount: 0,
      voyageExportCount: 0,
      discrepancyNotes: [],
      validationResultsRef: "",
      auditReferences: [],
    });
    if (pkg.discrepancy_notes.length !== 0) throw new Error("Expected empty notes");
    if (!pkg.reproducibility_hash) throw new Error("Expected a reproducibility hash");
  });
});

// ── Service ────────────────────────────────────────────────────────────────

describe("MrvReportService", () => {
  function makeRepo(options: { withVersionRepo?: boolean } = {}) {
    const store: MrvReportRow[] = [];
    const versions: Array<{ mrv_report_id: string; version_number: number }> = [];
    const repo = {
      async findByVesselAndYear(vesselId: string, year: number) {
        return store.find((r) => r.vessel_id === vesselId && r.reporting_year === year) ?? null;
      },
      async upsert(record: MrvReportInsert) {
        const existing = store.findIndex(
          (r) => r.vessel_id === record.vessel_id && r.reporting_year === record.reporting_year,
        );
        const ts = new Date().toISOString();
        const row: MrvReportRow = {
          id: existing >= 0 ? store[existing]!.id : crypto.randomUUID(),
          vessel_id: record.vessel_id,
          reporting_year: record.reporting_year,
          status: record.status ?? "draft",
          completeness_status: record.completeness_status,
          completeness_checks: record.completeness_checks ?? [],
          blocking_issues: record.blocking_issues ?? [],
          warnings: record.warnings ?? [],
          checklist_status: record.checklist_status ?? null,
          checklist_details: record.checklist_details ?? null,
          export_format: record.export_format ?? null,
          export_generated_at: record.export_generated_at ?? null,
          export_content_hash: record.export_content_hash ?? null,
          export_file_path: record.export_file_path ?? null,
          report_data: record.report_data,
          total_voyages: record.total_voyages,
          total_fuel_mt: record.total_fuel_mt,
          total_co2_tonnes: record.total_co2_tonnes,
          monitoring_plan_version: record.monitoring_plan_version ?? null,
          methodology: record.methodology ?? "default",
          calculation_version: record.calculation_version,
          parameter_version: record.parameter_version,
          ets_record_id: record.ets_record_id ?? null,
          lifecycle: record.lifecycle ?? null,
          period_start: record.period_start ?? null,
          period_end: record.period_end ?? null,
          monitoring_plan_ver: record.monitoring_plan_ver ?? null,
          total_distance_nm: record.total_distance_nm ?? null,
          total_time_at_sea_hours: record.total_time_at_sea_hours ?? null,
          generated_at: record.generated_at ?? ts,
          created_at: ts,
          updated_at: ts,
        };
        if (existing >= 0) {
          store[existing] = row;
        } else {
          store.push(row);
        }
        return row;
      },
      async listByVessel(vesselId: string) {
        return store.filter((r) => r.vessel_id === vesselId);
      },
      async delete(id: string) {
        const idx = store.findIndex((r) => r.id === id);
        if (idx >= 0) store.splice(idx, 1);
      },
    };
    const versionRepo = {
      async findLatest(reportId: string) {
        const match = versions.filter((v) => v.mrv_report_id === reportId).sort((a, b) => b.version_number - a.version_number);
        return match[0] ?? null;
      },
      async listByReport(reportId: string) {
        return versions.filter((v) => v.mrv_report_id === reportId);
      },
      async append(v: { mrv_report_id: string; version_number: number }) {
        versions.push(v as never);
        return v as never;
      },
    };
    return { repo, versionRepo, store, versions };
  }

  it("checks completeness on valid dataset", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const result = await service.checkCompleteness({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: makeDataset(),
    });
    if (result.status !== "VALID") throw new Error(`Expected VALID, got ${result.status}`);
  });

  it("generateReport returns blocked if completeness fails", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const result = await service.generateReport(makePipelineInput({
      dataset: {
        hasVoyages: false,
        hasFuelDeliveries: false,
        hasAisData: false,
        hasBdnCoverage: false,
        hasUnmatchedBdns: true,
        vesselName: null,
        vesselImo: null,
        monitoringPlanVersion: null,
        methodology: "default",
        hasUnresolvedValidationErrors: true,
        deliveryCount: 0,
        voyageCount: 0,
      },
      voyages: [],
      consumption: [],
    }));
    if (result.status !== "blocked") throw new Error(`Expected blocked, got ${result.status}`);
    if (result.completeness_status !== "BLOCKED") throw new Error("Expected BLOCKED");
  });

  it("generateReport persists lifecycle + distance/time", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const result = await service.generateReport(makePipelineInput());
    if (result.status !== "validated") throw new Error(`Expected validated, got ${result.status}`);
    if (result.lifecycle !== "VALIDATED") throw new Error("Expected VALIDATED lifecycle");
    if (result.total_fuel_mt !== 100) throw new Error(`Expected 100 fuel, got ${result.total_fuel_mt}`);
  });

  it("generateReport appends an immutable report version", async () => {
    const { repo, versionRepo, versions } = makeRepo();
    const service = new MrvReportService(repo as never, versionRepo as never);
    const result = await service.generateReport(makePipelineInput());
    if (versions.length !== 1) throw new Error("Expected 1 appended version");
    if (versions[0]?.version_number !== 1) throw new Error("Expected version_number 1");
    void result;
  });

  it("runChecklist returns result", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const report = await service.generateReport(makePipelineInput());
    const checklist = await service.runChecklist(report);
    if (checklist.items.length === 0) throw new Error("Expected at least 1 checklist item");
  });

  it("generateExport produces XML (validated locally)", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const report = await service.generateReport(makePipelineInput());
    const exportResult = await service.generateExport(report);
    if (exportResult.format !== "xml") throw new Error(`Expected xml, got ${exportResult.format}`);
    if (exportResult.submission_status !== "SCHEMA_VALIDATED_LOCALLY") throw new Error("Expected local-only posture on export");
  });

  it("buildVerifierPackage returns package", async () => {
    const { repo } = makeRepo();
    const service = new MrvReportService(repo as never);
    const pkg = await service.buildVerifierPackage({
      reportId: "r1",
      reportContent: "<xml/>",
      sourceBdnCount: 3,
      voyageExportCount: 5,
      discrepancyNotes: [],
      validationResultsRef: "val-1",
      auditReferences: ["audit-1"],
    });
    if (pkg.report_id !== "r1") throw new Error("Expected r1");
  });
});

run();
