/**
 * routes.test.ts — Noon Report Intelligence API routes
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Exercises GET /api/vessels/[imo]/noon (collection), /noon/latest,
 * /noon/history, POST /noon (ingest) and POST /noon/evaluate, mirroring the
 * certificates route-test DI pattern with in-memory fakes.
 *
 * Run via: npx tsx "src/app/api/vessels/[imo]/noon/__tests__/routes.test.ts"
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { NoonReportService, type NoonReportRepository } from "@/lib/noon-report";
import type { NoonReportDomain, NoonReportInsert, NoonReportRow, NoonReportUpdate } from "@/lib/noon-report";
import {
  mockNoonReportDomain,
  mockPreviousNoonReport,
  mockEngineReference,
  mockVoyagePlan,
  MOCK_IMO,
  MOCK_VESSEL_ID,
  MOCK_VESSEL_NAME,
} from "@/lib/noon-report";
import { GET as getCollection, POST as postCollection } from "../route";
import { GET as getLatest } from "../latest/route";
import { GET as getHistory } from "../history/route";
import { POST as postEvaluate } from "../evaluate/route";
import type { NoonApiDeps } from "../_lib";

const NOW = "2026-08-01T13:00:00.000Z";

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

function makeRepo(initial: NoonReportRow[] = []) {
  const rows = [...initial];
  const inserts: NoonReportInsert[] = [];
  return {
    rows,
    inserts,
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
        const row: NoonReportRow = rowFromDomain(mockNoonReportDomain(), {
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
        });
        rows.push(row);
        return row;
      },
      async update(id: string, patch: NoonReportUpdate): Promise<NoonReportRow> {
        const idx = rows.findIndex((r) => r.id === id);
        const merged = { ...rows[idx]!, ...patch, updated_at: NOW } as NoonReportRow;
        rows[idx] = merged;
        return merged;
      },
    } satisfies NoonReportRepository,
  };
}

function buildDeps(opts: { rows?: NoonReportRow[] } = {}) {
  const repo = makeRepo(opts.rows ?? []);
  const vesselRepo = {
    async findByImo(imo: string) {
      return imo === MOCK_IMO ? { id: MOCK_VESSEL_ID, name: MOCK_VESSEL_NAME } : null;
    },
  };
  const service = new NoonReportService({
    noonRepo: repo.repo,
    vesselRepo,
    engineReference: mockEngineReference(),
    voyagePlanResolver: async () => mockVoyagePlan(),
  });
  const deps: NoonApiDeps = { service, vesselRepo, noonRepo: repo.repo };
  return { deps, repo };
}

function request(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

function jsonRequest(url: string, body: unknown): Request {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validExtraction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    extractionFields: {
      imoNumber: MOCK_IMO,
      vesselName: MOCK_VESSEL_NAME,
      reportDate: "2026-08-01T12:00:00.000Z",
      positionLatitude: "10.5",
      positionLongitude: "106.8",
      speedKnots: "14.2",
      courseDegrees: "295",
      distanceToGoNm: "1100",
      fuelConsumptionTonnes: "32.4",
      fuelRobsTonnes: "860",
      engineRpm: "82",
      seaState: "MODERATE",
      windSpeedKnots: "18",
      windDirection: "NE",
      summary: "All systems normal.",
      ...(overrides as Record<string, unknown>),
    },
    confidence: 0.94,
    warnings: [],
    missingFields: [],
    documentId: null,
  };
}

describe("GET /api/vessels/[imo]/noon", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await getCollection(
      request(`https://example.com/api/vessels/0000000/noon`),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("returns an empty latest/history for a known vessel", async () => {
    const { deps } = buildDeps();
    const response = await getCollection(
      request(`https://example.com/api/vessels/${MOCK_IMO}/noon`),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.imo).toBe(MOCK_IMO);
    expect(body.data.latest).toBeNull();
    expect(body.data.history).toEqual([]);
    expect(body.data.historyCount).toBe(0);
  });

  it("returns the latest and history for a seeded vessel", async () => {
    const previous = rowFromDomain(mockPreviousNoonReport());
    const current = rowFromDomain(mockNoonReportDomain());
    const { deps } = buildDeps({ rows: [previous, current] });

    const response = await getCollection(
      request(`https://example.com/api/vessels/${MOCK_IMO}/noon?limit=1`),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.latest.id).toBe("noon-001");
    expect(body.data.history.map((r: { id: string }) => r.id)).toEqual(["noon-001"]);
    expect(body.data.historyCount).toBe(1);
  });
});

describe("GET /api/vessels/[imo]/noon/latest", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await getLatest(
      request(`https://example.com/api/vessels/0000000/noon/latest`),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
  });

  it("returns report null when the vessel has no reports", async () => {
    const { deps } = buildDeps();
    const response = await getLatest(
      request(`https://example.com/api/vessels/${MOCK_IMO}/noon/latest`),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.latest).toBeNull();
  });

  it("returns the most recent report", async () => {
    const { deps } = buildDeps({ rows: [rowFromDomain(mockPreviousNoonReport()), rowFromDomain(mockNoonReportDomain())] });
    const response = await getLatest(
      request(`https://example.com/api/vessels/${MOCK_IMO}/noon/latest`),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.latest.id).toBe("noon-001");
    expect(body.data.latest.fuel_consumption_tonnes).toBe(32.4);
  });
});

describe("GET /api/vessels/[imo]/noon/history", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await getHistory(
      request(`https://example.com/api/vessels/0000000/noon/history`),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
  });

  it("returns the ordered history with a limit", async () => {
    const { deps } = buildDeps({
      rows: [
        rowFromDomain(mockPreviousNoonReport()),
        rowFromDomain(mockNoonReportDomain()),
      ],
    });
    const response = await getHistory(
      request(`https://example.com/api/vessels/${MOCK_IMO}/noon/history?limit=1`),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.count).toBe(1);
    expect(body.data.history[0].id).toBe("noon-001");
  });
});

describe("POST /api/vessels/[imo]/noon", () => {
  it("rejects a missing report body", async () => {
    const { deps } = buildDeps();
    const response = await postCollection(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon`, {}),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid JSON", async () => {
    const { deps } = buildDeps();
    const response = await postCollection(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon`, "not json"),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await postCollection(
      jsonRequest(`https://example.com/api/vessels/0000000/noon`, { report: validExtraction() }),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("rejects a report whose IMO does not match the vessel", async () => {
    const { deps } = buildDeps();
    const response = await postCollection(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon`, {
        report: validExtraction({ imoNumber: "9999999" }),
      }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContainString("does not match vessel IMO");
  });

  it("creates a report from an extraction payload", async () => {
    const { deps, repo } = buildDeps();
    const response = await postCollection(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon`, {
        report: validExtraction(),
        notifyReportReceived: false,
      }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.report.imo).toBe(MOCK_IMO);
    expect(body.data.report.vessel_id).toBe(MOCK_VESSEL_ID);
    expect(body.data.report.report_date).toBe("2026-08-01T12:00:00.000Z");
    expect(body.data.report.fuel_consumption_tonnes).toBe(32.4);
    expect(body.data.missingFields).toEqual([]);
    expect(body.data.dataConfidence).toBe(0.94);
    expect(repo.inserts.length).toBe(1);
    expect(repo.inserts[0]!.vessel_id).toBe(MOCK_VESSEL_ID);
  });
});

describe("POST /api/vessels/[imo]/noon/evaluate", () => {
  it("rejects invalid JSON", async () => {
    const { deps } = buildDeps();
    const response = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, "not json"),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("rejects non-string reportId / non-boolean persist", async () => {
    const { deps } = buildDeps();
    const response = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, { reportId: 42, persist: "yes" }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/0000000/noon/evaluate`, {}),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("evaluates the latest report and persists the output", async () => {
    const { deps, repo } = buildDeps({ rows: [rowFromDomain(mockNoonReportDomain())] });
    const response = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, { now: NOW }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.wasDuplicated).toBe(false);
    expect(body.data.validator.score).toBe(95);
    expect(body.data.analysis.engineVersion).toBe("1.0.0");
    expect(body.data.report.evaluated_at).toBe(NOW);
    expect(body.data.findings.length).toBe(3);
    expect(repo.rows[0]!.evaluated_at).toBe(NOW);
  });

  it("skips persistence with persist:false", async () => {
    const { deps, repo } = buildDeps({ rows: [rowFromDomain(mockNoonReportDomain())] });
    const response = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, { now: NOW, persist: false }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.wasDuplicated).toBe(false);
    expect(body.data.validator.score).toBe(95);
    expect(repo.rows[0]!.evaluated_at).toBeNull();
  });

  it("deduplicates a repeated evaluation", async () => {
    const { deps } = buildDeps({ rows: [rowFromDomain(mockNoonReportDomain())] });
    const first = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, { now: NOW }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect((await first.json()).data.wasDuplicated).toBe(false);

    const second = await postEvaluate(
      jsonRequest(`https://example.com/api/vessels/${MOCK_IMO}/noon/evaluate`, { now: NOW }),
      { params: { imo: MOCK_IMO } },
      deps,
    );
    expect((await second.json()).data.wasDuplicated).toBe(true);
  });
});

run();
