import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import type { FakeSupabaseClientOptions } from "@/lib/supabase/fake-client";
import { SoxComplianceService } from "@/lib/sox-eca";
import { adaptSoxComplianceRepository } from "../_lib";
import type { SoxApiDeps } from "../_lib";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import type { VesselRepository } from "@/lib/supabase/repositories/vessels";
import { createEnvironmentalZoneRepository } from "@/lib/supabase/repositories/environmental_zones";
import { createAisPositionsRepository } from "@/lib/supabase/repositories/ais_positions";
import { createFuelDeliveryRepository } from "@/lib/supabase/repositories/fuel_deliveries";
import { createSoxComplianceRepository } from "@/lib/supabase/repositories/sox_compliance";
import { GET as getWatch } from "../route";
import { GET as getEvents } from "../../sox-events/route";
import { POST as postEvaluate } from "../evaluate/route";

const IMO = "9074729";

const ZONE_ROW = {
  id: "z-med-sox-eca",
  code: "MED_SOX_ECA",
  name: "Mediterranean Sea SOx Emission Control Area",
  category: "ECA_SOX",
  geometry_type: "POLYGON",
  geometry_coordinates: [
    [[-5.0, 35.0], [5.0, 35.0], [5.0, 46.0], [30.0, 46.0], [30.0, 36.0], [36.0, 36.0], [36.0, 32.0], [20.0, 30.0], [10.0, 30.0], [-5.0, 35.0]],
  ],
  description: "Mediterranean Sea designated as SOx ECA under MARPOL Annex VI.",
  regulation_reference: "MARPOL Annex VI, Regulation 14; IMO MEPC.361(79)",
  geometry_version: "1.0",
  jurisdiction: "Mediterranean Sea",
  effective_from: "2025-05-01",
  effective_until: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function buildDeps(opts: FakeSupabaseClientOptions = {}) {
  const fake = createFakeSupabaseClient(opts);
  const vesselRepo = createVesselRepository({ client: fake });
  const dispatched: Array<{ type: string; severity: string; vessel_id?: string | null }> = [];

  const service = new SoxComplianceService({
    soxRepo: adaptSoxComplianceRepository(
      createSoxComplianceRepository({ client: fake }),
    ),
    vesselRepo,
    zoneRepo: createEnvironmentalZoneRepository({ client: fake }),
    aisRepo: createAisPositionsRepository({ client: fake }),
    fuelRepo: createFuelDeliveryRepository({ client: fake }),
    notify: {
      dispatch: async (n) => {
        dispatched.push({ type: n.type, severity: n.severity, vessel_id: n.vessel_id });
      },
    },
  });

  const deps: SoxApiDeps = { service, vesselRepo };
  return { deps, fake, dispatched, vesselRepo };
}

async function seedVessel(deps: SoxApiDeps): Promise<string> {
  const vessel = await (deps.vesselRepo as VesselRepository).upsertByImo({
    imo: IMO,
    name: "Aurelia",
  });
  return vessel.id;
}

function watchRequest() {
  return new Request("https://example.com/api/vessels/9074729/sox-watch", {
    method: "GET",
  });
}

function eventsRequest(limit?: number) {
  const qs = typeof limit === "number" ? `?limit=${limit}` : "";
  return new Request(
    `https://example.com/api/vessels/9074729/sox-events${qs}`,
    { method: "GET" },
  );
}

function evaluateRequest(body: unknown) {
  return new Request("https://example.com/api/vessels/9074729/sox-watch/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/vessels/[imo]/sox-watch", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await getWatch(watchRequest(), { params: { imo: "0000000" } }, deps);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VESSEL_NOT_FOUND");
  });

  it("returns an empty watch for a known vessel with no data", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const response = await getWatch(watchRequest(), { params: { imo: IMO } }, deps);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.imo).toBe(IMO);
    expect(body.data.watch).toBeNull();
    expect(body.data.events).toEqual([]);
    expect(body.data.eventCount).toBe(0);
  });

  it("returns the persisted watch after an evaluation", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    await postEvaluate(
      evaluateRequest({ scenario: "inside-non-conforming", persist: true }),
      { params: { imo: IMO } },
      deps,
    );

    const response = await getWatch(watchRequest(), { params: { imo: IMO } }, deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.watch.status).toBe("NON_CONFORMING");
    expect(body.data.watch.severity).toBe("HIGH");
    expect(body.data.watch.zone_state).toBe("ENTRY");
    expect(body.data.events.length).toBe(1);
  });
});

describe("GET /api/vessels/[imo]/sox-events", () => {
  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await getEvents(eventsRequest(), { params: { imo: "0000000" } }, deps);
    expect(response.status).toBe(404);
  });

  it("lists events newest-first with a limit", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    await postEvaluate(
      evaluateRequest({ scenario: "inside-conforming", persist: true }),
      { params: { imo: IMO } },
      deps,
    );

    const response = await getEvents(eventsRequest(5), { params: { imo: IMO } }, deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.events.length).toBe(1);
    expect(body.data.events[0].event_type).toBe("ENTRY");
    expect(body.data.events[0].rule_id).toBe("SOX-ECA-01");
  });
});

describe("POST /api/vessels/[imo]/sox-watch/evaluate", () => {
  it("evaluates a scenario, persists, and returns the envelope", async () => {
    const { deps, dispatched } = buildDeps();
    await seedVessel(deps);

    const response = await postEvaluate(
      evaluateRequest({ scenario: "inside-non-conforming", persist: true }),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.imo).toBe(IMO);
    expect(body.data.evaluation.watchStatus).toBe("NON_CONFORMING");
    expect(body.data.evaluation.severity).toBe("HIGH");
    expect(body.data.evaluation.applicableLimitPct).toBe(0.1);
    expect(body.data.evaluation.sulphurContentPct).toBe(0.15);
    expect(body.data.evaluation.ruleResults.some((r: { rule_id: string }) => r.rule_id === "SOX-ECA-03")).toBe(true);
    expect(body.data.event.event_type).toBe("ENTRY");
    expect(body.data.event.rule_id).toBe("SOX-ECA-01");
    expect(body.data.watchState.status).toBe("NON_CONFORMING");
    expect(body.data.wasDuplicated).toBe(false);
    expect(body.data.dispatchedNotifications).toBe(1);
    expect(body.data.captain).toBeTruthy();

    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("sox_eca_non_conforming");
    expect(dispatched[0]?.severity).toBe("HIGH");
  });

  it("supports non-persisting scenario evaluation", async () => {
    const { deps, dispatched } = buildDeps();
    await seedVessel(deps);

    const response = await postEvaluate(
      evaluateRequest({ scenario: "inside-non-conforming", persist: false }),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.event).toBeNull();
    expect(body.data.watchState).toBeNull();
    expect(body.data.dispatchedNotifications).toBe(0);
    expect(dispatched.length).toBe(0);
  });

  it("rejects an unknown scenario", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const response = await postEvaluate(
      evaluateRequest({ scenario: "not-a-real-scenario" }),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid JSON", async () => {
    const { deps } = buildDeps();
    await seedVessel(deps);

    const response = await postEvaluate(
      evaluateRequest("not json at all"),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("returns 404 for an unknown vessel", async () => {
    const { deps } = buildDeps();
    const response = await postEvaluate(
      evaluateRequest({ scenario: "inside-conforming" }),
      { params: { imo: "0000000" } },
      deps,
    );
    expect(response.status).toBe(404);
  });

  it("evaluates from live repositories when no scenario is supplied", async () => {
    const { deps, fake } = buildDeps({
      tables: { environmental_zones: [ZONE_ROW] },
    });
    const vesselId = await seedVessel(deps);

    const aisRepo = createAisPositionsRepository({ client: fake });
    const fuelRepo = createFuelDeliveryRepository({ client: fake });
    await aisRepo.insert({
      vessel_id: vesselId,
      ts: "2026-07-10T12:00:00.000Z",
      latitude: 38.0,
      longitude: 15.0,
    });
    await fuelRepo.insert({
      document_id: "doc-1",
      vessel_id: vesselId,
      supplier: "EniGenova",
      delivery_port: "Genoa",
      delivery_date: "2026-07-01T10:00:00.000Z",
      fuel_type: "rmg_380",
      quantity_mt: 120,
      sulphur_content_pct: 0.15,
      status: "verified",
    });

    const response = await postEvaluate(
      evaluateRequest({ now: "2026-07-10T12:00:00.000Z", persist: true }),
      { params: { imo: IMO } },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.evaluation.insideEca).toBe(true);
    expect(body.data.evaluation.evidenceStatus).toBe("NON_CONFORMING");
    expect(body.data.evaluation.watchStatus).toBe("NON_CONFORMING");
    expect(body.data.evaluation.applicableLimitPct).toBe(0.1);
    expect(body.data.event.event_type).toBe("ENTRY");
  });
});

run();
