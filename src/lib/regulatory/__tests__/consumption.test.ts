/**
 * regulatory/__tests__/consumption.test.ts — canonical per-voyage consumption
 * attribution
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the consumption model prefers observed source evidence (noon-report
 * intervals, ROB deltas, BDN deliveries), NEVER emits an equal-share allocation,
 * and yields UNKNOWN/REVIEW/BLOCKED first-class outcomes on insufficient or
 * conflicting data.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { attributeVoyageConsumption } from "../consumption";
import type { ConsumptionInput } from "../consumption";
import type { FuelDeliveryRow, NoonReportRow, VoyageRow } from "@/lib/supabase/types";

function voyage(overrides: Partial<VoyageRow> = {}): VoyageRow {
  return {
    id: "voy-1",
    vessel_id: "v1",
    source_fetched_at: "2025-06-01T00:00:00.000Z",
    source_is_mock: true,
    departure_port_name: "Piraeus",
    departure_port_id: null,
    departure_time: "2025-06-01T00:00:00.000Z",
    arrival_port_name: "Valencia",
    arrival_port_id: null,
    arrival_time: "2025-06-03T00:00:00.000Z",
    distance_nm: 1000,
    created_at: "2025-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function noon(date: string, consumption: number | null, id = date): NoonReportRow {
  return {
    id,
    vessel_id: "v1",
    imo: "9074729",
    vessel_name: null,
    report_date: date,
    position_latitude: null,
    position_longitude: null,
    speed_knots: null,
    course_degrees: null,
    distance_to_go_nm: null,
    fuel_consumption_tonnes: consumption,
    fuel_robs_tonnes: null,
    engine_rpm: null,
    sea_state: null,
    wind_speed_knots: null,
    wind_direction: null,
    summary: null,
    warnings: [],
    confidence: 1,
    source: "mock",
    source_document_id: null,
    review_state: null,
    is_blocked: false,
    analysis: null,
    findings: [],
    fuel_correlation: null,
    voyage_correlation: null,
    fueleu_operational: null,
    ets_operational: null,
    evaluated_at: null,
    evaluation_version: null,
    dedup_key: null,
    created_at: date,
    updated_at: date,
  };
}

function delivery(date: string, fuelType = "HFO", qty = 100, id = date): FuelDeliveryRow {
  return {
    id,
    document_id: "doc-" + id,
    ocr_result_id: null,
    ai_extraction_id: null,
    vessel_id: "v1",
    supplier: "Supplier",
    delivery_port: "Piraeus",
    delivery_date: date,
    fuel_type: fuelType,
    quantity_mt: qty,
    density_kgm3: null,
    sulphur_content_pct: null,
    bdn_reference: null,
    status: "verified",
    reconciled_voyage_id: null,
    reconciled_at: null,
    notes: null,
    created_at: date,
    updated_at: date,
  };
}

function base(overrides: Partial<ConsumptionInput> = {}): ConsumptionInput {
  return {
    vessel_id: "v1",
    voyage: voyage(),
    reporting_year: 2025,
    noonReports: [],
    deliveries: [],
    robsByDate: [],
    fuelType: "HFO",
    ...overrides,
  };
}

describe("attributeVoyageConsumption — no equal-share fallback", () => {
  it("returns INSUFFICIENT_DATA / BLOCKED with an explicit note when no evidence touches the voyage", () => {
    const res = attributeVoyageConsumption(base());
    expect(res.method).toBe("INSUFFICIENT_DATA");
    expect(res.status).toBe("BLOCKED");
    expect(res.notes ?? "").toContainString("equal-share");
    expect(res.notes ?? "").toContainString("forbidden");
  });
});

describe("attributeVoyageConsumption — noon report interval", () => {
  it("attributes HIGH confidence consumption from a bracketing noon-report window", () => {
    const input = base({
      noonReports: [
        noon("2025-05-31T00:00:00.000Z", 30),
        noon("2025-06-02T00:00:00.000Z", 30),
        noon("2025-06-04T00:00:00.000Z", 25),
      ],
    });
    const res = attributeVoyageConsumption(input);
    expect(res.method).toBe("NOON_REPORT_INTERVAL");
    expect(res.status).toBe("VERIFIED");
    expect(res.confidence).toBe("HIGH");
    expect(res.quantity_mt).toBeGreaterThan(0);
    expect(res.attribution_method).toBe("NOON_REPORT_INTERVAL");
  });
});

describe("attributeVoyageConsumption — ROB delta", () => {
  it("attributes a same-fuel ROB delta across the voyage window", () => {
    const input = base({
      robsByDate: [
        { date: "2025-05-31", fuel_type: "HFO", rob_mt: 500 },
        { date: "2025-06-04", fuel_type: "HFO", rob_mt: 380 },
      ],
      fuelType: "HFO",
    });
    const res = attributeVoyageConsumption(input);
    expect(res.method).toBe("ROB_DELTA");
    expect(res.quantity_mt).toBe(120);
    expect(res.confidence).toBe("MEDIUM");
  });
});

describe("attributeVoyageConsumption — noon multi-fuel split (no double-count)", () => {
  it("allocates an aggregate noon total across fuel types by BDN ratio", () => {
    const noonReports = [
      noon("2025-05-31T00:00:00.000Z", 100),
      noon("2025-06-02T00:00:00.000Z", 25),
      noon("2025-06-04T00:00:00.000Z", 100),
    ];
    const both = [
      delivery("2025-06-02", "HFO", 75, "del-hfo"),
      delivery("2025-06-02", "MGO", 25, "del-mgo"),
    ];
    const hfo = attributeVoyageConsumption(
      base({ noonReports, deliveries: both, fuelType: "HFO" }),
    );
    const mgo = attributeVoyageConsumption(
      base({ noonReports, deliveries: both, fuelType: "MGO" }),
    );
    expect(hfo.method).toBe("NOON_REPORT_INTERVAL");
    expect(hfo.quantity_mt).toBe(75);
    expect(mgo.method).toBe("NOON_REPORT_INTERVAL");
    expect(mgo.quantity_mt).toBe(25);
    // Per-fuel shares sum to the aggregate total — no double-count of the total.
    expect(hfo.quantity_mt + mgo.quantity_mt).toBe(100);
  });

  it("refuses to invent a per-fuel split (INSUFFICIENT_FUEL_TYPE_DATA) when no defensible ratio exists for the requested fuel", () => {
    const res = attributeVoyageConsumption(
      base({
        noonReports: [
          noon("2025-05-31T00:00:00.000Z", 100),
          noon("2025-06-02T00:00:00.000Z", 25),
          noon("2025-06-04T00:00:00.000Z", 100),
        ],
        deliveries: [delivery("2025-06-02", "HFO", 75, "del-hfo"), delivery("2025-06-02", "MGO", 25, "del-mgo")],
        fuelType: "LNG",
      }),
    );
    expect(res.method).toBe("INSUFFICIENT_FUEL_TYPE_DATA");
    expect(res.status).toBe("REVIEW");
    expect(res.quantity_mt).toBe(0);
    expect(res.notes ?? "").toContainString("split");
  });

  it("does not assign an unknown-fuel ROB delta to a specific fuel type", () => {
    const res = attributeVoyageConsumption(
      base({
        robsByDate: [
          { date: "2025-05-31", fuel_type: "", rob_mt: 500 },
          { date: "2025-06-04", fuel_type: "", rob_mt: 380 },
        ],
        fuelType: "HFO",
      }),
    );
    // A scalar total ROB reading cannot be attributed to HFO without fabrication.
    expect(res.status).toBe("REVIEW");
    expect(res.quantity_mt).toBe(0);
  });
});

describe("attributeVoyageConsumption — BDN delivery", () => {
  it("attributes consumption from a BDN delivery reconciled to the voyage", () => {
    const input = base({
      deliveries: [delivery("2025-06-02", "HFO", 250, "del-1")],
    });
    const res = attributeVoyageConsumption(input);
    expect(res.method).toBe("BDN_TO_VOYAGE");
    expect(res.quantity_mt).toBe(250);
    expect(res.source_record_ids).toContain("del-1");
  });
});

describe("attributeVoyageConsumption — conflict detection", () => {
  it("flags REVIEW/CONFLICT_DELTA when noon-report consumption conflicts with BDN evidence", () => {
    const input = base({
      noonReports: [
        noon("2025-05-31T00:00:00.000Z", 100),
        noon("2025-06-04T00:00:00.000Z", 100),
      ],
      deliveries: [delivery("2025-06-02", "HFO", 1000, "del-big")],
    });
    const res = attributeVoyageConsumption(input);
    expect(res.method).toBe("CONFLICT_DELTA");
    expect(res.status).toBe("REVIEW");
  });
});

run();
