/**
 * notifications.test.ts — noon report notification mapping tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Covers the deterministic mapping from findings/severities to the shared
 * notification event system and the INFO suppression convention.
 *
 * Run via: npx tsx src/lib/noon-report/__tests__/notifications.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { analyzeNoonReport } from "../index";
import {
  findingToNotificationSeverity,
  noonNotificationTypeForFinding,
  buildNoonNotifications,
} from "../notifications";
import type { NoonFinding } from "../types";
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

function finding(partial: Partial<NoonFinding>): NoonFinding {
  return {
    id: "noon.test.finding",
    severity: "WARNING",
    confidence: 0.8,
    reason: "reason",
    remediation: "remediation",
    category: "fuel",
    ruleId: null,
    field: "fuelConsumptionTonnes",
    ...partial,
  };
}

describe("findingToNotificationSeverity", () => {
  it("maps BLOCKING and ERROR to HIGH", () => {
    expect(findingToNotificationSeverity("BLOCKING")).toBe("HIGH");
    expect(findingToNotificationSeverity("ERROR")).toBe("HIGH");
  });

  it("maps WARNING to MEDIUM", () => {
    expect(findingToNotificationSeverity("WARNING")).toBe("MEDIUM");
  });

  it("maps INFO and unknown values to INFO", () => {
    expect(findingToNotificationSeverity("INFO")).toBe("INFO");
  });
});

describe("noonNotificationTypeForFinding", () => {
  const cases: Array<[string, string | null]> = [
    ["noon.fuel.impossible_consumption", "noon_impossible_fuel"],
    ["noon.fuel.rob_inconsistency", "noon_rob_inconsistency"],
    ["noon.fuel.delivery_discrepancy", "noon_fuel_discrepancy"],
    ["noon.weather.significant", "noon_heavy_weather"],
    ["noon.deviation.consumption", "noon_unexpected_consumption"],
    ["noon.deviation.arrival", "noon_unexpected_delay"],
    ["noon.voyage.late_arrival", "noon_unexpected_delay"],
    ["noon.voyage.behind_schedule", "noon_unexpected_delay"],
    ["noon.voyage.anomaly", "noon_voyage_anomaly"],
    ["noon.data_quality.low_confidence", "noon_low_confidence"],
    ["noon.fueleu.unattributed_consumption", null],
    ["noon.ets.unattributed_consumption", null],
    ["noon.some_unknown_rule", null],
  ];

  for (const [id, expected] of cases) {
    it(`maps ${id} → ${expected}`, () => {
      expect(noonNotificationTypeForFinding(finding({ id })) === expected).toBe(true);
    });
  }
});

describe("buildNoonNotifications", () => {
  const report = mockNoonReportDomain();
  const analysis = analyzeNoonReport({
    report,
    vessel: { vesselId: MOCK_VESSEL_ID, imo: MOCK_IMO, name: MOCK_VESSEL_NAME },
    previous: mockPreviousNoonReport(),
    engineReference: mockEngineReference(),
    voyagePlan: mockVoyagePlan(),
    fuelAttribution: null,
    now: NOW,
  });

  it("emits a single INFO report-received notification when requested", () => {
    const notifications = buildNoonNotifications({ report, analysis, findings: [], reportReceived: true });
    expect(notifications.length).toBe(1);
    expect(notifications[0]!.type).toBe("noon_report_received");
    expect(notifications[0]!.severity).toBe("INFO");
    expect(notifications[0]!.recipient_id).toBe("ops-001");
    expect(notifications[0]!.vessel_id).toBe(MOCK_VESSEL_ID);
    expect(notifications[0]!.title).toBe(`Noon report received — ${MOCK_VESSEL_NAME}`);
    expect(notifications[0]!.payload!.imo).toBe(MOCK_IMO);
    expect(notifications[0]!.payload!.report_date).toBe(report.reportDate);
  });

  it("emits nothing when reportReceived is false and there are no findings", () => {
    expect(buildNoonNotifications({ report, analysis, findings: [], reportReceived: false })).toEqual([]);
  });

  it("maps an ERROR finding to a HIGH notification with its payload", () => {
    const f = finding({
      id: "noon.fuel.impossible_consumption",
      severity: "ERROR",
      reason: "consumption exceeds available fuel",
    });
    const notifications = buildNoonNotifications({ report, analysis, findings: [f], reportReceived: false });
    expect(notifications.length).toBe(1);
    expect(notifications[0]!.type).toBe("noon_impossible_fuel");
    expect(notifications[0]!.severity).toBe("HIGH");
    expect(notifications[0]!.message).toBe("consumption exceeds available fuel");
    expect(notifications[0]!.payload!.finding_id).toBe("noon.fuel.impossible_consumption");
    expect(notifications[0]!.payload!.field).toBe("fuelConsumptionTonnes");
    expect(notifications[0]!.source_id).toBe(report.id);
  });

  it("maps a WARNING finding to a MEDIUM notification", () => {
    const f = finding({ id: "noon.weather.significant", severity: "WARNING" });
    const notifications = buildNoonNotifications({ report, analysis, findings: [f] });
    expect(notifications[0]!.type).toBe("noon_heavy_weather");
    expect(notifications[0]!.severity).toBe("MEDIUM");
  });

  it("suppresses INFO-severity findings even when they map to a type", () => {
    const f = finding({ id: "noon.weather.significant", severity: "INFO" });
    expect(buildNoonNotifications({ report, analysis, findings: [f] })).toEqual([]);
  });

  it("emits one notification per notifiable finding, in order", () => {
    const findings = [
      finding({ id: "noon.deviation.consumption", severity: "ERROR" }),
      finding({ id: "noon.voyage.behind_schedule", severity: "WARNING" }),
      finding({ id: "noon.fueleu.unattributed_consumption", severity: "WARNING" }),
    ];
    const notifications = buildNoonNotifications({ report, analysis, findings });
    expect(notifications.length).toBe(2);
    expect(notifications[0]!.type).toBe("noon_unexpected_consumption");
    expect(notifications[1]!.type).toBe("noon_unexpected_delay");
  });

  it("combines report-received with finding notifications when both apply", () => {
    const f = finding({ id: "noon.some_unmapped_rule", severity: "ERROR" });
    const f2 = finding({ id: "noon.fuel.rob_inconsistency", severity: "WARNING" });
    const notifications = buildNoonNotifications({ report, analysis, findings: [f, f2], reportReceived: true });
    expect(notifications.length).toBe(2);
    expect(notifications[0]!.type).toBe("noon_report_received");
    expect(notifications[1]!.type).toBe("noon_rob_inconsistency");
  });
});

run();
