import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { buildSoxNotification, soxNotificationTypeForEvent } from "../notifications";
import { evaluateSox } from "../engine";
import { SOX_MOCK_ZONE, SOX_MOCK_VESSEL } from "../mock-data";
import type { SoxComplianceEvent } from "../types";

const NOW = "2026-07-10T12:00:00.000Z";

function makeEvent(overrides: Partial<SoxComplianceEvent>): SoxComplianceEvent {
  return {
    id: "evt-1",
    vessel_id: SOX_MOCK_VESSEL.vesselId,
    imo: SOX_MOCK_VESSEL.imo,
    event_ts: NOW,
    event_type: "WATCH_CHANGE",
    zone_state: "WITHIN",
    watch_status: "NON_CONFORMING",
    severity: "HIGH",
    rule_id: "SOX-ECA-03",
    rule_result: null,
    evidence_status: "NON_CONFORMING",
    inside_eca: true,
    eca_effective: true,
    latitude: 38.0,
    longitude: 15.0,
    ais_position_id: null,
    applicable_limit_pct: 0.1,
    sulphur_content_pct: 0.15,
    selected_delivery_id: "fd-015",
    parameter_version: "2025.1",
    geometry_version: "1.0",
    calculation_version: "1.0.0",
    details: {},
    dedup_key: "x",
    created_at: NOW,
    ...overrides,
  };
}

function evaluation(watchStatus: "CLEAR" | "NON_CONFORMING" | "NO_EVIDENCE" | "UNKNOWN") {
  return evaluateSox({
    vessel: SOX_MOCK_VESSEL,
    position: { id: "ais-1", ts: NOW, lat: 38.0, lng: 15.0 },
    previousZoneState: null,
    zone: SOX_MOCK_ZONE,
    deliveries: watchStatus === "NON_CONFORMING"
      ? [{
          fuel_delivery_id: "fd-015", document_id: null, ocr_result_id: null, ai_extraction_id: null,
          delivery_date: "2026-07-01T10:00:00.000Z", delivery_port: "Genoa", fuel_type: "rmg_380",
          quantity_mt: 120, sulphur_content_pct: 0.15, delivery_status: "verified",
          review_state: null, ai_confidence: 0.94, source: "BDN OCR",
        }]
      : watchStatus === "NO_EVIDENCE"
        ? []
        : watchStatus === "UNKNOWN"
          ? [{
              fuel_delivery_id: "fd-ur", document_id: null, ocr_result_id: null, ai_extraction_id: null,
              delivery_date: "2026-07-01T10:00:00.000Z", delivery_port: "Genoa", fuel_type: "vlsfo",
              quantity_mt: 120, sulphur_content_pct: 0.12, delivery_status: "verified",
              review_state: "under_review", ai_confidence: null, source: "BDN OCR",
            }]
          : [{
              fuel_delivery_id: "fd-005", document_id: null, ocr_result_id: null, ai_extraction_id: null,
              delivery_date: "2026-07-01T10:00:00.000Z", delivery_port: "Genoa", fuel_type: "vlsfo",
              quantity_mt: 120, sulphur_content_pct: 0.05, delivery_status: "verified",
              review_state: null, ai_confidence: 0.94, source: "BDN OCR",
            }],
    now: NOW,
  });
}

describe("sox-eca notifications — type mapping", () => {
  it("maps NON_CONFORMING to sox_eca_non_conforming", () => {
    const event = makeEvent({ watch_status: "NON_CONFORMING", severity: "HIGH" });
    expect(soxNotificationTypeForEvent(event)).toBe("sox_eca_non_conforming");
  });

  it("maps NO_EVIDENCE to sox_eca_no_evidence", () => {
    const event = makeEvent({ watch_status: "NO_EVIDENCE", severity: "WARNING" });
    expect(soxNotificationTypeForEvent(event)).toBe("sox_eca_no_evidence");
  });

  it("maps UNKNOWN to sox_eca_review_required", () => {
    const event = makeEvent({ watch_status: "UNKNOWN", severity: "WARNING" });
    expect(soxNotificationTypeForEvent(event)).toBe("sox_eca_review_required");
  });

  it("maps WARNING to sox_eca_warning", () => {
    const event = makeEvent({ watch_status: "WARNING", severity: "WARNING" });
    expect(soxNotificationTypeForEvent(event)).toBe("sox_eca_warning");
  });

  it("returns null for INFO events and EXIT events", () => {
    expect(soxNotificationTypeForEvent(makeEvent({ watch_status: "CLEAR", severity: "INFO" }))).toBeNull();
    expect(soxNotificationTypeForEvent(makeEvent({ event_type: "EXIT", watch_status: "NON_CONFORMING", severity: "HIGH" }))).toBeNull();
  });
});

describe("sox-eca notifications — event build", () => {
  it("builds a non-conforming notification with regulatory phrasing", () => {
    const ev = evaluation("NON_CONFORMING");
    const event = makeEvent({ watch_status: "NON_CONFORMING", severity: "HIGH" });
    const n = buildSoxNotification({ evaluation: ev, event });
    expect(n).toBeTruthy();
    if (!n) return;
    expect(n.type).toBe("sox_eca_non_conforming");
    expect(n.severity).toBe("HIGH");
    expect(n.vessel_id).toBe(SOX_MOCK_VESSEL.vesselId);
    expect(n.message).toContainString("0.15% m/m");
    expect(n.message).toContainString("0.10% m/m");
  });

  it("builds no notification for a CLEAR evaluation", () => {
    const ev = evaluation("CLEAR");
    const event = makeEvent({ watch_status: "CLEAR", severity: "INFO" });
    expect(buildSoxNotification({ evaluation: ev, event })).toBeNull();
  });
});

run();
