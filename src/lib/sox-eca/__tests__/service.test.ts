import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { SoxComplianceService } from "../service";
import type { SoxComplianceRepository } from "../service";
import type {
  SoxComplianceEvent,
  SoxComplianceEventInsert,
  SoxWatchState,
  SoxWatchStateInsert,
} from "../types";
import { SOX_MOCK_ZONE } from "../mock-data";
import type { SoxEvidenceSource } from "../types";

const VESSEL = { id: "vsl-aurelia", name: "Aurelia", imo: "9074729" };
const NOW = "2026-07-10T12:00:00.000Z";

const INSIDE = { id: "ais-1", ts: NOW, lat: 38.0, lng: 15.0 };
const OUTSIDE = { id: "ais-2", ts: NOW, lat: 50.0, lng: -10.0 };

function delivery(sulphur: number | null, id = "fd-005"): SoxEvidenceSource {
  return {
    fuel_delivery_id: id,
    document_id: "doc-1",
    ocr_result_id: null,
    ai_extraction_id: null,
    delivery_date: "2026-07-01T10:00:00.000Z",
    delivery_port: "Genoa",
    fuel_type: "vlsfo",
    quantity_mt: 120,
    sulphur_content_pct: sulphur,
    delivery_status: "verified",
    review_state: null,
    ai_confidence: 0.94,
    source: "BDN OCR",
  };
}

interface FakeRepo extends SoxComplianceRepository {
  readonly _events: SoxComplianceEvent[];
}

function makeFakeRepo(): FakeRepo {
  const events: SoxComplianceEvent[] = [];
  let watch: SoxWatchState | null = null;
  let seq = 0;

  return {
    _events: events,
    async findLatestEvent(vesselId) {
      const matches = events.filter((e) => e.vessel_id === vesselId);
      return matches[matches.length - 1] ?? null;
    },
    async findEventsByVesselId(vesselId, limit = 50) {
      return [...events]
        .filter((e) => e.vessel_id === vesselId)
        .reverse()
        .slice(0, limit);
    },
    async insertEvent(input: SoxComplianceEventInsert) {
      const row: SoxComplianceEvent = { ...input, id: `evt-${++seq}`, created_at: NOW };
      events.push(row);
      return row;
    },
    async findWatchState(vesselId) {
      return watch && watch.vessel_id === vesselId ? watch : null;
    },
    async upsertWatchState(input: SoxWatchStateInsert) {
      watch = { ...input, updated_at: NOW };
      return watch;
    },
  };
}

function makeService() {
  const soxRepo = makeFakeRepo();
  const dispatched: Array<{ type: string; severity: string; vessel_id?: string | null }> = [];

  const service = new SoxComplianceService({
    soxRepo,
    vesselRepo: { findByImo: async (imo) => (imo === VESSEL.imo ? VESSEL : null) },
    zoneRepo: { findByCode: async () => null },
    aisRepo: {
      findLatestByVesselId: async () => ({ id: INSIDE.id, vessel_id: VESSEL.id, ts: INSIDE.ts, latitude: INSIDE.lat, longitude: INSIDE.lng }),
    },
    fuelRepo: { findByVesselId: async () => [] },
    notify: { dispatch: async (n) => { dispatched.push({ type: n.type, severity: n.severity, vessel_id: n.vessel_id }); } },
  });

  return { service, soxRepo, dispatched };
}

describe("sox-eca service — evaluation + persistence", () => {
  it("persists an ENTRY event and watch state on first evaluation", async () => {
    const { service, soxRepo } = makeService();
    const outcome = await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.05)],
    });

    expect(outcome.event).toBeTruthy();
    expect(outcome.watchState?.status).toBe("CLEAR");
    expect(outcome.wasDuplicated).toBe(false);
    expect(soxRepo._events.length).toBe(1);
    expect(outcome.event?.event_type).toBe("ENTRY");
    expect(outcome.event?.rule_id).toBe("SOX-ECA-01");
  });

  it("deduplicates repeated evaluations once the state stabilises", async () => {
    const { service, soxRepo } = makeService();
    const opts = { now: NOW, zone: SOX_MOCK_ZONE, position: INSIDE, deliveries: [delivery(0.05)] };

    const first = await service.evaluate(VESSEL.imo, opts); // ENTRY
    const second = await service.evaluate(VESSEL.imo, opts); // WITHIN (state stabilised)
    const third = await service.evaluate(VESSEL.imo, opts); // duplicated

    expect(first.wasDuplicated).toBe(false);
    expect(second.wasDuplicated).toBe(false);
    expect(second.event?.event_type).toBe("WITHIN");
    expect(third.wasDuplicated).toBe(true);
    expect(third.event).toBeNull();
    expect(soxRepo._events.length).toBe(2);
  });

  it("records a fresh ENTRY after an EXIT (re-entry always persists)", async () => {
    const { service, soxRepo } = makeService();

    await service.evaluate(VESSEL.imo, { now: NOW, zone: SOX_MOCK_ZONE, position: INSIDE, deliveries: [delivery(0.05)] }); // ENTRY
    await service.evaluate(VESSEL.imo, { now: NOW, zone: SOX_MOCK_ZONE, position: OUTSIDE, deliveries: [delivery(0.05)] }); // EXIT
    const third = await service.evaluate(VESSEL.imo, { now: NOW, zone: SOX_MOCK_ZONE, position: INSIDE, deliveries: [delivery(0.05)] }); // ENTRY

    expect(third.event?.event_type).toBe("ENTRY");
    expect(soxRepo._events.map((e) => e.event_type)).toEqual(["ENTRY", "EXIT", "ENTRY"]);
    expect(third.watchState?.last_entry_ts).toBe(NOW);
  });

  it("records a WATCH_CHANGE when status changes while within the ECA", async () => {
    const { service, soxRepo } = makeService();

    await service.evaluate(VESSEL.imo, { now: NOW, zone: SOX_MOCK_ZONE, position: INSIDE, deliveries: [delivery(0.05)] });
    const second = await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.15, "fd-015")],
    });

    expect(second.wasDuplicated).toBe(false);
    expect(second.event?.event_type).toBe("WATCH_CHANGE");
    expect(second.watchState?.status).toBe("NON_CONFORMING");
  });

  it("supports non-persisting evaluation", async () => {
    const { service, soxRepo } = makeService();
    const outcome = await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.05)],
      persist: false,
    });
    expect(outcome.event).toBeNull();
    expect(soxRepo._events.length).toBe(0);
  });
});

describe("sox-eca service — reads", () => {
  it("returns null watch/empty events for unknown vessels", async () => {
    const { service } = makeService();
    expect(await service.getWatch("9999999")).toBeNull();
    expect(await service.getEvents("9999999")).toEqual([]);
  });

  it("returns persisted watch and events for a known vessel", async () => {
    const { service } = makeService();
    await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.05)],
    });

    const watch = await service.getWatch(VESSEL.imo);
    const events = await service.getEvents(VESSEL.imo);
    expect(watch?.status).toBe("CLEAR");
    expect(events.length).toBe(1);
  });
});

describe("sox-eca service — notifications", () => {
  it("dispatches exactly one notification for a new non-conforming event", async () => {
    const { service, dispatched } = makeService();
    const outcome = await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.15, "fd-015")],
    });

    expect(outcome.dispatchedNotifications).toBe(1);
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe("sox_eca_non_conforming");
    expect(dispatched[0]?.severity).toBe("HIGH");
  });

  it("does not dispatch for CLEAR evaluations", async () => {
    const { service, dispatched } = makeService();
    await service.evaluate(VESSEL.imo, {
      now: NOW,
      zone: SOX_MOCK_ZONE,
      position: INSIDE,
      deliveries: [delivery(0.05)],
    });
    expect(dispatched.length).toBe(0);
  });

  it("does not re-dispatch for duplicated evaluations", async () => {
    const { service, dispatched } = makeService();
    const opts = { now: NOW, zone: SOX_MOCK_ZONE, position: INSIDE, deliveries: [delivery(0.15, "fd-015")] };
    await service.evaluate(VESSEL.imo, opts); // ENTRY — notification 1
    await service.evaluate(VESSEL.imo, opts); // WITHIN — notification 2
    const third = await service.evaluate(VESSEL.imo, opts); // duplicated
    expect(third.wasDuplicated).toBe(true);
    expect(third.event).toBeNull();
    expect(dispatched.length).toBe(2);
  });
});

describe("sox-eca service — geometry fallback", () => {
  it("returns UNKNOWN without geometry even when repos are wired", async () => {
    const { service } = makeService();
    const outcome = await service.evaluate(VESSEL.imo, { now: NOW, zone: null });
    expect(outcome.evaluation.geometryAvailable).toBe(false);
    expect(outcome.evaluation.watchStatus).toBe("UNKNOWN");
    expect(outcome.event?.rule_id).toBe("SOX-ECA-06");
  });
});

run();
