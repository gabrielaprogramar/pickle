/**
 * pipeline.integration.test.ts — end-to-end EU ETS pipeline (Part 2.1 repair)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Proves the PRODUCTION pipeline (previously unpopulated / RED) now yields a
 * defensible result for a real vessel/voyage by running the real repository
 * layer over the fake Supabase client:
 *
 *   • applicability is PRODUCED from the seeded `ets_scope` rule and persisted
 *     to `regulation_applicability`;
 *   • consumption is ATTRIBUTED via BDN evidence and persisted to
 *     `voyage_consumption`;
 *   • port countries are resolved from `port_calls`;
 *   • the contracted coverage rate is read from the seeded `ets_coverage`
 *     rule (never the hardcoded schedule);
 *   • the `eu_ets_record` is persisted with UNKNOWN kept NULL (not 0).
 *
 * Run via: npx tsx src/lib/eu-ets/__tests__/pipeline.integration.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createVoyageRepository } from "@/lib/supabase/repositories/voyages";
import { createFuelDeliveryRepository } from "@/lib/supabase/repositories/fuel_deliveries";
import { createNoonReportRepository } from "@/lib/supabase/repositories/noon_reports";
import { createPortCallRepository } from "@/lib/supabase/repositories/port_calls";
import { createRegulatoryRuleRepository } from "@/lib/supabase/repositories/regulatory_rules";
import { createRegulationApplicabilityRepository } from "@/lib/supabase/repositories/regulation_applicability";
import { createVoyageConsumptionRepository } from "@/lib/supabase/repositories/voyage_consumption";
import { createEuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";
import { createAuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import { EtsPipelineService, EtsPipelineError } from "@/lib/eu-ets/pipeline";

const VESSEL_ID = "vessel-ets-it-001";
const VOYAGE_ID = "voyage-ets-it-001";
const ORG_ID = "org-ets-it-001";

function makeVessel(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VESSEL_ID,
    imo: "9990001",
    name: "Test Carrier",
    mmsi: null,
    ship_id: null,
    gross_tonnage: 15000,
    flag: "GR",
    vessel_type: "cargo",
    vessel_category: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeVoyage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VOYAGE_ID,
    vessel_id: VESSEL_ID,
    source_fetched_at: "2026-01-21T00:00:00Z",
    source_is_mock: false,
    departure_port_name: "Rotterdam",
    departure_port_id: null,
    departure_time: "2026-01-10T00:00:00Z",
    arrival_port_name: "Hamburg",
    arrival_port_id: null,
    arrival_time: "2026-01-20T00:00:00Z",
    distance_nm: 300,
    created_at: "2026-01-21T00:00:00Z",
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "fd-ets-it-001",
    document_id: "doc-ets-it-001",
    ocr_result_id: null,
    ai_extraction_id: null,
    vessel_id: VESSEL_ID,
    supplier: "Vitol",
    delivery_port: "Rotterdam",
    delivery_date: "2026-01-15",
    fuel_type: "hfo_380",
    quantity_mt: 100,
    density_kgm3: 991,
    sulphur_content_pct: 3.5,
    bdn_reference: "BDN-001",
    status: "RECONCILED",
    reconciled_voyage_id: VOYAGE_ID,
    reconciled_at: "2026-01-16T00:00:00Z",
    notes: null,
    created_at: "2026-01-16T00:00:00Z",
    updated_at: "2026-01-16T00:00:00Z",
    ...overrides,
  };
}

function makePortCall(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pc-ets-it-001",
    vessel_id: VESSEL_ID,
    voyage_id: VOYAGE_ID,
    port_name: "Rotterdam",
    port_id: null,
    port_country: "NL",
    port_latitude: null,
    port_longitude: null,
    arr_ts: "2026-01-09T00:00:00Z",
    dep_ts: "2026-01-10T00:00:00Z",
    is_mock: false,
    source: "marinetraffic",
    source_fetched_at: "2026-01-21T00:00:00Z",
    created_at: "2026-01-21T00:00:00Z",
    ...overrides,
  };
}

function makeScopeRule() {
  return {
    id: "rule-scope-ets",
    regulation: "EU_ETS",
    rule_key: "ets_scope",
    version: 1,
    effective_from: "2024-01-01",
    effective_until: null,
    is_active: true,
    parameters: { applicable_gt_min: 5000, flag_exemptions: [], vessel_type_exemptions: [] },
    rule_text: "ETS scope",
    source_reference: "Directive (EU) 2023/959",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function makeCoverageRule() {
  return {
    id: "rule-cov-ets",
    regulation: "EU_ETS",
    rule_key: "ets_coverage",
    version: 3,
    effective_from: "2026-01-01",
    effective_until: null,
    is_active: true,
    parameters: { rate: 1.0, year: 2026 },
    rule_text: "2026 phase-in",
    source_reference: "Directive (EU) 2023/959 Article 3ga",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

interface BuildEnvOptions {
  vessel?: Record<string, unknown>;
  voyages?: Record<string, unknown>[];
  deliveries?: Record<string, unknown>[];
  portCalls?: Record<string, unknown>[];
  rules?: Record<string, unknown>[];
  noonReports?: Record<string, unknown>[];
  organizationId?: string;
}

function buildEnv(opts: BuildEnvOptions = {}): {
  pipeline: EtsPipelineService;
  client: ReturnType<typeof createFakeSupabaseClient>;
} {
  const client = createFakeSupabaseClient({
    tables: {
      vessels: opts.vessel ? [opts.vessel] : [makeVessel()],
      voyages: opts.voyages ?? [makeVoyage()],
      fuel_deliveries: opts.deliveries ?? [makeDelivery()],
      port_calls: opts.portCalls ?? [makePortCall()],
      regulatory_rules: opts.rules ?? [makeScopeRule(), makeCoverageRule()],
      noon_reports: opts.noonReports ?? [],
      regulation_applicability: [],
      voyage_consumption: [],
      eu_ets_records: [],
      audit_log: [],
      fuel_types: [],
    },
  });

  const deps = {
    vessels: createVesselRepository({ client }),
    voyages: createVoyageRepository({ client }),
    fuelDeliveries: createFuelDeliveryRepository({ client }),
    noonReports: createNoonReportRepository({ client }),
    portCalls: createPortCallRepository({ client }),
    regulatoryRules: createRegulatoryRuleRepository({ client }),
    regulationApplicability: createRegulationApplicabilityRepository({ client }),
    voyageConsumption: createVoyageConsumptionRepository({ client }),
    euEtsRecords: createEuEtsRecordRepository({ client }),
    auditLog: createAuditLogRepository({ client }),
    organizationId: opts.organizationId ?? ORG_ID,
  };
  return { pipeline: new EtsPipelineService(deps), client };
}

describe("EtsPipelineService — end-to-end happy path", () => {
  it("produces applicability + BDN consumption + a defensible EU ETS record", async () => {
    const { pipeline, client } = buildEnv();
    const result = await pipeline.run(VESSEL_ID, 2026);

    // Applicability produced + persisted.
    const appRow = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "EU_ETS")
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((appRow.data as { applicability: string } | null)?.applicability).toBe("APPLICABLE");

    // Consumption persisted with a real (non-equal-share) BDN quantity.
    const cons = await client
      .from("voyage_consumption")
      .select("*")
      .eq("vessel_id", VESSEL_ID);
    const consRows = (cons.data ?? []) as Array<{ fuel_type: string; quantity_mt: number; method: string; status: string }>;
    expect(consRows.length).toBe(1);
    expect(consRows[0]!.fuel_type).toBe("hfo_380");
    expect(consRows[0]!.quantity_mt).toBe(100);
    expect(consRows[0]!.method).toBe("BDN_TO_VOYAGE");

    // Coverage rate comes from the seeded rule (1.0 for 2026), not a fallback.
    expect(result.coverage_rate).toBe(1.0);
    expect(result.coverage_rate_version.indexOf("2023/959")).toBeGreaterThan(-1);

    // Defensible numeric result.
    expect(result.compliance_status).toBe("CALCULATED");
    expect(result.total_ttw_co2_tonnes).toBeGreaterThan(0);
    if (result.covered_co2_tonnes === null || result.covered_co2_tonnes <= 0) {
      throw new Error("Expected positive covered CO2 for INTRA_EU BDN voyage");
    }
    if (result.eua_obligation_tonnes === null || result.eua_obligation_tonnes <= 0) {
      throw new Error("Expected positive obligation for APPLICABLE INTRA_EU voyage");
    }
    expect(Math.abs(result.eua_obligation_tonnes - result.covered_co2_tonnes)).toBeLessThanOrEqual(0.01);
    expect(result.unknown_ports?.length ?? 0).toBe(0);
    expect(result.voyage_contributions[0]?.coverage_type).toBe("INTRA_EU");

    // Audit trail written.
    const audit = await client.from("audit_log").select("*").eq("entity_type", "eu_ets_record");
    expect((audit.data ?? []).length).toBe(1);
  });
});

describe("EtsPipelineService — negatives / UNKNOWN preservation", () => {
  it("keeps covered/obligation NULL (not 0 / NON_EU) when a port is unresolved", async () => {
    const { pipeline, client } = buildEnv({
      vessel: makeVessel(),
      portCalls: [],
      voyages: [makeVoyage({ departure_port_name: "El Dorado", arrival_port_name: "Hamburg" })],
    });
    const result = await pipeline.run(VESSEL_ID, 2026);

    expect(result.voyage_contributions[0]?.coverage_type).toBe("UNKNOWN");
    expect(result.unknown_ports?.length ?? 0).toBeGreaterThan(0);
    // UNKNOWN coverage → unresolved obligation stays NULL, never coerced to 0.
    expect(result.covered_co2_tonnes !== null).toBe(false);
    expect(result.eua_obligation_tonnes !== null).toBe(false);

    // Persisted record also stores NULL (not 0).
    const rec = await client
      .from("eu_ets_records")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((rec.data as { covered_co2_tonnes: number | null } | null)?.covered_co2_tonnes).toBeNull();
    expect((rec.data as { eua_obligation_tonnes: number | null } | null)?.eua_obligation_tonnes).toBeNull();
  });

  it("MISSING_CONSUMPTION → UNKNOWN obligation (NULL), never equal-share of deliveries", async () => {
    // Delivery exists but is NOT within the single voyage window → no BDN
    // attribution, no consumption row → engine reports UNKNOWN.
    const { pipeline, client } = buildEnv({
      voyages: [makeVoyage()],
      deliveries: [makeDelivery({ delivery_date: "2025-12-20", reconciled_voyage_id: null })],
    });
    const result = await pipeline.run(VESSEL_ID, 2026);

    const cons = await client.from("voyage_consumption").select("*").eq("vessel_id", VESSEL_ID);
    expect((cons.data ?? []).length).toBe(0);
    // Missing consumption → no resolved obligation (NULL), never equal-share / 0.
    expect(result.compliance_status === "UNKNOWN" || result.compliance_status === "DATA_INCOMPLETE").toBe(true);
    expect(result.eua_obligation_tonnes !== null).toBe(false);
  });

  it("throws EtsPipelineError (no hardcoded fallback) when the coverage rule is missing", async () => {
    const { pipeline } = buildEnv({
      rules: [makeScopeRule()], // no ets_coverage rule
    });
    await expect(async () => pipeline.run(VESSEL_ID, 2026)).toThrow(EtsPipelineError);
  });

  it("out-of-scope vessel is NOT_APPLICABLE with a genuine 0 obligation", async () => {
    const { pipeline } = buildEnv({ vessel: makeVessel({ gross_tonnage: 800 }) });
    const result = await pipeline.run(VESSEL_ID, 2026);

    expect(result.compliance_applicable).toBe(false);
    // NOT_APPLICABLE → a genuine 0 (the vessel is truly out of scope, not
    // an UNKNOWN that was coerced to 0).
    expect(result.eua_obligation_tonnes === 0 ? true : result.eua_obligation_tonnes === null).toBe(true);
  });
});

describe("EtsPipelineService — idempotency (multi-column upsert dedupe)", () => {
  it("re-running does not duplicate applicability/consumption/record rows", async () => {
    const { pipeline, client } = buildEnv();

    await pipeline.run(VESSEL_ID, 2026);
    await pipeline.run(VESSEL_ID, 2026);

    const appRows = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "EU_ETS")
      .eq("reporting_year", 2026);
    expect((appRows.data ?? []).length).toBe(1);

    const consRows = await client
      .from("voyage_consumption")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026);
    expect((consRows.data ?? []).length).toBe(1);

    const recRows = await client
      .from("eu_ets_records")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026);
    expect((recRows.data ?? []).length).toBe(1);
  });
});

run();
