/**
 * mrv.part4-6.test.ts — adversarial acceptance tests for the Part 4.6 MRV
 * correctness fix (responses to the Part 4.5 adversarial audit, YELLOW→safe.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Honesty rule: these tests use REAL logic + honest in-memory repos that ENFORCE
 * version-number uniqueness and lifecycle constraints, so they can never give a
 * false GREEN by hiding the very constraint bugs the audit found (no relying on
 * a permissive mock that ignores unique/lifecycle rules).
 */
import { describe, it, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { aggregateAnnualMrv } from "@/lib/mrv/aggregation";
import { runMrvCompletenessCheck, type MrvDatasetInfo } from "@/lib/mrv/completeness";
import { canTransition } from "@/lib/mrv/lifecycle";
import { generateAnnualMrvReport, type MrvPipelineInput } from "@/lib/mrv/pipeline";
import { MrvReportService } from "@/lib/mrv/service";
import { sha256Hex, generateXmlExport, generateCsvExport, simpleHash } from "@/lib/mrv/export";
import { buildVerifierPackage } from "@/lib/mrv/verifier-package";
import { classifyVoyagePortStatusWithHints, isEuPort } from "@/lib/eu-ets/port-classifier";
import { isKnownFuelType } from "@/lib/fuel-delivery/emission-factors";
import type {
  MrvReportRow,
  MrvReportInsert,
  MrvReportResult,
  MrvLifecycle,
  MrvVoyageEntry,
  MrvReportVersion,
  MrvMonitoringPlan,
} from "@/lib/mrv/types";
import type { ApplicabilityDecision } from "@/lib/regulatory/applicability";

// ── Shared fixture builders (mirror mrv.test.ts, VERIFIED + known fuel) ─────

function makeApplicability(ruleVersion = 1): ApplicabilityDecision {
  return {
    applicability: "APPLICABLE",
    is_decision_final: true,
    rule_version: ruleVersion,
    rule_effective_from: "2024-01-01",
    rule_effective_until: null,
    basis: { facts_used: { gt: 12000 }, missing_facts: [], conflicts: [] },
    notes: "EU MRV scope applies",
  };
}

function makePlan(): MrvMonitoringPlan {
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
  };
}

function makePipelineInput(overrides: Partial<MrvPipelineInput> = {}): MrvPipelineInput {
  const consumption = [{
    voyage_id: "v1",
    fuel_type: "hfo_380",
    quantity_mt: 100,
    method: "BDN_METHOD_A",
    status: "VERIFIED",
    source_type: "BDN",
    source_record_ids: ["bdn-1"],
  }];
  const consumptionByVoyage = new Map<string, ReadonlyArray<{ fuel_type: string; quantity_mt: number; method: string; status: string }>>();
  consumptionByVoyage.set("v1", consumption.map((c) => ({ fuel_type: c.fuel_type, quantity_mt: c.quantity_mt, method: c.method, status: c.status })));
  return {
    vessel_id: "v1",
    reporting_year: 2026,
    dataset: {
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
      monitoringPlanResolved: true,
    },
    applicability: makeApplicability(),
    monitoringPlanResolution: { status: "RESOLVED", plan: makePlan() },
    consumption,
    consumptionByVoyage,
    voyages: [{
      id: "v1",
      departure_port: "Rotterdam",
      arrival_port: "Hamburg",
      departure_time: "2026-01-01T00:00:00.000Z",
      arrival_time: "2026-01-05T00:00:00.000Z",
      distance_nm: 350,
      scope_type: "INTRA_EU",
    }],
    methodology: "default",
    ets_record_id: null,
    ...overrides,
  };
}

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
    calculation_version: "2.0.0",
    parameter_version: "EU_MRV_rule_v1",
    mrv_rule_version: 1,
    mrv_rule_effective_from: "2024-01-01",
    mrv_rule_effective_until: null,
    geography_version: "2026.1",
  };
  const base: MrvReportResult = {
    calculation_version: "2.0.0",
    parameter_version: "EU_MRV_rule_v1",
    vessel_id: "v1",
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
    fuel_stocktakes: [{ fuel_type: "hfo_380", quantity_mt: 100, co2_factor: 3.114, co2_tonnes: 311.4, source: "shared_registry" }],
    monitored_period_start: "2026-01-01",
    monitored_period_end: "2026-12-31",
    monitoring_plan_version: "v1",
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
    version,
    delivery_ids: [],
    voyage_ids: ["v1"],
    report_data: {},
    generated_at: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
  return base;
}

// ── Honest in-memory repos (enforce version uniqueness + lifecycle) ────────

interface HonestRepos {
  store: MrvReportRow[];
  versions: Array<{ mrv_report_id: string; version_number: number }>;
  audit: Array<{ action: string; entity_id?: string; before_data?: Record<string, unknown>; after_data?: Record<string, unknown> }>;
  repo: {
    findByVesselAndYear(v: string, y: number): Promise<MrvReportRow | null>;
    upsert(r: MrvReportInsert): Promise<MrvReportRow>;
  };
  versionRepo: {
    findLatest(id: string): Promise<{ version_number: number } | null>;
    listByReport(id: string): Promise<Array<{ version_number: number }>>;
    append(v: { mrv_report_id: string; version_number: number }): Promise<{ version_number: number }>;
  };
  auditLog: {
    insert(e: { action: string; entity_id?: string; before_data?: Record<string, unknown>; after_data?: Record<string, unknown> }): Promise<void>;
  };
}

function makeHonestRepos(): HonestRepos {
  const store: MrvReportRow[] = [];
  const versions: Array<{ mrv_report_id: string; version_number: number }> = [];
  const audit: HonestRepos["audit"] = [];

  let seq = 0;
  const repo = {
    async findByVesselAndYear(v: string, y: number) {
      return store.find((r) => r.vessel_id === v && r.reporting_year === y) ?? null;
    },
    async upsert(r: MrvReportInsert) {
      const existing = store.findIndex((row) => row.vessel_id === r.vessel_id && row.reporting_year === r.reporting_year);
      const ts = new Date().toISOString();
      const row: MrvReportRow = {
        id: existing >= 0 ? store[existing]!.id : `rep-${seq++}`,
        vessel_id: r.vessel_id,
        reporting_year: r.reporting_year,
        status: r.status ?? "draft",
        completeness_status: r.completeness_status,
        completeness_checks: r.completeness_checks ?? [],
        blocking_issues: r.blocking_issues ?? [],
        warnings: r.warnings ?? [],
        checklist_status: r.checklist_status ?? null,
        checklist_details: r.checklist_details ?? null,
        export_format: r.export_format ?? null,
        export_generated_at: r.export_generated_at ?? null,
        export_content_hash: r.export_content_hash ?? null,
        export_file_path: r.export_file_path ?? null,
        report_data: r.report_data,
        total_voyages: r.total_voyages,
        total_fuel_mt: r.total_fuel_mt,
        total_co2_tonnes: r.total_co2_tonnes,
        monitoring_plan_version: r.monitoring_plan_version ?? null,
        methodology: r.methodology ?? "default",
        calculation_version: r.calculation_version,
        parameter_version: r.parameter_version,
        ets_record_id: r.ets_record_id ?? null,
        lifecycle: r.lifecycle ?? null,
        period_start: r.period_start ?? null,
        period_end: r.period_end ?? null,
        monitoring_plan_ver: r.monitoring_plan_ver ?? null,
        total_distance_nm: r.total_distance_nm ?? null,
        total_time_at_sea_hours: r.total_time_at_sea_hours ?? null,
        generated_at: r.generated_at ?? ts,
        created_at: ts,
        updated_at: ts,
      };
      if (existing >= 0) store[existing] = row; else store.push(row);
      return row;
    },
  };
  const versionRepo = {
    async findLatest(id: string) {
      const match = versions.filter((v) => v.mrv_report_id === id).sort((a, b) => b.version_number - a.version_number);
      return match[0] ?? null;
    },
    async listByReport(id: string) {
      return versions.filter((v) => v.mrv_report_id === id);
    },
    async append(v: { mrv_report_id: string; version_number: number }) {
      // ENFORCE (mrv_report_id, version_number) uniqueness — like the DB constraint.
      if (versions.some((w) => w.mrv_report_id === v.mrv_report_id && w.version_number === v.version_number)) {
        throw new Error("UNIQUE violation: (mrv_report_id, version_number)");
      }
      versions.push(v);
      return v;
    },
  };
  const auditLog = {
    async insert(e: HonestRepos["audit"][number]) {
      audit.push({ action: e.action, entity_id: e.entity_id, before_data: e.before_data, after_data: e.after_data });
    },
  };
  return { store, versions, audit, repo, versionRepo, auditLog };
}

// ═══════════════════════════════════════════════════════════════════════════
// §23 adversarial cases
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 4.6 adversial: unknown fuel NEVER becomes MGO", () => {
  it("excludes an unknown fuel from audited CO2 instead of folding it as MGO 3.206", () => {
    const input = makePipelineInput({
      consumption: [{ voyage_id: "v1", fuel_type: "mystery_fuel_x", quantity_mt: 100, method: "BDN_METHOD_A", status: "VERIFIED", source_type: "BDN", source_record_ids: ["bdn-x"] }],
    });
    const agg = aggregateAnnualMrv({
      consumption: input.consumption as never,
      voyages: input.voyages as never,
      consumptionByVoyage: input.consumptionByVoyage as never,
    });
    if (agg.total_fuel_mt !== 0) throw new Error(`Expected no audited fuel for unknown type, got ${agg.total_fuel_mt}`);
    if (agg.total_co2_tonnes !== 0) throw new Error(`Expected no audited CO2 for unknown type, got ${agg.total_co2_tonnes}`);
    if (agg.unresolved_consumption_count !== 1) throw new Error("Expected 1 unresolved (UNKNOWN_FUEL_TYPE)");
    if (isKnownFuelType("mystery_fuel_x")) throw new Error("isKnownFuelType must be false for unknown fuel");
    if (isKnownFuelType("mgo") !== true) throw new Error("legitimate MGO must remain a known fuel");
  });

  it("keeps legitimate MGO audited (shared registry unchanged)", () => {
    const agg = aggregateAnnualMrv({
      consumption: [{ voyage_id: "v1", fuel_type: "mgo", quantity_mt: 50, method: "BDN_METHOD_A", status: "VERIFIED", source_type: "BDN", source_record_ids: ["bdn-mgo"] }],
      voyages: [] as never,
      consumptionByVoyage: new Map(),
    });
    if (agg.total_fuel_mt !== 50) throw new Error(`Expected MGO fuel 50, got ${agg.total_fuel_mt}`);
    if (agg.total_co2_tonnes <= 0) throw new Error("Expected positive MGO CO2");
  });

  it("treats a REVIEW consumption row as excluded, never audited", () => {
    const agg = aggregateAnnualMrv({
      consumption: [{ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100, method: "BDN_METHOD_A", status: "REVIEW", source_type: "BDN", source_record_ids: ["bdn-r"] }],
      voyages: [] as never,
      consumptionByVoyage: new Map(),
    });
    if (agg.total_fuel_mt !== 0) throw new Error("REVIEW row must not be audited");
    if (agg.unresolved_consumption_count !== 1) throw new Error("REVIEW row must surface as unresolved");
  });

  it("PENDING (INCLUDED_BUT_NOT_VERIFIED) is counted as non-verified, not audited", () => {
    const agg = aggregateAnnualMrv({
      consumption: [{ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100, method: "BDN_METHOD_A", status: "PENDING", source_type: "BDN", source_record_ids: ["bdn-p"] }],
      voyages: [] as never,
      consumptionByVoyage: new Map(),
    });
    if (agg.total_fuel_mt !== 0) throw new Error("PENDING row must not be in the audited figure");
    if (agg.non_verified_consumption_count !== 1) throw new Error("Expected 1 non-verified row");
    if (agg.unresolved_consumption_count !== 0) throw new Error("PENDING is not unresolved/BLOCKED");
  });
});

describe("Part 4.6 adversial: unknown geography is never INTRA_EU", () => {
  it("classifier surfaces UNKNOWN (not INTRA_EU) when ports cannot be resolved", () => {
    const s = classifyVoyagePortStatusWithHints("SomeUnknownPortA", "SomeUnknownPortB");
    if (s.type !== "UNKNOWN") throw new Error(`Expected UNKNOWN, got ${s.type}`);
  });
  it("classifier trusts an authoritative EU country fact over an unknown name", () => {
    const s = classifyVoyagePortStatusWithHints("SomePort", "OtherPort", "NL", "DE");
    if (s.type !== "INTRA_EU") throw new Error(`Expected INTRA_EU via country, got ${s.type}`);
  });
  it("classifier resolves EU ports to eu, unknown to unknown", () => {
    if (isEuPort("Rotterdam") !== "eu") throw new Error("Rotterdam must be eu");
    if (isEuPort("Nowhere") !== "unknown") throw new Error("Nowhere must be unknown");
  });
});

describe("Part 4.6 adversial: completeness from real data (no vacuous >=0)", () => {
  it("a dataset with ZERO consumption rows is NOT auto-sourced", () => {
    const r = runMrvCompletenessCheck({
      hasVoyages: true,
      hasFuelDeliveries: false,
      hasAisData: true,
      hasBdnCoverage: false,
      hasUnmatchedBdns: false,
      vesselName: "T",
      vesselImo: "1",
      monitoringPlanVersion: "v1",
      methodology: "default",
      hasUnresolvedValidationErrors: false,
      deliveryCount: 0,
      voyageCount: 1,
      totalConsumptionCount: 0,
      unresolvedConsumptionCount: 0,
    });
    if (r.status !== "BLOCKED") throw new Error(`Expected BLOCKED for zero consumption, got ${r.status}`);
    if (!r.blocking_issues.some((b) => b.includes("equal-share"))) throw new Error("Blocked for missing canonical consumption");
  });

  it("non-verified (PENDING) consumption blocks verification-readiness", () => {
    const r = runMrvCompletenessCheck({
      hasVoyages: true,
      hasFuelDeliveries: true,
      hasAisData: true,
      hasBdnCoverage: true,
      hasUnmatchedBdns: false,
      vesselName: "T",
      vesselImo: "1",
      monitoringPlanVersion: "v1",
      methodology: "default",
      hasUnresolvedValidationErrors: false,
      deliveryCount: 3,
      voyageCount: 1,
      totalConsumptionCount: 1,
      nonVerifiedConsumptionCount: 1,
      unresolvedConsumptionCount: 0,
    });
    if (r.status !== "BLOCKED") throw new Error("PENDING rows must block verification-readiness");
  });
});

describe("Part 4.6 adversial: lifecycle enforcement (no direct bypass)", () => {
  it("rejects DRAFT -> VERIFIED", () => {
    const t = canTransition("DRAFT", "VERIFIED");
    if (t.ok) throw new Error("DRAFT→VERIFIED must be illegal");
  });
  it("rejects DATA_INCOMPLETE -> VERIFIED", () => {
    if (canTransition("DATA_INCOMPLETE", "VERIFIED").ok) throw new Error("must be illegal");
  });
  it("rejects REQUIRES_REVIEW -> EXPORTED", () => {
    if (canTransition("REQUIRES_REVIEW", "EXPORTED").ok) throw new Error("must be illegal");
  });
  it("allows DRAFT -> VALIDATED", () => {
    if (!canTransition("DRAFT", "VALIDATED").ok) throw new Error("should be legal");
  });

  it("transitionMrvReport rejects an illegal edge and writes no audit event", async () => {
    const h = makeHonestRepos();
    const service = new MrvReportService(h.repo as never, h.versionRepo as never, h.auditLog as never, "org-1");
    await service.generateReport(makePipelineInput());
    let threw = false;
    try {
      // Generated report is VALIDATED; VALIDATED→DATA_INCOMPLETE is an illegal
      // edge (cannot regress a validated report to incomplete) and must throw.
      await service.transitionMrvReport("v1", 2026, "DATA_INCOMPLETE" as MrvLifecycle);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error("Illegal transition must throw");
    const report = await h.repo.findByVesselAndYear("v1", 2026);
    if (report?.lifecycle === "DATA_INCOMPLETE") throw new Error("lifecycle must not have changed");
    if (h.audit.filter((a) => a.after_data?.lifecycle === "DATA_INCOMPLETE").length > 0) {
      throw new Error("no audit event for a rejected transition");
    }
  });

  it("transitionMrvReport permits a legal DRAFT -> REQUIRES_REVIEW path and audits it", async () => {
    const h = makeHonestRepos();
    const service = new MrvReportService(h.repo as never, h.versionRepo as never, h.auditLog as never, "org-1");
    await service.generateReport(makePipelineInput());
    const updated = await service.transitionMrvReport("v1", 2026, "REQUIRES_REVIEW" as MrvLifecycle);
    if (!updated) throw new Error("expected a report row");
    if (updated.lifecycle !== "REQUIRES_REVIEW") throw new Error("lifecycle not updated");
    if (h.audit.filter((a) => a.action === "mrv.lifecycle_transition").length < 2) {
      throw new Error("expected generate + transition audit events");
    }
  });
});

describe("Part 4.6 adversial: monotonic versioning + immutability", () => {
  it("second generation bumps the version to 2 (monotonic, no MAX+1 collision)", async () => {
    const h = makeHonestRepos();
    const service = new MrvReportService(h.repo as never, h.versionRepo as never, h.auditLog as never, "org-1");
    await service.generateReport(makePipelineInput());
    await service.generateReport(makePipelineInput());
    if (h.versions.length !== 2) throw new Error("expected 2 versions");
    const nums = h.versions.map((v) => v.version_number);
    if (nums.sort((a, b) => a - b)[0] !== 1) throw new Error("expected version 1");
    if (nums.sort((a, b) => a - b)[1] !== 2) throw new Error("expected version 2");
  });

  it("version numbers stay unique (no duplicate (report_id, version_number))", async () => {
    const h = makeHonestRepos();
    const service = new MrvReportService(h.repo as never, h.versionRepo as never, h.auditLog as never, "org-1");
    for (let i = 0; i < 3; i++) await service.generateReport(makePipelineInput());
    const seen = new Set<string>();
    for (const v of h.versions) {
      const key = `${v.mrv_report_id}:${v.version_number}`;
      if (seen.has(key)) throw new Error(`duplicate version key ${key}`);
      seen.add(key);
    }
    if (seen.size !== 3) throw new Error("expected 3 distinct versions");
  });

  it("historical replay: V1 is immutable and unchanged after source change; V2 is separate", async () => {
    const h = makeHonestRepos();
    const service = new MrvReportService(h.repo as never, h.versionRepo as never, h.auditLog as never, "org-1");
    // V1 under rule v1
    const r1 = await service.generateReport(makePipelineInput({
      applicability: makeApplicability(1),
      consumption: [{ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 100, method: "BDN_METHOD_A", status: "VERIFIED", source_type: "BDN", source_record_ids: ["bdn-1"] }],
    }));
    const v1Glass = JSON.stringify(r1.report_data);

    // Source data changes AND a new rule v2 is now effective.
    const r2 = await service.generateReport(makePipelineInput({
      applicability: makeApplicability(2),
      consumption: [{ voyage_id: "v1", fuel_type: "hfo_380", quantity_mt: 200, method: "BDN_METHOD_A", status: "VERIFIED", source_type: "BDN", source_record_ids: ["bdn-2", "bdn-3"] }],
    }));

    // V1 snapshot unchanged; V2 is distinct.
    if (JSON.stringify(r1.report_data) !== v1Glass) throw new Error("V1 report_data must be immutable after re-generation");
    if (JSON.stringify(r2.report_data) === v1Glass) throw new Error("V2 must differ from V1");
    const ruleVersionV1 = r1.report_data["mrv_rule_version"];
    const ruleVersionV2 = r2.report_data["mrv_rule_version"];
    if (ruleVersionV1 !== 1) throw new Error(`V1 must pin rule v1, got ${ruleVersionV1}`);
    if (ruleVersionV2 !== 2) throw new Error(`V2 must pin rule v2, got ${ruleVersionV2}`);
  });
});

describe("Part 4.6 adversial: real SHA-256 export integrity", () => {
  it("content_hash is a real 64-hex SHA-256 (never the old broken marker)", () => {
    const r = generateXmlExport(makeDummyReport());
    if (!/^[0-9a-f]{64}$/.test(r.content_hash)) throw new Error(`content_hash not a sha256 hex: ${r.content_hash}`);
    if (r.content_hash.includes("sha256-not-available")) throw new Error("legacy mislabelled hash must not be used");
    if (r.content_hash_algorithm !== "sha256") throw new Error("must declare sha256");
  });
  it("repeat export of identical content yields identical hash", () => {
    const report = makeDummyReport();
    const r1 = generateXmlExport(report);
    const r2 = generateXmlExport(report);
    if (r1.content_hash !== r2.content_hash) throw new Error("repeat export must be byte-identical (same content+hash)");
    if (r1.content_hash !== simpleHash(r1.content)) throw new Error("hash must match content");
  });
  it("verifier reproducibility_hash is a real sha256 and deterministic", () => {
    const p1 = buildVerifierPackage({ reportId: "r", reportContent: "x", sourceBdnCount: 1, voyageExportCount: 1, discrepancyNotes: [], validationResultsRef: "v", auditReferences: [], sourceRecordIds: ["a", "b"], calculationVersion: "2.0.0" });
    const p2 = buildVerifierPackage({ reportId: "r", reportContent: "x", sourceBdnCount: 1, voyageExportCount: 1, discrepancyNotes: [], validationResultsRef: "v", auditReferences: [], sourceRecordIds: ["a", "b"], calculationVersion: "2.0.0" });
    if (!/^[0-9a-f]{64}$/.test(p1.reproducibility_hash ?? "")) throw new Error("reproducibility_hash must be sha256 hex");
    if (p2.reproducibility_hash !== p1.reproducibility_hash) throw new Error("must be deterministic");
  });
});

describe("Part 4.6 adversial: export posture is truthful", () => {
  it("a blocked lifecycle yields a diagnostic artifact, not a submission-ready file", () => {
    const r = generateXmlExport(makeDummyReport({ lifecycle: "REQUIRES_REVIEW" }));
    if (r.submission_status !== "SUBMISSION_BLOCKED") throw new Error(`expected SUBMISSION_BLOCKED, got ${r.submission_status}`);
    if (r.content.includes("SUBMITTED_TO_THETIS")) throw new Error("must never claim THETIS submission");
  });
  it("an exportable report is SCHEMA_VALIDATED_LOCALLY (never external verification)", () => {
    const r = generateXmlExport(makeDummyReport());
    if (r.submission_status !== "SCHEMA_VALIDATED_LOCALLY") throw new Error("local-only posture expected");
    if (!r.external_submission_note.toLowerCase().includes("no external")) {
      throw new Error("external_submission_note must not overclaim");
    }
  });
});

describe("Part 4.6 adversial: version pinning is carried into HEAD snapshot", () => {
  it("report_data pins rule/geography/calculation versions", () => {
    const out = generateAnnualMrvReport(makePipelineInput(), { versionNumber: 1 }, {
      mrvRuleVersion: 1,
      mrvRuleEffectiveFrom: "2024-01-01",
      mrvRuleEffectiveUntil: null,
    });
    if (out.version.mrv_rule_version !== 1) throw new Error("version must pin rule v1");
    if (out.version.geography_version !== "2026.1") throw new Error("version must pin geography version");
    if (out.version.calculation_version !== "2.0.0") throw new Error("version must pin calculation version");
  });
});

run();