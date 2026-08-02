/**
 * service.test.ts — NoonReportService orchestration tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Uses in-memory fakes for the noon repo, vessel repo and notification
 * dispatcher to verify create/latest/history and the evaluate pipeline
 * (persistence, deduplication, notification dispatch).
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/service.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { NoonReportService, type NoonReportRepository } from "../service";
import type { NoonReportDomain, NoonReportInsert, NoonReportRow, NoonReportUpdate } from "../types";
import {
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockEngineReference,
  mockVoyagePlan,
  MOCK_VESSEL_ID,
  MOCK_IMO,
  MOCK_VESSEL_NAME,
} from "../mock-data";

const NOW = "2026-08-01T13:00:00.000Z";
const CLEAN_DEDUP_KEY = "2026-08-01T12:00:00.000Z|10.5|106.8|32.4|860|14.2|82";

function rowFromDomain(d: NoonReportDomain, extra: Partial<NoonReportRow> = {}): NoonReportRow {
  return {
    id: d.id ?? "",
    vessel_id: d.vesselId ?? "",
    imo: d.imo,
    vessel_name: d.vesselName,
    report_date: d.reportDate,
    position_latitude: d.positionLatitude,
    position_longitude: d.positionLongitude,
    speed_knots: d.speedKnots,
    course_degrees: d.courseDegrees,
    distance_to_go_nm: d.distanceToGoNm,
    fuel_consumption_tonnes: d.fuelConsumptionTonnes,
    fuel_robs_tonnes: d.fuelRobsTonnes,
    engine_rpm: d.engineRpm,
    sea_state: d.seaState,
    wind_speed_knots: d.windSpeedKnots,
    wind_direction: d.windDirection,
    summary: d.summary,
    warnings: d.warnings,
    confidence: d.confidence,
    source: d.source,
    source_document_id: d.sourceDocumentId,
    review_state: d.reviewState,
    is_blocked: d.isBlocked,
    analysis: null,
    findings: [],
    fuel_correlation: null,
    voyage_correlation: null,
    fueleu_operational: null,
    ets_operational: null,
    evaluated_at: null,
    evaluation_version: null,
    dedup_key: null,
    created_at: NOW,
    updated_at: NOW,
    ...extra,
  };
}

function rowFor(d: NoonReportDomain, extra: Partial<NoonReportRow> = {}): NoonReportRow {
  return rowFromDomain(d, extra);
}

interface RepoFake {
  rows: NoonReportRow[];
  inserts: NoonReportInsert[];
  updates: Array<{ id: string; patch: NoonReportUpdate }>;
  repo: NoonReportRepository;
}

function makeRepo(initial: NoonReportRow[] = []): RepoFake {
  const rows = [...initial];
  const inserts: NoonReportInsert[] = [];
  const updates: Array<{ id: string; patch: NoonReportUpdate }> = [];
  const sorted = () =>
    rows
      .filter((r) => r.vessel_id === MOCK_VESSEL_ID)
      .sort((a, b) => b.report_date.localeCompare(a.report_date));

  return {
    rows,
    inserts,
    updates,
    repo: {
      async findById(id: string) {
        return rows.find((r) => r.id === id) ?? null;
      },
      async listByVesselId(vesselId: string, limit = 100) {
        return rows
          .filter((r) => r.vessel_id === vesselId)
          .sort((a, b) => b.report_date.localeCompare(a.report_date))
          .slice(0, limit);
      },
      async findLatestByVesselId(vesselId: string) {
        const list = rows
          .filter((r) => r.vessel_id === vesselId)
          .sort((a, b) => b.report_date.localeCompare(a.report_date));
        return list[0] ?? null;
      },
      async insert(input: NoonReportInsert): Promise<NoonReportRow> {
        inserts.push(input);
        const row: NoonReportRow = {
          id: `generated-${inserts.length}`,
          vessel_id: input.vessel_id,
          imo: input.imo,
          vessel_name: input.vessel_name ?? null,
          report_date: input.report_date,
          position_latitude: input.position_latitude ?? null,
          position_longitude: input.position_longitude ?? null,
          speed_knots: input.speed_knots ?? null,
          course_degrees: input.course_degrees ?? null,
          distance_to_go_nm: input.distance_to_go_nm ?? null,
          fuel_consumption_tonnes: input.fuel_consumption_tonnes ?? null,
          fuel_robs_tonnes: input.fuel_robs_tonnes ?? null,
          engine_rpm: input.engine_rpm ?? null,
          sea_state: input.sea_state ?? null,
          wind_speed_knots: input.wind_speed_knots ?? null,
          wind_direction: input.wind_direction ?? null,
          summary: input.summary ?? null,
          warnings: input.warnings ?? [],
          confidence: input.confidence ?? 0,
          source: input.source ?? "ai_extraction",
          source_document_id: input.source_document_id ?? null,
          review_state: input.review_state ?? null,
          is_blocked: input.is_blocked ?? false,
          analysis: input.analysis ?? null,
          findings: input.findings ?? [],
          fuel_correlation: input.fuel_correlation ?? null,
          voyage_correlation: input.voyage_correlation ?? null,
          fueleu_operational: input.fueleu_operational ?? null,
          ets_operational: input.ets_operational ?? null,
          evaluated_at: input.evaluated_at ?? null,
          evaluation_version: input.evaluation_version ?? null,
          dedup_key: input.dedup_key ?? null,
          created_at: NOW,
          updated_at: NOW,
        };
        rows.push(row);
        return row;
      },
      async update(id: string, patch: NoonReportUpdate): Promise<NoonReportRow> {
        updates.push({ id, patch });
        const idx = rows.findIndex((r) => r.id === id);
        const merged = { ...rows[idx]!, ...patch, updated_at: NOW } as NoonReportRow;
        rows[idx] = merged;
        return merged;
      },
    },
  };
}

function makeVesselRepo(vessels: Array<{ imo: string; id: string; name: string }>) {
  return {
    findByImo: async (imo: string) => vessels.find((v) => v.imo === imo) ?? null,
  };
}

function makeNotify() {
  const dispatched: Array<{ type: string; severity: string }> = [];
  return {
    dispatched,
    notify: {
      dispatch: async (event: { type: string; severity: string }) => {
        dispatched.push({ type: event.type, severity: event.severity });
      },
    },
  };
}

function makeService(overrides: {
  rows?: NoonReportRow[];
  vessels?: Array<{ imo: string; id: string; name: string }>;
  withNotify?: boolean;
} = {}) {
  const repo = makeRepo(overrides.rows ?? []);
  const vessels = overrides.vessels ?? [{ imo: MOCK_IMO, id: MOCK_VESSEL_ID, name: MOCK_VESSEL_NAME }];
  const notifyFake = makeNotify();
  const service = new NoonReportService({
    noonRepo: repo.repo,
    vesselRepo: makeVesselRepo(vessels),
    engineReference: mockEngineReference(),
    voyagePlanResolver: async () => mockVoyagePlan(),
    notify: overrides.withNotify ? notifyFake.notify : undefined,
  });
  return { repo, notifyFake, service };
}

describe("create", () => {
  it("throws when the vessel does not exist", async () => {
    const { service } = makeService({ vessels: [] });
    let thrown: unknown = null;
    try {
      await service.create(MOCK_IMO, mockNoonReportDomain(), { now: NOW });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeTruthy();
    expect((thrown as Error).message).toBe(`Vessel not found for IMO ${MOCK_IMO}`);
  });

  it("inserts the report with mapped columns", async () => {
    const { repo, service } = makeService();
    const row = await service.create(MOCK_IMO, mockNoonReportDomain(), { now: NOW });

    expect(row.id).toBe("generated-1");
    expect(row.vessel_id).toBe(MOCK_VESSEL_ID);
    expect(row.imo).toBe(MOCK_IMO);
    expect(repo.inserts.length).toBe(1);
    expect(repo.inserts[0]!.report_date).toBe("2026-08-01T12:00:00.000Z");
    expect(repo.inserts[0]!.fuel_consumption_tonnes).toBe(32.4);
    expect(repo.inserts[0]!.fuel_robs_tonnes).toBe(860);
    expect(repo.inserts[0]!.vessel_name).toBe(MOCK_VESSEL_NAME);
  });

  it("dispatches a report-received notification only when requested and wired", async () => {
    const { repo, notifyFake, service } = makeService({ withNotify: true });

    await service.create(MOCK_IMO, mockNoonReportDomain(), { now: NOW });
    expect(notifyFake.dispatched.length).toBe(0);

    await service.create(MOCK_IMO, mockNoonReportDomain({ id: "noon-002" }), {
      now: NOW,
      notifyReportReceived: true,
    });
    expect(notifyFake.dispatched.length).toBe(1);
    expect(notifyFake.dispatched[0]!.type).toBe("noon_report_received");
    expect(notifyFake.dispatched[0]!.severity).toBe("INFO");
    expect(repo.rows.length).toBe(2);
  });
});

describe("latest & history", () => {
  it("returns null / empty when the vessel does not exist", async () => {
    const { service } = makeService({ vessels: [] });
    expect(await service.latest(MOCK_IMO)).toBeNull();
    expect(await service.history(MOCK_IMO)).toEqual([]);
  });

  it("delegates to the repository", async () => {
    const previous = rowFor(mockPreviousNoonReport());
    const current = rowFor(mockNoonReportDomain());
    const { service } = makeService({ rows: [previous, current] });

    const latest = await service.latest(MOCK_IMO);
    expect(latest!.id).toBe("noon-001");

    const history = await service.history(MOCK_IMO, 10);
    expect(history.map((r) => r.id)).toEqual(["noon-001", "noon-000"]);
  });
});

describe("evaluate", () => {
  it("throws when the vessel does not exist", async () => {
    const { service } = makeService({ vessels: [] });
    let thrown: unknown = null;
    try {
      await service.evaluate(MOCK_IMO, { now: NOW });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe(`Vessel not found for IMO ${MOCK_IMO}`);
  });

  it("throws when there are no reports on file", async () => {
    const { service } = makeService();
    let thrown: unknown = null;
    try {
      await service.evaluate(MOCK_IMO, { now: NOW });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toContainString("No noon reports on file");
  });

  it("throws when the requested reportId is not found", async () => {
    const { service } = makeService({ rows: [rowFor(mockNoonReportDomain())] });
    let thrown: unknown = null;
    try {
      await service.evaluate(MOCK_IMO, { reportId: "noon-missing", now: NOW });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toContainString("noon-missing not found");
  });

  it("evaluates, persists and returns the full outcome", async () => {
    const { repo, service } = makeService({ rows: [rowFor(mockNoonReportDomain())] });
    const outcome = await service.evaluate(MOCK_IMO, { now: NOW });

    expect(outcome.wasDuplicated).toBe(false);
    expect(outcome.validator.score).toBe(95);
    expect(outcome.analysis.engineVersion).toBe("1.0.0");
    expect(outcome.findings.length).toBe(3);
    expect(repo.updates.length).toBe(1);
    expect(repo.updates[0]!.id).toBe("noon-001");
    expect(repo.updates[0]!.patch.evaluated_at).toBe(NOW);
    expect(repo.updates[0]!.patch.evaluation_version).toBe("1.0.0");
    expect(repo.updates[0]!.patch.dedup_key).toBe(CLEAN_DEDUP_KEY);
    expect(outcome.report.evaluated_at).toBe(NOW);
  });

  it("uses the previous report from the list and picks the requested reportId", async () => {
    const previous = rowFor(mockPreviousNoonReport());
    const current = rowFor(mockNoonReportDomain());
    const { service } = makeService({ rows: [previous, current] });

    const outcome = await service.evaluate(MOCK_IMO, { reportId: "noon-001", now: NOW });
    expect(outcome.domain.reportDate).toBe("2026-08-01T12:00:00.000Z");
    expect(outcome.fuel.robDeltaTonnes).toBe(32.4);
    expect(outcome.fuel.robState).toBe("CONSISTENT");
    expect(outcome.voyage.speedMadeGoodKnots).toBe(14.15);
  });

  it("skips persistence with persist:false", async () => {
    const { repo, service } = makeService({ rows: [rowFor(mockNoonReportDomain())] });
    const outcome = await service.evaluate(MOCK_IMO, { now: NOW, persist: false });

    expect(outcome.wasDuplicated).toBe(false);
    expect(repo.updates.length).toBe(0);
  });

  it("deduplicates a re-evaluation with an unchanged dedup key", async () => {
    const { repo, service } = makeService({ rows: [rowFor(mockNoonReportDomain())] });

    const first = await service.evaluate(MOCK_IMO, { now: NOW });
    expect(first.wasDuplicated).toBe(false);
    expect(repo.updates.length).toBe(1);

    const second = await service.evaluate(MOCK_IMO, { now: NOW });
    expect(second.wasDuplicated).toBe(true);
    expect(repo.updates.length).toBe(1);
    expect(second.report.evaluated_at).toBe(NOW);
  });

  it("dispatches notifications for mapping findings", async () => {
    const current = mockNoonReportDomain({
      windSpeedKnots: 35,
      windDirection: "SE",
      seaState: "ROUGH",
    });
    const { notifyFake, service } = makeService({
      rows: [rowFor(mockPreviousNoonReport()), rowFor(current)],
      withNotify: true,
    });

    const outcome = await service.evaluate(MOCK_IMO, { now: NOW });
    expect(outcome.findings.some((f) => f.id === "noon.weather.significant")).toBe(true);
    expect(notifyFake.dispatched.length).toBe(1);
    expect(notifyFake.dispatched[0]!.type).toBe("noon_heavy_weather");
    expect(notifyFake.dispatched[0]!.severity).toBe("MEDIUM");
  });

  it("does not dispatch notifications on a duplicated evaluation", async () => {
    const { repo, notifyFake, service } = makeService({
      rows: [rowFor(mockNoonReportDomain())],
      withNotify: true,
    });

    await service.evaluate(MOCK_IMO, { now: NOW });
    await service.evaluate(MOCK_IMO, { now: NOW });

    expect(repo.updates.length).toBe(1);
    expect(notifyFake.dispatched.length).toBe(0);
  });
});

run();
