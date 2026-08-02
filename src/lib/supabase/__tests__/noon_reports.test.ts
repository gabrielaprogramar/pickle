/**
 * noon_reports.test.ts — supabase NoonReportRepository tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Verifies persistence of noon reports through the in-memory fake Supabase
 * client: insert defaults, lookups, vessel-scoped listing with ordering and
 * limits, latest, updates, and upstream error mapping.
 *
 * Run via: npx tsx src/lib/supabase/__tests__/noon_reports.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createNoonReportRepository } from "../repositories/noon_reports";
import { RepositoryUpstreamError } from "../errors";
import type { NoonReportRow } from "../types";

const NOW = "2026-08-01T13:00:00.000Z";
const VESSEL_ID = "vessel-uuid-001";
const IMO = "9488754";

function makeRow(overrides: Partial<NoonReportRow> = {}): NoonReportRow {
  return {
    id: overrides.id ?? "noon-uuid-001",
    vessel_id: overrides.vessel_id ?? VESSEL_ID,
    imo: overrides.imo ?? IMO,
    vessel_name: overrides.vessel_name ?? "POSEIDON PIONEER",
    report_date: overrides.report_date ?? "2026-08-01T12:00:00.000Z",
    position_latitude: overrides.position_latitude ?? 10.5,
    position_longitude: overrides.position_longitude ?? 106.8,
    speed_knots: overrides.speed_knots ?? 14.2,
    course_degrees: overrides.course_degrees ?? 295,
    distance_to_go_nm: overrides.distance_to_go_nm ?? 1100,
    fuel_consumption_tonnes: overrides.fuel_consumption_tonnes ?? 32.4,
    fuel_robs_tonnes: overrides.fuel_robs_tonnes ?? 860,
    engine_rpm: overrides.engine_rpm ?? 82,
    sea_state: overrides.sea_state ?? "MODERATE",
    wind_speed_knots: overrides.wind_speed_knots ?? 18,
    wind_direction: overrides.wind_direction ?? "NE",
    summary: overrides.summary ?? "All systems normal.",
    warnings: overrides.warnings ?? [],
    confidence: overrides.confidence ?? 0.94,
    source: overrides.source ?? "ai_extraction",
    source_document_id: overrides.source_document_id ?? null,
    review_state: overrides.review_state ?? null,
    is_blocked: overrides.is_blocked ?? false,
    analysis: overrides.analysis ?? null,
    findings: overrides.findings ?? [],
    fuel_correlation: overrides.fuel_correlation ?? null,
    voyage_correlation: overrides.voyage_correlation ?? null,
    fueleu_operational: overrides.fueleu_operational ?? null,
    ets_operational: overrides.ets_operational ?? null,
    evaluated_at: overrides.evaluated_at ?? null,
    evaluation_version: overrides.evaluation_version ?? null,
    dedup_key: overrides.dedup_key ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

describe("NoonReportRepository — insert", () => {
  it("inserts a report and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createNoonReportRepository({ client: fake });

    const row = await repo.insert({
      vessel_id: VESSEL_ID,
      imo: IMO,
      report_date: "2026-08-01T12:00:00.000Z",
      position_latitude: 10.5,
      position_longitude: 106.8,
      fuel_consumption_tonnes: 32.4,
      fuel_robs_tonnes: 860,
      speed_knots: 14.2,
      engine_rpm: 82,
      confidence: 0.94,
      warnings: ["high swell"],
    });

    expect(row.id).toBeTruthy();
    expect(row.vessel_id).toBe(VESSEL_ID);
    expect(row.imo).toBe(IMO);
    expect(row.fuel_consumption_tonnes).toBe(32.4);
    expect(row.fuel_robs_tonnes).toBe(860);
    expect(row.warnings).toEqual(["high swell"]);
  });

  it("applies the fake defaults for omitted columns", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createNoonReportRepository({ client: fake });

    const row = await repo.insert({ vessel_id: VESSEL_ID, imo: IMO, report_date: "2026-08-01T12:00:00.000Z" });

    expect(row.vessel_name).toBeNull();
    expect(row.position_latitude).toBeNull();
    expect(row.position_longitude).toBeNull();
    expect(row.warnings).toEqual([]);
    expect(row.confidence).toBe(0);
    expect(row.source).toBe("ai_extraction");
    expect(row.is_blocked).toBe(false);
    expect(row.analysis).toBeNull();
    expect(row.findings).toEqual([]);
    expect(row.evaluated_at).toBeNull();
    expect(row.evaluation_version).toBeNull();
    expect(row.dedup_key).toBeNull();
  });
});

describe("NoonReportRepository — findById", () => {
  it("returns the report when it exists", async () => {
    const fake = createFakeSupabaseClient({ tables: { noon_reports: [makeRow({ id: "noon-001" })] } });
    const repo = createNoonReportRepository({ client: fake });

    const row = await repo.findById("noon-001");
    expect(row).toBeTruthy();
    expect(row!.id).toBe("noon-001");
    expect(row!.fuel_consumption_tonnes).toBe(32.4);
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createNoonReportRepository({ client: fake });

    expect(await repo.findById("noon-missing")).toBeNull();
  });
});

describe("NoonReportRepository — listByVesselId", () => {
  it("returns only rows for the vessel, ordered by report_date descending", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        noon_reports: [
          makeRow({ id: "n3", report_date: "2026-08-01T12:00:00.000Z" }),
          makeRow({ id: "n1", report_date: "2026-07-30T12:00:00.000Z" }),
          makeRow({ id: "n2", report_date: "2026-07-31T12:00:00.000Z" }),
          makeRow({ id: "other", vessel_id: "other-vessel" }),
        ],
      },
    });
    const repo = createNoonReportRepository({ client: fake });

    const rows = await repo.listByVesselId(VESSEL_ID);
    expect(rows.map((r) => r.id)).toEqual(["n3", "n2", "n1"]);
  });

  it("respects the limit", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        noon_reports: [
          makeRow({ id: "n3", report_date: "2026-08-01T12:00:00.000Z" }),
          makeRow({ id: "n2", report_date: "2026-07-31T12:00:00.000Z" }),
          makeRow({ id: "n1", report_date: "2026-07-30T12:00:00.000Z" }),
        ],
      },
    });
    const repo = createNoonReportRepository({ client: fake });

    const rows = await repo.listByVesselId(VESSEL_ID, 2);
    expect(rows.map((r) => r.id)).toEqual(["n3", "n2"]);
  });

  it("returns an empty array for a vessel with no reports", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createNoonReportRepository({ client: fake });

    expect(await repo.listByVesselId(VESSEL_ID)).toEqual([]);
  });
});

describe("NoonReportRepository — findLatestByVesselId", () => {
  it("returns the most recent report for the vessel", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        noon_reports: [
          makeRow({ id: "n3", report_date: "2026-08-01T12:00:00.000Z" }),
          makeRow({ id: "n1", report_date: "2026-07-30T12:00:00.000Z" }),
          makeRow({ id: "n2", report_date: "2026-07-31T12:00:00.000Z" }),
        ],
      },
    });
    const repo = createNoonReportRepository({ client: fake });

    const row = await repo.findLatestByVesselId(VESSEL_ID);
    expect(row!.id).toBe("n3");
  });

  it("returns null when the vessel has no reports", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createNoonReportRepository({ client: fake });

    expect(await repo.findLatestByVesselId(VESSEL_ID)).toBeNull();
  });
});

describe("NoonReportRepository — update", () => {
  it("updates the evaluation columns and returns the merged row", async () => {
    const existing = makeRow({ id: "noon-001" });
    const fake = createFakeSupabaseClient({ tables: { noon_reports: [existing] } });
    const repo = createNoonReportRepository({ client: fake });

    const updated = await repo.update("noon-001", {
      analysis: { engineVersion: "1.0.0" },
      dedup_key: "dk-1",
      evaluated_at: NOW,
      evaluation_version: "1.0.0",
    });

    expect(updated.evaluated_at).toBe(NOW);
    expect(updated.evaluation_version).toBe("1.0.0");
    expect(updated.dedup_key).toBe("dk-1");
    expect(updated.analysis).toEqual({ engineVersion: "1.0.0" });
    expect(updated.fuel_consumption_tonnes).toBe(32.4);
  });

  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createNoonReportRepository({ client: fake });

    await expect(async () =>
      repo.insert({ vessel_id: VESSEL_ID, imo: IMO, report_date: "2026-08-01T12:00:00.000Z" }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
