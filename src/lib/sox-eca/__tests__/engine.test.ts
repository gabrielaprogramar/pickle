import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { evaluateSox } from "../engine";
import { SOX_MOCK_ZONE } from "../mock-data";
import type { SoxEvaluationInput } from "../types";

const VESSEL = { vesselId: "vsl-aurelia", imo: "9074729", name: "Aurelia" };
const INSIDE = { id: "ais-1", ts: "2026-07-10T12:00:00.000Z", lat: 38.0, lng: 15.0 };
const OUTSIDE = { id: "ais-2", ts: "2026-07-10T12:00:00.000Z", lat: 50.0, lng: -10.0 };
const NOW = "2026-07-10T12:00:00.000Z";

function delivery(sulphur: number | null, overrides: Record<string, unknown> = {}) {
  return {
    fuel_delivery_id: "fd-x",
    document_id: null,
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
    ...overrides,
  };
}

function input(overrides: Partial<SoxEvaluationInput> = {}): SoxEvaluationInput {
  return {
    vessel: VESSEL,
    position: INSIDE,
    previousZoneState: null,
    zone: SOX_MOCK_ZONE,
    deliveries: [],
    now: NOW,
    ...overrides,
  };
}

describe("sox-eca engine — within ECA", () => {
  it("is CLEAR/INFO/SOX-ECA-02 for conforming bunker evidence", () => {
    const res = evaluateSox(input({ deliveries: [delivery(0.05)] }));
    expect(res.watchStatus).toBe("CLEAR");
    expect(res.severity).toBe("INFO");
    expect(res.evidenceStatus).toBe("CONFORMING");
    expect(res.applicableLimitPct).toBe(0.1);
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-02")).toBe(true);
  });

  it("is NON_CONFORMING/HIGH/SOX-ECA-03 for non-conforming bunker evidence", () => {
    const res = evaluateSox(input({ deliveries: [delivery(0.15)] }));
    expect(res.watchStatus).toBe("NON_CONFORMING");
    expect(res.severity).toBe("HIGH");
    expect(res.evidenceStatus).toBe("NON_CONFORMING");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-03")).toBe(true);
  });

  it("is NO_EVIDENCE/WARNING/SOX-ECA-04 with no bunker evidence", () => {
    const res = evaluateSox(input({ deliveries: [] }));
    expect(res.watchStatus).toBe("NO_EVIDENCE");
    expect(res.severity).toBe("WARNING");
    expect(res.evidenceStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-04")).toBe(true);
  });

  it("is UNKNOWN/WARNING/SOX-ECA-05 for conflicting evidence", () => {
    const res = evaluateSox(input({
      deliveries: [delivery(0.12, { fuel_delivery_id: "fd-ur", review_state: "under_review" })],
    }));
    expect(res.watchStatus).toBe("UNKNOWN");
    expect(res.severity).toBe("WARNING");
    expect(res.evidenceStatus).toBe("UNKNOWN");
    expect(res.reviewRequired).toBe(true);
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-05")).toBe(true);
  });

  it("never asserts conformance for a boundary value above 0.10", () => {
    const res = evaluateSox(input({ deliveries: [delivery(0.1001)] }));
    expect(res.evidenceStatus).toBe("NON_CONFORMING");
  });
});

describe("sox-eca engine — trusted fuel-in-use", () => {
  it("raises to CRITICAL for trusted non-conforming fuel-in-use inside the ECA", () => {
    const res = evaluateSox(input({
      trustedFuelInUse: { sulphurContentPct: 0.15, source: "fuel-changeover record" },
    }));
    expect(res.watchStatus).toBe("NON_CONFORMING");
    expect(res.severity).toBe("CRITICAL");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-03" && r.severity === "CRITICAL")).toBe(true);
  });

  it("stays CLEAR for trusted conforming fuel-in-use inside the ECA", () => {
    const res = evaluateSox(input({
      trustedFuelInUse: { sulphurContentPct: 0.06, source: "fuel-changeover record" },
    }));
    expect(res.watchStatus).toBe("CLEAR");
    expect(res.severity).toBe("INFO");
  });
});

describe("sox-eca engine — outside ECA / global cap", () => {
  it("is CLEAR outside with conforming global evidence", () => {
    const res = evaluateSox(input({ position: OUTSIDE, deliveries: [delivery(0.1)] }));
    expect(res.insideEca).toBe(false);
    expect(res.applicableLimitPct).toBe(0.5);
    expect(res.watchStatus).toBe("CLEAR");
  });

  it("is NON_CONFORMING outside when evidence exceeds the global cap", () => {
    const res = evaluateSox(input({ position: OUTSIDE, deliveries: [delivery(0.55)] }));
    expect(res.watchStatus).toBe("NON_CONFORMING");
    expect(res.severity).toBe("HIGH");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-03")).toBe(true);
  });
});

describe("sox-eca engine — effective date", () => {
  it("applies only the global cap before 2025-05-01 even inside the geometry", () => {
    const res = evaluateSox(input({
      now: "2025-04-30T12:00:00.000Z",
      deliveries: [delivery(0.3)],
    }));
    expect(res.ecaEffective).toBe(false);
    expect(res.insideEca).toBe(false);
    expect(res.applicableLimitPct).toBe(0.5);
    expect(res.watchStatus).toBe("CLEAR");
  });

  it("flags non-conformance vs the global cap before the ECA is effective", () => {
    const res = evaluateSox(input({
      now: "2025-04-30T12:00:00.000Z",
      deliveries: [delivery(0.55)],
    }));
    expect(res.watchStatus).toBe("NON_CONFORMING");
  });
});

describe("sox-eca engine — geometry unavailable", () => {
  it("is UNKNOWN/INFO/SOX-ECA-06 with no geometry", () => {
    const res = evaluateSox(input({ zone: null }));
    expect(res.geometryAvailable).toBe(false);
    expect(res.watchStatus).toBe("UNKNOWN");
    expect(res.severity).toBe("INFO");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-06")).toBe(true);
  });
});

describe("sox-eca engine — zone transitions", () => {
  it("emits SOX-ECA-01 on ENTRY with conforming evidence", () => {
    const res = evaluateSox(input({ previousZoneState: "OUTSIDE" }));
    expect(res.zoneState).toBe("ENTRY");
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-01" && r.kind === "NOTICE")).toBe(true);
  });

  it("emits a WARNING SOX-ECA-01 on ENTRY with non-conforming evidence", () => {
    const res = evaluateSox(input({ previousZoneState: "OUTSIDE", deliveries: [delivery(0.15)] }));
    const entry = res.ruleResults.find((r) => r.rule_id === "SOX-ECA-01");
    expect(entry?.severity).toBe("WARNING");
  });

  it("emits SOX-ECA-01 on EXIT", () => {
    const res = evaluateSox(input({ previousZoneState: "WITHIN", position: OUTSIDE }));
    expect(res.zoneState).toBe("EXIT");
    expect(res.insideEca).toBe(false);
    expect(res.ruleResults.some((r) => r.rule_id === "SOX-ECA-01")).toBe(true);
  });
});

describe("sox-eca engine — dedup key", () => {
  it("is stable for identical inputs", () => {
    const a = evaluateSox(input({ deliveries: [delivery(0.05)] }));
    const b = evaluateSox(input({ deliveries: [delivery(0.05)] }));
    expect(a.dedupKey).toBe(b.dedupKey);
  });

  it("changes when the evidence or status changes", () => {
    const clear = evaluateSox(input({ deliveries: [delivery(0.05)] }));
    const bad = evaluateSox(input({ deliveries: [delivery(0.15)] }));
    expect(clear.dedupKey === bad.dedupKey).toBe(false);
  });
});

run();
