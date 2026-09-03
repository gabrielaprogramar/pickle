/**
 * pipeline.integration.test.ts — end-to-end FuelEU Maritime pipeline (Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Proves the PRODUCTION FuelEU pipeline now yields a defensible, scope-aware
 * result by running the REAL repository layer over the fake Supabase client,
 * mirroring the EU ETS pipeline:
 *
 *   • applicability is PRODUCED from the seeded `fueleu_scope` rule and
 *     persisted to `regulation_applicability`;
 *   • consumption is ATTRIBUTED via BDN evidence (canonical voyage_consumption,
 *     NEVER fuel_deliveries as consumption) and persisted;
 *   • port countries are resolved from `port_calls` via the SHARED EU ETS port
 *     classifier (no second classifier);
 *   • baseline/target/penalty come from versioned `regulatory_rules`;
 *   • the `fuel_eu_record` is persisted with UNKNOWN kept NULL (not 0), and
 *     is fully reconstructable via a lossless `getRecord`.
 *
 * Run via: npx tsx src/lib/fueleu/__tests__/pipeline.integration.test.ts
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
import { createFuelEuRecordRepository } from "@/lib/supabase/repositories/fuel_eu_records";
import { createAuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import { createCertificateRepository } from "@/lib/supabase/repositories/certificates";
import { FuelEuPipelineService, FuelEuPipelineError } from "@/lib/fueleu/pipeline";
import { FuelEUComplianceService } from "@/lib/fueleu/service";

const VESSEL_ID = "vessel-fueleu-it-001";
const VOYAGE_ID = "voyage-fueleu-it-001";
const ORG_ID = "org-fueleu-it-001";

function makeVessel(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VESSEL_ID,
    imo: "9991001",
    name: "FuelEU Carrier",
    mmsi: null,
    ship_id: null,
    gross_tonnage: 15000,
    flag: "NL",
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
    id: "fd-fueleu-it-001",
    document_id: "doc-fueleu-it-001",
    ocr_result_id: null,
    ai_extraction_id: null,
    vessel_id: VESSEL_ID,
    supplier: "Vitol",
    delivery_port: "Rotterdam",
    delivery_date: "2026-01-15",
    // A fuel with a defined WtW factor so the engine can resolve intensity.
    fuel_type: "vlsfo_rme180",
    quantity_mt: 100,
    density_kgm3: 990,
    sulphur_content_pct: 0.5,
    bdn_reference: "BDN-FUEL-001",
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
    id: "pc-fueleu-it-001",
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

/** FUEL_EU regulatory rules seeded by migration 0021. */
function makeFueleuRules() {
  return [
    {
      id: "rule-fueleu-scope",
      regulation: "FUEL_EU",
      rule_key: "fueleu_scope",
      version: 1,
      effective_from: "2025-01-01",
      effective_until: null,
      is_active: true,
      parameters: { applicable_gt_min: 5000, flag_exemptions: [], vessel_type_exemptions: [] },
      rule_text: "FuelEU scope",
      source_reference: "Regulation (EU) 2023/1805",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "rule-fueleu-baseline",
      regulation: "FUEL_EU",
      rule_key: "fueleu_baseline",
      version: 1,
      effective_from: "2025-01-01",
      effective_until: null,
      is_active: true,
      parameters: { baseline_ghg_intensity_gco2e_per_mj: 91.16 },
      rule_text: "FuelEU baseline GHG intensity",
      source_reference: "FuelEU Maritime delegated act (91.16)",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "rule-fueleu-target",
      regulation: "FUEL_EU",
      rule_key: "fueleu_target",
      version: 1,
      effective_from: "2025-01-01",
      effective_until: "2029-12-31",
      is_active: true,
      parameters: { reduction_pct: 0.02 },
      rule_text: "FuelEU 2025-2029 target (2%)",
      source_reference: "FuelEU Maritime Annex",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "rule-fueleu-penalty",
      regulation: "FUEL_EU",
      rule_key: "fueleu_penalty",
      version: 1,
      effective_from: "2025-01-01",
      effective_until: null,
      is_active: true,
      parameters: { penalty_eur_per_tonne_vlsfoe: 2400, is_estimate: true },
      rule_text: "FuelEU penalty rate (2400 EUR/tonne VLSFOe)",
      source_reference: "FuelEU Maritime penalty",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];
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
  pipeline: FuelEuPipelineService;
  client: ReturnType<typeof createFakeSupabaseClient>;
} {
  const client = createFakeSupabaseClient({
    tables: {
      vessels: opts.vessel ? [opts.vessel] : [makeVessel()],
      voyages: opts.voyages ?? [makeVoyage()],
      fuel_deliveries: opts.deliveries ?? [makeDelivery()],
      port_calls: opts.portCalls ?? [makePortCall()],
      regulatory_rules: opts.rules ?? makeFueleuRules(),
      noon_reports: opts.noonReports ?? [],
      regulation_applicability: [],
      voyage_consumption: [],
      fuel_eu_records: [],
      audit_log: [],
      certificate_registry: [],
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
    fuelEuRecords: createFuelEuRecordRepository({ client }),
    auditLog: createAuditLogRepository({ client }),
    certificates: createCertificateRepository({ client }),
    organizationId: opts.organizationId ?? ORG_ID,
  };
  return { pipeline: new FuelEuPipelineService(deps), client };
}

describe("FuelEuPipelineService — end-to-end happy path", () => {
  it("produces applicability + BDN consumption + a defensible scope-aware record", async () => {
    const { pipeline, client } = buildEnv();
    const result = await pipeline.run(VESSEL_ID, 2026);

    // Applicability produced + persisted (FUEL_EU, not a second rule system).
    const appRow = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "FUEL_EU")
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((appRow.data as { applicability: string } | null)?.applicability).toBe("APPLICABLE");

    // Consumption persisted from the canonical BDN path (never equal-share).
    const cons = await client
      .from("voyage_consumption")
      .select("*")
      .eq("vessel_id", VESSEL_ID);
    const consRows = (cons.data ?? []) as Array<{ fuel_type: string; quantity_mt: number; method: string; status: string }>;
    expect(consRows.length).toBe(1);
    expect(consRows[0]!.fuel_type).toBe("vlsfo_rme180");
    expect(consRows[0]!.quantity_mt).toBe(100);
    expect(consRows[0]!.method).toBe("BDN_TO_VOYAGE");

    // Port scope resolves via the shared classifier: intra-EU → factor 1.0.
    expect(result.voyage_contributions[0]?.scope_type).toBe("INTRA_EU");
    expect(result.voyage_contributions[0]?.scope_factor).toBe(1);
    expect(result.unknown_ports.length).toBe(0);

    // Target comes from the RULE (baseline 91.16 × (1 - 0.02) = 89.3368 → ~89.34).
    expect(result.target_gco2e_per_mj).toBeGreaterThan(0);
    expect((result.target_source ?? "")).toContainString("FuelEU");

    // vlsfo (87.5) < target → surplus, no penalty estimate.
    expect(result.compliance_status).toBe("SURPLUS");
    expect(result.compliance_balance).toBeGreaterThan(0);
    expect(result.penalty_exposure_estimate).toBeNull();
    expect(result.energy_input_mj).toBeGreaterThan(0);
    expect(result.ghg_intensity_gco2e_per_mj).toBeGreaterThan(0);

    // Immutable audit trail written.
    const audit = await client.from("audit_log").select("*").eq("entity_type", "fuel_eu_record");
    expect((audit.data ?? []).length).toBe(1);
  });
});

describe("FuelEuPipelineService — negatives / UNKNOWN preservation", () => {
  it("keeps intensity/energy NULL (not 0) when a port is unresolved", async () => {
    const { pipeline, client } = buildEnv({
      portCalls: [],
      voyages: [makeVoyage({ departure_port_name: "El Dorado", arrival_port_name: "Hamburg" })],
    });
    const result = await pipeline.run(VESSEL_ID, 2026);

    // FuelEU scope unresolved for the voyage → energy not counted → NULL.
    expect(result.voyage_contributions[0]?.scope_type).toBe("UNKNOWN");
    expect(result.unknown_ports.length).toBeGreaterThan(0);
    expect(result.energy_input_mj).toBeNull();
    expect(result.ghg_intensity_gco2e_per_mj).toBeNull();

    // Persisted record also stores NULL (not 0).
    const rec = await client
      .from("fuel_eu_records")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((rec.data as { energy_input_mj: number | null } | null)?.energy_input_mj).toBeNull();
    expect((rec.data as { ghg_intensity_gco2e_per_mj: number | null } | null)?.ghg_intensity_gco2e_per_mj).toBeNull();
  });

  it("MISSING_CONSUMPTION → DATA_INCOMPLETE (NULL aggregates), never equal-share of deliveries", async () => {
    const { pipeline, client } = buildEnv({
      voyages: [makeVoyage()],
      deliveries: [makeDelivery({ delivery_date: "2025-12-20", reconciled_voyage_id: null })],
    });
    const result = await pipeline.run(VESSEL_ID, 2026);

    const cons = await client.from("voyage_consumption").select("*").eq("vessel_id", VESSEL_ID);
    expect((cons.data ?? []).length).toBe(0);
    expect(result.compliance_status === "DATA_INCOMPLETE" || result.compliance_status === "UNKNOWN").toBe(true);
    expect(result.energy_input_mj).toBeNull();
  });

  it("throws FuelEuPipelineError (no hardcoded fallback) when the baseline rule is missing", async () => {
    const rules = makeFueleuRules().filter((r) => (r as { rule_key: string }).rule_key !== "fueleu_baseline");
    const { pipeline } = buildEnv({ rules });
    await expect(async () => pipeline.run(VESSEL_ID, 2026)).toThrow(FuelEuPipelineError);
  });

  it("out-of-scope vessel is NOT_APPLICABLE", async () => {
    const { pipeline } = buildEnv({ vessel: makeVessel({ gross_tonnage: 800 }) });
    const result = await pipeline.run(VESSEL_ID, 2026);
    expect(result.compliance_applicable).toBe(false);
    expect(result.compliance_status).toBe("NOT_APPLICABLE");
  });

  it("GT >= 5000 but all voyages NON_EU (no EU engagement) → NOT_APPLICABLE for the year", async () => {
    const { pipeline, client } = buildEnv({
      voyages: [
        makeVoyage({ departure_port_name: "Singapore", arrival_port_name: "Shanghai" }),
      ],
      portCalls: [
        { ...makePortCall(), id: "pc-sg", port_name: "Singapore", port_country: "SG" },
        { ...makePortCall(), id: "pc-cn", port_name: "Shanghai", port_country: "CN" },
      ],
      deliveries: [],
    });
    const result = await pipeline.run(VESSEL_ID, 2026);
    expect(result.compliance_status).toBe("NOT_APPLICABLE");
    expect(result.compliance_applicable).toBe(false);

    const appRow = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "FUEL_EU")
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((appRow.data as { applicability: string } | null)?.applicability).toBe("NOT_APPLICABLE");
  });

  it("GT >= 5000 with no voyage/port-call activity → REQUIRES_REVIEW (EU participation unproven)", async () => {
    const { pipeline, client } = buildEnv({ voyages: [], deliveries: [] });
    const result = await pipeline.run(VESSEL_ID, 2026);
    expect(result.compliance_status).toBe("REQUIRES_REVIEW");

    const appRow = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "FUEL_EU")
      .eq("reporting_year", 2026)
      .maybeSingle();
    expect((appRow.data as { applicability: string } | null)?.applicability).toBe("REQUIRES_REVIEW");
  });
});

describe("FuelEuPipelineService — lossless round-trip + idempotency", () => {
  it("reconstructs the full result via getRecord (no data loss)", async () => {
    const { pipeline, client } = buildEnv();
    await pipeline.run(VESSEL_ID, 2026);

    const service = new FuelEUComplianceService(createFuelEuRecordRepository({ client }));
    const rebuilt = await service.getRecord(VESSEL_ID, 2026);
    if (!rebuilt) throw new Error("Expected reconstructed record");
    expect(rebuilt.calculation_version).toBeTruthy();
    expect(rebuilt.compliance_status).toBe("SURPLUS");
    expect(rebuilt.energy_input_mj).toBeGreaterThan(0);
    expect(rebuilt.compliance_balance).toBeGreaterThan(0);
    expect(rebuilt.voyage_contributions.length).toBe(1);
    expect(rebuilt.voyage_contributions[0]?.scope_type).toBe("INTRA_EU");
    expect(rebuilt.penalty_exposure_estimate).toBeNull();
  });

  it("re-running does not duplicate applicability/consumption/record rows", async () => {
    const { pipeline, client } = buildEnv();

    await pipeline.run(VESSEL_ID, 2026);
    await pipeline.run(VESSEL_ID, 2026);

    const appRows = await client
      .from("regulation_applicability")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("regulation", "FUEL_EU")
      .eq("reporting_year", 2026);
    expect((appRows.data ?? []).length).toBe(1);

    const consRows = await client
      .from("voyage_consumption")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026);
    expect((consRows.data ?? []).length).toBe(1);

    const recRows = await client
      .from("fuel_eu_records")
      .select("*")
      .eq("vessel_id", VESSEL_ID)
      .eq("reporting_year", 2026);
    expect((recRows.data ?? []).length).toBe(1);
  });
});

run();
