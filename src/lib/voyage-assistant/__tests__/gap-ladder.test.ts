import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  classifyGapDuration,
  worstTier,
  coveragePct,
  summarizeGaps,
  GAP_FLAGGED_FROM_MINUTES,
  GAP_MANUAL_FROM_MINUTES,
  GAP_CRITICAL_FROM_MINUTES,
} from "../gap-ladder";
import type { AisGap, AisGapTier } from "../types";

function gap(id: string, durationMinutes: number, tier?: AisGapTier): AisGap {
  return {
    id,
    vesselId: "vsl-aurelia",
    voyageId: "voy-1",
    from: "2026-07-01T00:00:00.000Z",
    to: new Date(new Date("2026-07-01T00:00:00.000Z").getTime() + durationMinutes * 60_000).toISOString(),
    durationMinutes,
    tier: tier ?? classifyGapDuration(durationMinutes).tier,
    actionRequired: "action",
    escalation: false,
    notes: null,
  };
}

describe("Voyage Assistant — AIS gap ladder", () => {
  it("classifies under-30-minute gaps as INTERPOLATION_OK", () => {
    const result = classifyGapDuration(25);
    expect(result.tier).toBe("INTERPOLATION_OK");
    expect(result.escalation).toBe(false);
  });

  it("classifies exactly 30 minutes as FLAGGED (lower bound inclusive)", () => {
    const result = classifyGapDuration(GAP_FLAGGED_FROM_MINUTES);
    expect(result.tier).toBe("FLAGGED");
  });

  it("classifies 2 hours as FLAGGED", () => {
    const result = classifyGapDuration(135);
    expect(result.tier).toBe("FLAGGED");
  });

  it("classifies 6 hours as MANUAL_REQUIRED (lower bound inclusive)", () => {
    const result = classifyGapDuration(GAP_MANUAL_FROM_MINUTES);
    expect(result.tier).toBe("MANUAL_REQUIRED");
  });

  it("classifies 18 hours as MANUAL_REQUIRED", () => {
    const result = classifyGapDuration(1080);
    expect(result.tier).toBe("MANUAL_REQUIRED");
  });

  it("classifies exactly 48 hours as MANUAL_REQUIRED (upper bound inclusive)", () => {
    const result = classifyGapDuration(GAP_CRITICAL_FROM_MINUTES);
    expect(result.tier).toBe("MANUAL_REQUIRED");
  });

  it("classifies over 48 hours as CRITICAL_ESCALATION with escalation", () => {
    const result = classifyGapDuration(GAP_CRITICAL_FROM_MINUTES + 1);
    expect(result.tier).toBe("CRITICAL_ESCALATION");
    expect(result.escalation).toBe(true);
  });

  it("worstTier picks the highest severity tier", () => {
    const gaps = [gap("a", 25), gap("b", 1080), gap("c", 3240)];
    expect(worstTier(gaps)).toBe("CRITICAL_ESCALATION");
    expect(worstTier([gap("a", 25)])).toBe("INTERPOLATION_OK");
    expect(worstTier([])).toBe("NONE");
  });

  it("coveragePct reports 100% when there are no gaps", () => {
    expect(coveragePct([], "2026-07-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z")).toBe(100);
  });

  it("coveragePct subtracts gap minutes from the reference period", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const halfDayGap = gap("a", 720);
    expect(
      coveragePct(
        [halfDayGap],
        "2026-07-01T00:00:00.000Z",
        new Date(new Date("2026-07-01T00:00:00.000Z").getTime() + oneDayMs).toISOString(),
      ),
    ).toBe(50);
  });

  it("summarizeGaps counts per-tier buckets and exposes the worst gap", () => {
    const summary = summarizeGaps(
      [gap("a", 135, "FLAGGED"), gap("b", 1080, "MANUAL_REQUIRED")],
      "2026-07-01T00:00:00.000Z",
      "2026-07-03T00:00:00.000Z",
    );
    expect(summary.totalGaps).toBe(2);
    expect(summary.worstTier).toBe("MANUAL_REQUIRED");
    expect(summary.flaggedGaps).toBe(1);
    expect(summary.manualGaps).toBe(1);
    expect(summary.criticalGaps).toBe(0);
    expect(summary.worstGap && summary.worstGap.id).toBe("b");
  });
});

run();
