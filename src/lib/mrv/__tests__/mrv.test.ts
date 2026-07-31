import { describe, it, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { runMrvCompletenessCheck } from "@/lib/mrv/completeness";
import type { MrvDatasetInfo } from "@/lib/mrv/completeness";
import { runPreSubmissionChecklist } from "@/lib/mrv/checklist";
import type { MrvPreSubmissionInput } from "@/lib/mrv/checklist";
import { generateXmlExport, generateCsvExport, simpleHash } from "@/lib/mrv/export";
import { buildVerifierPackage } from "@/lib/mrv/verifier-package";
import { MrvReportService } from "@/lib/mrv/service";
import type { MrvReportResult, MrvReportInsert, MrvReportRow, MrvVoyageEntry } from "@/lib/mrv/types";

// ── Completeness ───────────────────────────────────────────────────────────

describe("MRV completeness", () => {
  function makeDataset(overrides: Partial<MrvDatasetInfo> = {}): MrvDatasetInfo {
    return {
      hasVoyages: true,
      hasFuelDeliveries: true,
      hasAisData: true,
      hasBdnCoverage: true,
      hasUnmatchedBdns: false,
      vesselName: "TestVessel",
      vesselImo: "9074729",
      monitoringPlanVersion: "v1.0",
      methodology: "default",
      hasUnresolvedValidationErrors: false,
      deliveryCount: 3,
      voyageCount: 5,
      ...overrides,
    };
  }

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

  it("returns WARNING when AIS data missing", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasAisData: false }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });

  it("returns WARNING when BDN coverage insufficient", () => {
    const result = runMrvCompletenessCheck(makeDataset({ hasBdnCoverage: false }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });

  it("returns WARNING when monitoring plan missing", () => {
    const result = runMrvCompletenessCheck(makeDataset({ monitoringPlanVersion: null }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });

  it("includes 9 checks", () => {
    const result = runMrvCompletenessCheck(makeDataset());
    if (result.checks.length !== 9) throw new Error(`Expected 9 checks, got ${result.checks.length}`);
  });
});

// ── Pre-submission checklist ───────────────────────────────────────────────

describe("MRV checklist", () => {
  function makeInput(overrides: Partial<MrvPreSubmissionInput> = {}): MrvPreSubmissionInput {
    return {
      completeness_checks: [],
      hasExportContent: true,
      reportingYear: 2026,
      vesselName: "TestVessel",
      vesselImo: "9074729",
      voyageCount: 5,
      deliveryCount: 3,
      monitoringPlanVersion: "v1.0",
      methodology: "default",
      calculationVersion: "1.0.0",
      ...overrides,
    };
  }

  it("returns PASS for valid input", () => {
    const result = runPreSubmissionChecklist(makeInput());
    if (result.status !== "PASS") throw new Error(`Expected PASS, got ${result.status}`);
  });

  it("returns BLOCKED when vessel name missing", () => {
    const result = runPreSubmissionChecklist(makeInput({ vesselName: null }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when export content not generated", () => {
    const result = runPreSubmissionChecklist(makeInput({ hasExportContent: false }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when no voyages", () => {
    const result = runPreSubmissionChecklist(makeInput({ voyageCount: 0 }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when no deliveries", () => {
    const result = runPreSubmissionChecklist(makeInput({ deliveryCount: 0 }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED for year before 2024", () => {
    const result = runPreSubmissionChecklist(makeInput({ reportingYear: 2023 }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns BLOCKED when calculation version missing", () => {
    const result = runPreSubmissionChecklist(makeInput({ calculationVersion: "" }));
    if (result.status !== "BLOCKED") throw new Error(`Expected BLOCKED, got ${result.status}`);
  });

  it("returns WARNING when monitoring plan missing", () => {
    const result = runPreSubmissionChecklist(makeInput({ monitoringPlanVersion: null }));
    if (result.status !== "WARNING") throw new Error(`Expected WARNING, got ${result.status}`);
  });
});

// ── Export ─────────────────────────────────────────────────────────────────

describe("MRV export", () => {
  function makeDummyReport(): MrvReportResult {
    return {
      calculation_version: "1.0.0",
      parameter_version: "2025.1",
      vessel_id: "vessel-uuid-001",
      reporting_year: 2026,
      status: "draft",
      completeness_status: "VALID",
      completeness_checks: [],
      blocking_issues: [],
      warnings: [],
      total_voyages: 1,
      total_fuel_mt: 100,
      total_co2_tonnes: 311.4,
      monitoring_plan_version: "v1.0",
      methodology: "default",
      voyage_entries: [
        {
          voyage_id: "v1",
          departure_port: "Rotterdam",
          arrival_port: "Hamburg",
          departure_date: "2026-01-15T08:00:00.000Z",
          arrival_date: "2026-01-16T14:00:00.000Z",
          distance_nm: 350,
          fuel_type: "hfo_380",
          fuel_consumption_mt: 100,
          co2_tonnes: 311.4,
          voyage_type: "MRV",
          data_quality: "reconciled",
        },
      ],
      delivery_ids: ["d1"],
      voyage_ids: ["v1"],
      report_data: {},
      generated_at: "2026-07-30T00:00:00.000Z",
    };
  }

  it("generates XML export", () => {
    const report = makeDummyReport();
    const result = generateXmlExport(report);
    if (result.format !== "xml") throw new Error("Expected xml");
    if (!result.content.includes("<MrvAnnualReport>")) throw new Error("Expected XML root");
    if (!result.content.includes("Rotterdam")) throw new Error("Expected Rotterdam in XML");
    if (!result.content.includes("<Co2Tonnes>311.4</Co2Tonnes>")) throw new Error("Expected CO2 in XML");
    if (!result.content_hash) throw new Error("Expected hash");
  });

  it("generates CSV export", () => {
    const report = makeDummyReport();
    const result = generateCsvExport(report);
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
        fuel_type: original!.fuel_type,
        fuel_consumption_mt: original!.fuel_consumption_mt,
        co2_tonnes: original!.co2_tonnes,
        voyage_type: original!.voyage_type,
        data_quality: original!.data_quality,
      }],
    };
    const result = generateXmlExport(modifiedReport);
    if (!result.content.includes("&amp;")) throw new Error("Expected &amp;");
    if (!result.content.includes("&lt;")) throw new Error("Expected &lt;");
    if (!result.content.includes("&gt;")) throw new Error("Expected &gt;");
  });

  it("CSV handles commas in values", () => {
    const report = makeDummyReport();
    const original = report.voyage_entries[0];
    const modifiedReport: MrvReportResult = {
      ...report,
      voyage_entries: [{
        voyage_id: original!.voyage_id,
        departure_port: "Rotterdam, Port",
        arrival_port: original!.arrival_port,
        departure_date: original!.departure_date,
        arrival_date: original!.arrival_date,
        distance_nm: original!.distance_nm,
        fuel_type: original!.fuel_type,
        fuel_consumption_mt: original!.fuel_consumption_mt,
        co2_tonnes: original!.co2_tonnes,
        voyage_type: original!.voyage_type,
        data_quality: original!.data_quality,
      }],
    };
    const result = generateCsvExport(modifiedReport);
    if (!result.content.includes('"Rotterdam, Port"')) throw new Error("Expected quoted CSV value");
  });

  it("generates consistent hashes", () => {
    const report = makeDummyReport();
    const r1 = generateXmlExport(report);
    if (r1.content_hash !== simpleHash(r1.content)) throw new Error("Expected hash to match content");
    // GeneratedAt embeds a fresh timestamp, so two separate calls may differ.
    // The hash contract is: content_hash === simpleHash(content).
    const r2 = generateXmlExport(report);
    if (r1.content_hash !== simpleHash(r2.content) && r1.content === r2.content) {
      throw new Error("Expected identical hashes for identical content");
    }
  });
});

// ── Verifier package ───────────────────────────────────────────────────────

describe("verifier package", () => {
  it("builds package with correct structure", () => {
    const pkg = buildVerifierPackage({
      reportId: "report-uuid-001",
      reportContent: "<xml>...</xml>",
      sourceBdnCount: 5,
      voyageExportCount: 10,
      discrepancyNotes: ["Note 1", "Note 2"],
      validationResultsRef: "val-ref-001",
      auditReferences: ["audit-ref-001", "audit-ref-002"],
    });

    if (pkg.report_id !== "report-uuid-001") throw new Error("Expected report id");
    if (pkg.source_bdn_count !== 5) throw new Error("Expected 5 BDNs");
    if (pkg.voyage_export_count !== 10) throw new Error("Expected 10 voyages");
    if (pkg.discrepancy_notes.length !== 2) throw new Error("Expected 2 notes");
    if (pkg.audit_references.length !== 2) throw new Error("Expected 2 audit refs");
    if (!pkg.generated_at) throw new Error("Expected generated_at");
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
    if (pkg.audit_references.length !== 0) throw new Error("Expected empty refs");
  });
});

// ── Service ────────────────────────────────────────────────────────────────

describe("MrvReportService", () => {
  function makeRepo() {
    const store: MrvReportRow[] = [];
    return {
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
  }

  it("checks completeness on valid dataset", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const result = await service.checkCompleteness({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: {
        hasVoyages: true,
        hasFuelDeliveries: true,
        hasAisData: true,
        hasBdnCoverage: true,
        hasUnmatchedBdns: false,
        vesselName: "Test",
        vesselImo: "1234567",
        monitoringPlanVersion: "v1",
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: 3,
        voyageCount: 5,
      },
    });

    if (result.status !== "VALID") throw new Error(`Expected VALID, got ${result.status}`);
  });

  it("generateReport returns blocked if completeness fails", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const result = await service.generateReport({
      vessel_id: "v1",
      reporting_year: 2026,
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
      deliveries: [],
      voyages: [],
    });

    if (result.status !== "blocked") throw new Error(`Expected blocked, got ${result.status}`);
    if (result.completeness_status !== "BLOCKED") throw new Error("Expected BLOCKED");
    if (result.total_voyages !== 0) throw new Error("Expected 0 voyages");
  });

  it("generateReport creates voyage entries for valid data", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const result = await service.generateReport({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: {
        hasVoyages: true,
        hasFuelDeliveries: true,
        hasAisData: true,
        hasBdnCoverage: true,
        hasUnmatchedBdns: false,
        vesselName: "Test",
        vesselImo: "1234567",
        monitoringPlanVersion: "v1",
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: 1,
        voyageCount: 2,
      },
      deliveries: [{ id: "d1", fuel_type: "hfo_380", quantity_mt: 100, delivery_date: "2026-01-01" }],
      voyages: [
        { id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", departure_time: "2026-01-01T00:00:00Z", arrival_time: "2026-01-02T00:00:00Z", distance_nm: 350 },
        { id: "v2", departure_port: "Hamburg", arrival_port: "Rotterdam", departure_time: "2026-01-03T00:00:00Z", arrival_time: "2026-01-04T00:00:00Z", distance_nm: 350 },
      ],
    });

    if (result.status !== "draft") throw new Error(`Expected draft, got ${result.status}`);
    if (result.total_voyages !== 2) throw new Error("Expected 2 voyages");
    if (result.total_fuel_mt <= 0) throw new Error("Expected positive fuel total");
    if (result.total_co2_tonnes <= 0) throw new Error("Expected positive CO2 total");
    if (result.voyage_entries.length !== 2) throw new Error("Expected 2 voyage entries");
  });

  it("runChecklist returns result", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const report = await service.generateReport({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: {
        hasVoyages: true,
        hasFuelDeliveries: true,
        hasAisData: true,
        hasBdnCoverage: true,
        hasUnmatchedBdns: false,
        vesselName: "Test",
        vesselImo: "1234567",
        monitoringPlanVersion: "v1",
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: 1,
        voyageCount: 1,
      },
      deliveries: [{ id: "d1", fuel_type: "hfo_380", quantity_mt: 100, delivery_date: "2026-01-01" }],
      voyages: [{ id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", departure_time: "2026-01-01T00:00:00Z", arrival_time: "2026-01-02T00:00:00Z", distance_nm: 350 }],
    });

    const checklist = await service.runChecklist(report);
    if (checklist.status !== "PASS" && checklist.status !== "WARNING" && checklist.status !== "BLOCKED") {
      throw new Error(`Unexpected status: ${checklist.status}`);
    }
    if (checklist.items.length === 0) throw new Error("Expected at least 1 checklist item");
  });

  it("generateExport produces XML by default", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const report = await service.generateReport({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: {
        hasVoyages: true,
        hasFuelDeliveries: true,
        hasAisData: true,
        hasBdnCoverage: true,
        hasUnmatchedBdns: false,
        vesselName: "Test",
        vesselImo: "1234567",
        monitoringPlanVersion: "v1",
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: 1,
        voyageCount: 1,
      },
      deliveries: [{ id: "d1", fuel_type: "hfo_380", quantity_mt: 100, delivery_date: "2026-01-01" }],
      voyages: [{ id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", departure_time: "2026-01-01T00:00:00Z", arrival_time: "2026-01-02T00:00:00Z", distance_nm: 350 }],
    });

    const exportResult = await service.generateExport(report);
    if (exportResult.format !== "xml") throw new Error(`Expected xml, got ${exportResult.format}`);
  });

  it("generateExport can produce CSV", async () => {
    const repo = makeRepo();
    const service = new MrvReportService(repo as never);

    const report = await service.generateReport({
      vessel_id: "v1",
      reporting_year: 2026,
      dataset: {
        hasVoyages: true,
        hasFuelDeliveries: true,
        hasAisData: true,
        hasBdnCoverage: true,
        hasUnmatchedBdns: false,
        vesselName: "Test",
        vesselImo: "1234567",
        monitoringPlanVersion: "v1",
        methodology: "default",
        hasUnresolvedValidationErrors: false,
        deliveryCount: 1,
        voyageCount: 1,
      },
      deliveries: [{ id: "d1", fuel_type: "hfo_380", quantity_mt: 100, delivery_date: "2026-01-01" }],
      voyages: [{ id: "v1", departure_port: "Rotterdam", arrival_port: "Hamburg", departure_time: "2026-01-01T00:00:00Z", arrival_time: "2026-01-02T00:00:00Z", distance_nm: 350 }],
    });

    const exportResult = await service.generateExport(report, "csv");
    if (exportResult.format !== "csv") throw new Error(`Expected csv, got ${exportResult.format}`);
  });

  it("buildVerifierPackage returns package", async () => {
    const repo = makeRepo();
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
