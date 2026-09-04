import { describe, it, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { ReconciliationFindingInput, ReconciliationEdgeInput, EdgeStatus, ReconciliationStatus, Severity } from "../types";
import {
  reconcileAisVoyage,
  reconcilePortCallVoyage,
  reconcileFuelVoyage,
  reconcileNoonConsumption,
  reconcileBdnConsumption,
  reconcileCrossRegulation,
  type VoyageInput,
  type AisPositionInput,
  type PortCallInput,
  type FuelDeliveryInput,
  type NoonReportInput,
  type RegulatorySnapshot,
} from "../reconcilers";
import { createReconciliationEngine, deduplicateFindings, mergeWithExisting, toFindingInsert } from "../engine";
import { buildFindingKey, buildEdgeKey } from "../keys";
import { createChainStatusTracker, AIS_VOYAGE_EDGE, PORTCALL_VOYAGE_EDGE, ALL_EDGES } from "../chain";
import { createReconciliationResolution } from "../resolution";

function makeVoyage(overrides: Partial<VoyageInput> = {}): VoyageInput {
  return {
    id: "voy-1",
    vessel_id: "vsl-1",
    departure_time: "2026-01-01T08:00:00Z",
    arrival_time: "2026-01-05T16:00:00Z",
    departure_port: "Rotterdam",
    arrival_port: "Hamburg",
    ...overrides,
  };
}

function makeAis(overrides: Partial<AisPositionInput> = {}): AisPositionInput {
  return {
    id: "ais-1",
    vessel_id: "vsl-1",
    timestamp: "2026-01-01T12:00:00Z",
    latitude: 51.9,
    longitude: 4.5,
    ...overrides,
  };
}

function makePortCall(overrides: Partial<PortCallInput> = {}): PortCallInput {
  return {
    id: "pc-1",
    vessel_id: "vsl-1",
    voyage_id: "voy-1",
    port: "Rotterdam",
    country: "NL",
    arrival_time: "2026-01-01T08:00:00Z",
    departure_time: "2026-01-01T18:00:00Z",
    ...overrides,
  };
}

function makeFuelDelivery(overrides: Partial<FuelDeliveryInput> = {}): FuelDeliveryInput {
  return {
    id: "fd-1",
    vessel_id: "vsl-1",
    voyage_id: "voy-1",
    fuel_type: "mgo",
    quantity: 50,
    delivery_date: "2026-01-02T10:00:00Z",
    port: "Rotterdam",
    ...overrides,
  };
}

function makeNoonReport(overrides: Partial<NoonReportInput> = {}): NoonReportInput {
  return {
    id: "noon-1",
    vessel_id: "vsl-1",
    report_date: "2026-01-02T12:00:00Z",
    consumption: 12,
    fuel_type: "mgo",
    voyage_id: null,
    ...overrides,
  };
}

function makeConsumption(overrides: Partial<VoyageConsumptionRow> = {}): VoyageConsumptionRow {
  return {
    id: "vc-1",
    vessel_id: "vsl-1",
    voyage_id: "voy-1",
    reporting_year: 2026,
    fuel_type: "mgo",
    quantity_mt: 12,
    method: "NOON_REPORT_INTERVAL",
    confidence: "HIGH",
    status: "VERIFIED",
    source_type: "NOON",
    source_record_ids: ["noon-1"],
    attribution_method: "NOON_REPORT_INTERVAL",
    traceability: {},
    notes: null,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<RegulatorySnapshot> = {}): RegulatorySnapshot {
  return {
    vessel_id: "vsl-1",
    reporting_year: 2026,
    total_consumption_mt: 12,
    fuel_by_type: { mgo: 12 },
    voyage_ids: ["voy-1"],
    ...overrides,
  };
}

function hasEdge(edges: ReadonlyArray<ReconciliationEdgeInput>, edge: string, status?: EdgeStatus): boolean {
  return edges.some((e) => e.edge === edge && (!status || e.status === status));
}

function hasFinding(findings: ReadonlyArray<ReconciliationFindingInput>, type: ReconciliationFindingInput["reconciliation_type"], status?: ReconciliationStatus): boolean {
  return findings.some((f) => f.reconciliation_type === type && (!status || f.status === status));
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 0: keys + chain + idempotency
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: idempotency keys", () => {
  it("same inputs produce the same key", () => {
    const k1 = buildFindingKey("v1", "AIS_VOYAGE", ["a", "b"], 2026);
    const k2 = buildFindingKey("v1", "AIS_VOYAGE", ["b", "a"], 2026);
    if (k1 !== k2) throw new Error(`Keys differ: ${k1} vs ${k2}`);
  });
  it("different source IDs produce different keys", () => {
    const k1 = buildFindingKey("v1", "AIS_VOYAGE", ["a"], 2026);
    const k2 = buildFindingKey("v1", "AIS_VOYAGE", ["b"], 2026);
    if (k1 === k2) throw new Error("Keys should differ");
  });
  it("different vessel produces different key", () => {
    const k1 = buildFindingKey("v1", "AIS_VOYAGE", ["a"], 2026);
    const k2 = buildFindingKey("v2", "AIS_VOYAGE", ["a"], 2026);
    if (k1 === k2) throw new Error("Keys should differ");
  });
  it("deduplicateFindings removes duplicates by key", () => {
    const f1 = { reconciliation_key: "k1", reconciliation_type: "AIS_VOYAGE" as const, vessel_id: "v1", voyage_id: null, reporting_year: 2026, status: "MATCH" as const, severity: "INFO" as const, expected_value: null, observed_value: null, difference: null, tolerance: null, unit: null, source_record_ids: [], affected_regulation: "ALL" as const, explanation: "", rule_version: null, tolerance_version: null, calculation_version: null };
    const f2 = { ...f1, reconciliation_key: "k1" };
    const f3 = { ...f1, reconciliation_key: "k2" };
    const result = deduplicateFindings([f1, f2, f3]);
    if (result.length !== 2) throw new Error(`Expected 2, got ${result.length}`);
  });
});

describe("Part 5: chain status tracker", () => {
  it("starts with UNKNOWN for all edges", () => {
    const tracker = createChainStatusTracker();
    for (const edge of ALL_EDGES) {
      if (tracker.getEdge(edge) !== "UNKNOWN") throw new Error(`${edge} should start UNKNOWN`);
    }
  });
  it("records MATCHED edges", () => {
    const tracker = createChainStatusTracker();
    tracker.addEdge({ edge: AIS_VOYAGE_EDGE, vessel_id: "v1", voyage_id: "v1", reporting_year: 2026, status: "MATCHED", source_record_ids: [], target_record_ids: [], explanation: "ok" });
    if (tracker.getEdge(AIS_VOYAGE_EDGE) !== "MATCHED") throw new Error("should be MATCHED");
  });
  it("merges to worst status", () => {
    const tracker = createChainStatusTracker();
    tracker.addEdge({ edge: AIS_VOYAGE_EDGE, vessel_id: "v1", voyage_id: "v1", reporting_year: 2026, status: "MATCHED", source_record_ids: [], target_record_ids: [], explanation: "" });
    tracker.addEdge({ edge: AIS_VOYAGE_EDGE, vessel_id: "v1", voyage_id: "v1", reporting_year: 2026, status: "CONFLICT", source_record_ids: [], target_record_ids: [], explanation: "" });
    if (tracker.getEdge(AIS_VOYAGE_EDGE) !== "CONFLICT") throw new Error("should merge to CONFLICT");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: AIS ↔ Voyage reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: AIS ↔ Voyage", () => {
  it("MATCHED when AIS covers the voyage with ≤6h gaps", () => {
    const shortVoyage = makeVoyage({ departure_time: "2026-01-01T08:00:00Z", arrival_time: "2026-01-02T10:00:00Z" });
    const ais = [
      makeAis({ id: "a1", timestamp: "2026-01-01T08:00:00Z" }),
      makeAis({ id: "a2", timestamp: "2026-01-01T11:00:00Z" }),
      makeAis({ id: "a3", timestamp: "2026-01-01T14:00:00Z" }),
      makeAis({ id: "a4", timestamp: "2026-01-01T17:00:00Z" }),
      makeAis({ id: "a5", timestamp: "2026-01-01T20:00:00Z" }),
      makeAis({ id: "a6", timestamp: "2026-01-01T23:00:00Z" }),
      makeAis({ id: "a7", timestamp: "2026-01-02T02:00:00Z" }),
      makeAis({ id: "a8", timestamp: "2026-01-02T05:00:00Z" }),
      makeAis({ id: "a9", timestamp: "2026-01-02T08:00:00Z" }),
      makeAis({ id: "a10", timestamp: "2026-01-02T10:00:00Z" }),
    ];
    const result = reconcileAisVoyage({ vessel_id: "vsl-1", voyage: shortVoyage, ais_positions: ais, reporting_year: 2026 });
    if (!hasEdge(result.edges, AIS_VOYAGE_EDGE, "MATCHED")) throw new Error("Expected MATCHED");
    if (result.findings.length !== 0) throw new Error("Expected no findings");
  });
  it("MISSING when no AIS positions exist", () => {
    const result = reconcileAisVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), ais_positions: [], reporting_year: 2026 });
    if (!hasEdge(result.edges, AIS_VOYAGE_EDGE, "MISSING")) throw new Error("Expected MISSING");
    if (!hasFinding(result.findings, "AIS_VOYAGE", "MISSING")) throw new Error("Expected MISSING finding");
  });
  it("CONFLICT when AIS gap is severe (>18h)", () => {
    const ais = [makeAis({ id: "a1", timestamp: "2026-01-01T12:00:00Z" }), makeAis({ id: "a2", timestamp: "2026-01-04T12:00:00Z" })];
    const result = reconcileAisVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), ais_positions: ais, reporting_year: 2026 });
    const maxGap = 72;
    if (maxGap <= 18) throw new Error("Test setup error: gap should be > 18h");
    if (!hasEdge(result.edges, AIS_VOYAGE_EDGE, "CONFLICT")) throw new Error("Expected CONFLICT for 72h gap");
    if (!hasFinding(result.findings, "AIS_VOYAGE", "CONFLICT")) throw new Error("Expected CONFLICT finding");
  });
  it("UNKNOWN when voyage has no timestamps", () => {
    const result = reconcileAisVoyage({ vessel_id: "vsl-1", voyage: makeVoyage({ departure_time: null, arrival_time: null }), ais_positions: [makeAis()], reporting_year: 2026 });
    if (!hasEdge(result.edges, AIS_VOYAGE_EDGE, "UNKNOWN")) throw new Error("Expected UNKNOWN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: Port Call ↔ Voyage reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Port Call ↔ Voyage", () => {
  it("MATCHED when port calls confirm both ports", () => {
    const pcs = [
      makePortCall({ id: "pc1", port: "Rotterdam", country: "NL", voyage_id: "voy-1", arrival_time: "2026-01-01T06:00:00Z", departure_time: "2026-01-01T18:00:00Z" }),
      makePortCall({ id: "pc2", port: "Hamburg", country: "DE", voyage_id: "voy-1", arrival_time: "2026-01-05T16:00:00Z", departure_time: "2026-01-05T20:00:00Z" }),
    ];
    const result = reconcilePortCallVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), port_calls: pcs, reporting_year: 2026 });
    if (!hasEdge(result.edges, PORTCALL_VOYAGE_EDGE, "MATCHED")) throw new Error("Expected MATCHED");
    if (result.findings.length !== 0) throw new Error("Expected no findings");
  });
  it("MISSING when no port calls exist", () => {
    const result = reconcilePortCallVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), port_calls: [], reporting_year: 2026 });
    if (!hasEdge(result.edges, PORTCALL_VOYAGE_EDGE, "MISSING")) throw new Error("Expected MISSING");
    if (!hasFinding(result.findings, "PORTCALL_VOYAGE", "MISSING")) throw new Error("Expected MISSING finding");
  });
  it("PARTIAL when port calls overlap but are not FK-linked", () => {
    const pcs = [makePortCall({ id: "pc1", voyage_id: "other-voyage", port: "Rotterdam", arrival_time: "2026-01-01T08:00:00Z", departure_time: "2026-01-02T08:00:00Z" })];
    const result = reconcilePortCallVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), port_calls: pcs, reporting_year: 2026 });
    if (!hasEdge(result.edges, PORTCALL_VOYAGE_EDGE, "PARTIAL")) throw new Error("Expected PARTIAL");
    if (!hasFinding(result.findings, "PORTCALL_VOYAGE", "REQUIRES_REVIEW")) throw new Error("Expected REQUIRES_REVIEW finding");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: Fuel Delivery / BDN ↔ Voyage reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Fuel Delivery ↔ Voyage", () => {
  it("MATCHED when delivery is FK-linked", () => {
    const fds = [makeFuelDelivery({ id: "fd1", voyage_id: "voy-1", quantity: 50 })];
    const result = reconcileFuelVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: fds, reporting_year: 2026 });
    if (!hasEdge(result.edges, "FUEL→VOYAGE", "MATCHED")) throw new Error("Expected MATCHED");
  });
  it("MISSING when no deliveries found", () => {
    const result = reconcileFuelVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: [], reporting_year: 2026 });
    if (!hasEdge(result.edges, "FUEL→VOYAGE", "MISSING")) throw new Error("Expected MISSING");
  });
  it("REQUIRES_REVIEW when deliveries overlap but are not FK-linked", () => {
    const fds = [makeFuelDelivery({ id: "fd1", voyage_id: null, quantity: 50, delivery_date: "2026-01-02T10:00:00Z" })];
    const result = reconcileFuelVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: fds, reporting_year: 2026 });
    if (!hasEdge(result.edges, "FUEL→VOYAGE", "PARTIAL")) throw new Error("Expected PARTIAL");
    if (!hasFinding(result.findings, "FUEL_VOYAGE", "REQUIRES_REVIEW")) throw new Error("Expected REQUIRES_REVIEW");
  });
  it("CONFLICT when delivery is attributed to multiple voyages", () => {
    const fds = [
      makeFuelDelivery({ id: "fd1", voyage_id: "voy-1", quantity: 50 }),
      makeFuelDelivery({ id: "fd2", voyage_id: "voy-1", quantity: 30 }),
    ];
    const result = reconcileFuelVoyage({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: fds, reporting_year: 2026 });
    if (!hasEdge(result.edges, "FUEL→VOYAGE", "CONFLICT")) throw new Error("Expected CONFLICT");
    if (!hasFinding(result.findings, "FUEL_DUPLICATE", "CONFLICT")) throw new Error("Expected FUEL_DUPLICATE finding");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7: Noon Report ↔ Voyage ↔ Consumption reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Noon ↔ Voyage ↔ Consumption", () => {
  it("MATCH when noon agrees with canonical consumption", () => {
    const noon = [makeNoonReport({ consumption: 12 })];
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileNoonConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), noon_reports: noon, consumption_rows: cons, reporting_year: 2026 });
    if (!hasEdge(result.edges, "NOON→CONSUMPTION", "MATCHED")) throw new Error("Expected MATCHED");
    if (result.findings.length !== 0) throw new Error("Expected no findings");
  });
  it("MISSING when no noon reports exist", () => {
    const result = reconcileNoonConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), noon_reports: [], consumption_rows: [makeConsumption()], reporting_year: 2026 });
    if (!hasEdge(result.edges, "NOON→VOYAGE", "MISSING")) throw new Error("Expected MISSING");
    if (!hasFinding(result.findings, "NOON_VOYAGE", "MISSING")) throw new Error("Expected MISSING finding");
  });
  it("CONFLICT when noon and canonical consumption diverge", () => {
    const noon = [makeNoonReport({ consumption: 20 })];
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileNoonConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), noon_reports: noon, consumption_rows: cons, reporting_year: 2026 });
    if (!hasEdge(result.edges, "NOON→CONSUMPTION", "CONFLICT")) throw new Error("Expected CONFLICT");
    if (!hasFinding(result.findings, "NOON_CONSUMPTION", "CONFLICT")) throw new Error("Expected CONFLICT finding");
  });
  it("MINOR_VARIANCE for small differences within 3%", () => {
    const noon = [makeNoonReport({ consumption: 20.55 })];
    const cons = [makeConsumption({ quantity_mt: 20, voyage_id: "voy-1" })];
    const voyage = makeVoyage();
    const result = reconcileNoonConsumption({ vessel_id: "vsl-1", voyage, noon_reports: noon, consumption_rows: cons, reporting_year: 2026 });
    if (!hasFinding(result.findings, "NOON_CONSUMPTION", "MINOR_VARIANCE")) throw new Error("Expected MINOR_VARIANCE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 8: BDN ↔ Consumption reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: BDN ↔ Consumption", () => {
  it("MATCHED when BDN matches canonical", () => {
    const fds = [makeFuelDelivery({ quantity: 12 })];
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileBdnConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: fds, consumption_rows: cons, reporting_year: 2026 });
    if (!hasEdge(result.edges, "BDN→CONSUMPTION", "MATCHED")) throw new Error("Expected MATCHED");
  });
  it("MISSING when no BDN but consumption exists", () => {
    const result = reconcileBdnConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: [], consumption_rows: [makeConsumption()], reporting_year: 2026 });
    if (!hasEdge(result.edges, "BDN→CONSUMPTION", "MISSING")) throw new Error("Expected MISSING");
    if (!hasFinding(result.findings, "BDN_CONSUMPTION", "MISSING")) throw new Error("Expected MISSING finding");
  });
  it("CONFLICT when BDN quantity differs from canonical", () => {
    const fds = [makeFuelDelivery({ quantity: 20 })];
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileBdnConsumption({ vessel_id: "vsl-1", voyage: makeVoyage(), fuel_deliveries: fds, consumption_rows: cons, reporting_year: 2026 });
    if (!hasEdge(result.edges, "BDN→CONSUMPTION", "CONFLICT")) throw new Error("Expected CONFLICT");
    if (!hasFinding(result.findings, "BDN_CONSUMPTION", "CONFLICT")) throw new Error("Expected CONFLICT finding");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 9-11: Cross-regulation consistency
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Cross-regulation consistency", () => {
  it("MATCHED when all three consume the same quantity", () => {
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileCrossRegulation({ vessel_id: "vsl-1", reporting_year: 2026, mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(), canonical_consumption: cons });
    if (!hasEdge(result.edges, "CROSS_REGULATION", "MATCHED")) throw new Error("Expected CROSS_REGULATION MATCHED");
    if (!hasEdge(result.edges, "CONSUMPTION→MRV", "MATCHED")) throw new Error("Expected MRV MATCHED");
    if (!hasEdge(result.edges, "CONSUMPTION→ETS", "MATCHED")) throw new Error("Expected ETS MATCHED");
    if (!hasEdge(result.edges, "CONSUMPTION→FUELEU", "MATCHED")) throw new Error("Expected FuelEU MATCHED");
  });
  it("CONFLICT when one module diverges", () => {
    const cons = [makeConsumption({ quantity_mt: 12 })];
    const result = reconcileCrossRegulation({ vessel_id: "vsl-1", reporting_year: 2026, mrv_snapshot: makeSnapshot({ total_consumption_mt: 12 }), ets_snapshot: makeSnapshot({ total_consumption_mt: 20 }), fueleu_snapshot: makeSnapshot({ total_consumption_mt: 12 }), canonical_consumption: cons });
    if (!hasEdge(result.edges, "CROSS_REGULATION", "CONFLICT")) throw new Error("Expected CONFLICT");
    if (!hasEdge(result.edges, "CONSUMPTION→ETS", "CONFLICT")) throw new Error("Expected ETS CONFLICT");
    if (!hasFinding(result.findings, "ETS_CONSUMPTION", "CONFLICT")) throw new Error("Expected ETS finding");
  });
  it("zero-zero consistency is MATCHED (no false UNKNOWN)", () => {
    const cons = [makeConsumption({ quantity_mt: 0 })];
    const result = reconcileCrossRegulation({ vessel_id: "vsl-1", reporting_year: 2026, mrv_snapshot: makeSnapshot({ total_consumption_mt: 0 }), ets_snapshot: makeSnapshot({ total_consumption_mt: 0 }), fueleu_snapshot: makeSnapshot({ total_consumption_mt: 0 }), canonical_consumption: cons });
    if (!hasEdge(result.edges, "CROSS_REGULATION", "MATCHED")) throw new Error("Zero-zero should produce MATCHED edge");
    if (hasFinding(result.findings, "CROSS_REGULATION", "CONFLICT")) throw new Error("Zero-zero should not produce CONFLICT finding");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 14-16: No auto-correction + resolution + idempotency
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: No auto-correction", () => {
  it("reconciliation engine never modifies source data", () => {
    const voyage = makeVoyage();
    const ais = [makeAis()];
    const pcs = [makePortCall()];
    const fds = [makeFuelDelivery()];
    const noon = [makeNoonReport()];
    const cons = [makeConsumption()];
    const engine = createReconciliationEngine();
    const result = engine.reconcile({
      vessel_id: "vsl-1", reporting_year: 2026, voyages: [voyage], ais_positions: ais, port_calls: pcs,
      fuel_deliveries: fds, noon_reports: noon, canonical_consumption: cons,
      mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(),
    });
    if (voyage.departure_port !== "Rotterdam") throw new Error("Voyage mutated");
    if (cons[0]!.quantity_mt !== 12) throw new Error("Consumption mutated");
    if (fds[0]!.quantity !== 50) throw new Error("Fuel delivery mutated");
  });
});

describe("Part 5: Idempotency — run twice, no duplicate keys", () => {
  it("same inputs produce same finding keys", () => {
    const engine = createReconciliationEngine();
    const input = {
      vessel_id: "vsl-1", reporting_year: 2026, voyages: [makeVoyage()], ais_positions: [makeAis()],
      port_calls: [makePortCall()], fuel_deliveries: [makeFuelDelivery()], noon_reports: [makeNoonReport()],
      canonical_consumption: [makeConsumption()],
      mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(),
    };
    const r1 = engine.reconcile(input);
    const r2 = engine.reconcile(input);
    const keys1 = new Set(r1.findings.map((f) => f.reconciliation_key));
    const keys2 = new Set(r2.findings.map((f) => f.reconciliation_key));
    if (keys1.size !== keys2.size) throw new Error(`Key count differs: ${keys1.size} vs ${keys2.size}`);
    for (const k of keys1) {
      if (!keys2.has(k)) throw new Error(`Key ${k} not in second run`);
    }
  });
  it("mergeWithExisting skips duplicates", () => {
    const f1 = { reconciliation_key: "k1", reconciliation_type: "AIS_VOYAGE" as const, vessel_id: "v1", voyage_id: null, reporting_year: 2026, status: "MATCH" as const, severity: "INFO" as const, expected_value: null, observed_value: null, difference: null, tolerance: null, unit: null, source_record_ids: [], affected_regulation: "ALL" as const, explanation: "", rule_version: null, tolerance_version: null, calculation_version: null };
    const result = mergeWithExisting([f1, f1], new Set(["k1"]));
    if (result.created.length !== 0) throw new Error("Should create 0");
    if (result.skipped !== 2) throw new Error("Should skip 2");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 17: Historical replay — versioning
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Historical replay", () => {
  it("finding carries rule_version, tolerance_version, calculation_version", () => {
    const engine = createReconciliationEngine();
    const result = engine.reconcile({
      vessel_id: "vsl-1", reporting_year: 2026, voyages: [makeVoyage()], ais_positions: [],
      port_calls: [], fuel_deliveries: [], noon_reports: [], canonical_consumption: [],
      mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(),
      rule_version: "r1", tolerance_version: "t1", calculation_version: "c1",
    });
    for (const f of result.findings) {
      if (f.rule_version !== "r1") throw new Error(`rule_version should be r1, got ${f.rule_version}`);
      if (f.tolerance_version !== "t1") throw new Error(`tolerance_version should be t1`);
      if (f.calculation_version !== "c1") throw new Error(`calculation_version should be c1`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 13: Severity classification
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Summary correctness", () => {
  it("counts match/conflict/missing correctly", () => {
    const engine = createReconciliationEngine();
    const result = engine.reconcile({
      vessel_id: "vsl-1", reporting_year: 2026, voyages: [makeVoyage()], ais_positions: [],
      port_calls: [], fuel_deliveries: [], noon_reports: [], canonical_consumption: [],
      mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(),
    });
    if (result.summary.total_findings !== result.findings.length) throw new Error("Summary count mismatch");
    const total = result.summary.match_count + result.summary.variance_count + result.summary.conflict_count + result.summary.missing_count + result.summary.unknown_count + result.summary.requires_review_count + result.summary.resolved_count;
    if (total !== result.summary.total_findings) throw new Error(`Status breakdown doesn't sum: ${total} vs ${result.summary.total_findings}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge statuses are deterministic
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Edge determinism", () => {
  it("reconciling the same data twice produces the same edge statuses", () => {
    const engine = createReconciliationEngine();
    const input = {
      vessel_id: "vsl-1", reporting_year: 2026, voyages: [makeVoyage()], ais_positions: [makeAis()],
      port_calls: [makePortCall()], fuel_deliveries: [makeFuelDelivery()], noon_reports: [makeNoonReport()],
      canonical_consumption: [makeConsumption()],
      mrv_snapshot: makeSnapshot(), ets_snapshot: makeSnapshot(), fueleu_snapshot: makeSnapshot(),
    };
    const r1 = engine.reconcile(input);
    const r2 = engine.reconcile(input);
    if (r1.edges.length !== r2.edges.length) throw new Error("Edge count differs");
    for (let i = 0; i < r1.edges.length; i++) {
      if (r1.edges[i]!.status !== r2.edges[i]!.status) throw new Error(`Edge ${i} status differs`);
      if (r1.edges[i]!.edge !== r2.edges[i]!.edge) throw new Error(`Edge ${i} name differs`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 15: Resolution workflow — resolve/reopen with audit trail
// ═══════════════════════════════════════════════════════════════════════════

describe("Part 5: Resolution workflow", () => {
  it("resolveFinding produces RESOLVED action with audit event", () => {
    let capturedAction: string | null = null;
    let capturedEntityId: string | null = null;
    const mockAuditLog = {
      insert: async (input: { action: string; entity_type: string; entity_id?: string | null; organization_id: string }) => {
        capturedAction = input.action;
        capturedEntityId = input.entity_id ?? null;
        return { id: "audit-1", organization_id: input.organization_id, actor_id: null, actor_email: null, action: input.action, entity_type: input.entity_type, entity_id: input.entity_id ?? null, before_data: {}, after_data: {}, source: "reconciliation-engine", correlation_id: null, recorded_at: new Date().toISOString() };
      },
      listByOrganization: async () => [],
      listByEntity: async () => [],
    };
    const resolution = createReconciliationResolution({ auditLog: mockAuditLog as never });
    const promise = resolution.resolveFinding("UNRESOLVED", {
      finding_key: "fk-1",
      vessel_id: "vsl-1",
      resolution_status: "RESOLVED",
      resolution_reason: "Verified with BDN",
      selected_evidence: ["bdn-1"],
      note: null,
      actor_id: "actor-1",
      actor_email: "test@example.com",
      organization_id: "org-1",
    });
    return promise.then((result) => {
      if (result.action !== "RESOLVED") throw new Error("Expected RESOLVED");
      if (result.previous_status !== "UNRESOLVED") throw new Error("Expected previous UNRESOLVED");
      if (result.new_status !== "RESOLVED") throw new Error("Expected new RESOLVED");
      if (capturedAction !== "reconciliation.finding.resolved") throw new Error("Expected audit action reconciliation.finding.resolved");
      if (capturedEntityId !== "fk-1") throw new Error("Expected audit entity_id fk-1");
    });
  });

  it("reopenFinding produces REOPENED action with audit trail", () => {
    let capturedBeforeData: Record<string, unknown> = {};
    let capturedAfterData: Record<string, unknown> = {};
    const mockAuditLog = {
      insert: async (input: { action: string; before_data?: Record<string, unknown>; after_data?: Record<string, unknown> }) => {
        capturedBeforeData = input.before_data ?? {};
        capturedAfterData = input.after_data ?? {};
        return { id: "audit-2", organization_id: "org-1", actor_id: null, actor_email: null, action: input.action, entity_type: "reconciliation_finding", entity_id: "fk-1", before_data: {}, after_data: {}, source: "reconciliation-engine", correlation_id: null, recorded_at: new Date().toISOString() };
      },
      listByOrganization: async () => [],
      listByEntity: async () => [],
    };
    const resolution = createReconciliationResolution({ auditLog: mockAuditLog as never });
    return resolution.reopenFinding("RESOLVED", {
      finding_key: "fk-1",
      vessel_id: "vsl-1",
      resolution_reason: "New evidence contradicts resolution",
      actor_id: "actor-1",
      actor_email: "test@example.com",
      organization_id: "org-1",
    }).then((result) => {
      if (result.action !== "REOPENED") throw new Error("Expected REOPENED");
      if (result.new_status !== "UNRESOLVED") throw new Error("Expected UNRESOLVED after reopen");
      if (capturedBeforeData["resolution_status"] !== "RESOLVED") throw new Error("Expected before_data.status RESOLVED");
      if (capturedAfterData["resolution_status"] !== "UNRESOLVED") throw new Error("Expected after_data.status UNRESOLVED");
    });
  });
});

run();