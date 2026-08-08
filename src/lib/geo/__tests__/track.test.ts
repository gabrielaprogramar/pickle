import { describe, it, expect } from "vitest";
import {
  processAisTrack,
  validateCoordinate,
  simplifyTrack,
  interpolateTrackPoint,
  computeTrackStats,
  splitTrackAt,
  computePlaybackWindow,
  computeDayMarkers,
} from "../track";
import type { AisPositionRow } from "../../supabase/types";

function makePos(
  ts: string,
  lat: number,
  lng: number,
  sog?: number | null,
): AisPositionRow {
  return {
    id: "test",
    vessel_id: "v1",
    ts,
    latitude: lat,
    longitude: lng,
    sog: sog ?? null,
    cog: null,
    heading: null,
    nav_status: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("validateCoordinate", () => {
  it("accepts valid coordinates", () => {
    expect(validateCoordinate(0, 0)).toBe(true);
    expect(validateCoordinate(90, 180)).toBe(true);
    expect(validateCoordinate(-90, -180)).toBe(true);
    expect(validateCoordinate(38.5, 15.2)).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(validateCoordinate(91, 0)).toBe(false);
    expect(validateCoordinate(-91, 0)).toBe(false);
    expect(validateCoordinate(0, 181)).toBe(false);
    expect(validateCoordinate(0, -181)).toBe(false);
  });
});

describe("processAisTrack", () => {
  it("returns empty track for empty input", () => {
    const track = processAisTrack([]);
    expect(track.pointCount).toBe(0);
    expect(track.points).toHaveLength(0);
    expect(track.distanceNm).toBeNull();
  });

  it("processes a single position", () => {
    const track = processAisTrack([makePos("2026-05-15T06:00:00Z", 43.58, 7.13)]);
    expect(track.pointCount).toBe(1);
    expect(track.distanceNm).toBeNull();
    expect(track.startTs).toBe("2026-05-15T06:00:00Z");
    expect(track.endTs).toBe("2026-05-15T06:00:00Z");
  });

  it("sorts positions chronologically", () => {
    const rows = [
      makePos("2026-05-15T07:00:00Z", 43.5, 7.14),
      makePos("2026-05-15T06:00:00Z", 43.58, 7.13),
    ];
    const track = processAisTrack(rows);
    expect(track.points[0]!.ts).toBe("2026-05-15T06:00:00Z");
    expect(track.points[1]!.ts).toBe("2026-05-15T07:00:00Z");
  });

  it("computes distance for multiple positions", () => {
    const rows = [
      makePos("2026-05-15T06:00:00Z", 43.58, 7.13),
      makePos("2026-05-15T18:00:00Z", 39.57, 2.64),
    ];
    const track = processAisTrack(rows);
    expect(track.distanceNm).toBeGreaterThan(200);
    expect(track.pointCount).toBe(2);
    expect(track.gaps).toHaveLength(1);
  });

  it("filters out invalid coordinates", () => {
    const rows = [
      makePos("2026-05-15T06:00:00Z", 43.58, 7.13),
      makePos("2026-05-15T07:00:00Z", 999, 999),
      makePos("2026-05-15T08:00:00Z", 39.57, 2.64),
    ];
    const track = processAisTrack(rows);
    expect(track.pointCount).toBe(2);
  });
});

describe("simplifyTrack", () => {
  it("returns all points for <= 2 points", () => {
    const pts = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    expect(simplifyTrack(pts)).toHaveLength(1);

    const pts2 = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 39.57, lng: 2.64, ts: "2026-01-01T06:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    expect(simplifyTrack(pts2)).toHaveLength(2);
  });

  it("removes points below distance threshold", () => {
    const pts = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 43.579, lng: 7.131, ts: "2026-01-01T00:30:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 39.57, lng: 2.64, ts: "2026-01-01T06:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const simplified = simplifyTrack(pts, 0.5);
    expect(simplified.length).toBe(2);
    expect(simplified[0]!.lat).toBe(43.58);
    expect(simplified[1]!.lat).toBe(39.57);
  });
});

describe("interpolateTrackPoint", () => {
  it("returns null for empty points", () => {
    expect(interpolateTrackPoint([], "2026-01-01T00:00:00Z")).toBeNull();
  });

  it("returns the only point for single-point track", () => {
    const pts = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const result = interpolateTrackPoint(pts, "2026-01-01T00:00:00Z");
    expect(result!.lat).toBe(43.58);
  });

  it("interpolates between two points", () => {
    const pts = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 42.0, lng: 7.0, ts: "2026-01-01T02:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const mid = interpolateTrackPoint(pts, "2026-01-01T01:00:00Z");
    expect(mid!.lat).toBeCloseTo(41.0, 1);
    expect(mid!.lng).toBeCloseTo(6.0, 1);
  });

  it("returns last point when target is beyond the track", () => {
    const pts = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 42.0, lng: 7.0, ts: "2026-01-01T02:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const result = interpolateTrackPoint(pts, "2026-01-01T04:00:00Z");
    expect(result!.lat).toBe(42.0);
  });
});

describe("computeTrackStats", () => {
  it("returns zeros for empty track", () => {
    const stats = computeTrackStats([]);
    expect(stats.pointCount).toBe(0);
    expect(stats.distanceNm).toBeNull();
    expect(stats.durationHours).toBeNull();
  });

  it("returns null distance for single point", () => {
    const pts = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const stats = computeTrackStats(pts);
    expect(stats.pointCount).toBe(1);
    expect(stats.distanceNm).toBeNull();
    expect(stats.durationHours).toBe(0);
  });

  it("computes distance and duration across the track", () => {
    const pts = [
      { lat: 43.58, lng: 7.13, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 39.57, lng: 2.64, ts: "2026-01-01T12:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const stats = computeTrackStats(pts);
    expect(stats.distanceNm).toBeGreaterThan(200);
    expect(stats.durationHours).toBe(12);
  });
});

describe("splitTrackAt", () => {
  const pts = [
    { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    { lat: 41.0, lng: 6.0, ts: "2026-01-01T01:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    { lat: 42.0, lng: 7.0, ts: "2026-01-01T02:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
  ];

  it("returns all lived when ts is null", () => {
    const split = splitTrackAt(pts, null);
    expect(split.lived).toHaveLength(3);
    expect(split.future).toHaveLength(0);
  });

  it("splits at the given timestamp", () => {
    const split = splitTrackAt(pts, "2026-01-01T01:00:00Z");
    expect(split.lived).toHaveLength(2);
    expect(split.future).toHaveLength(1);
    expect(split.future[0]!.ts).toBe("2026-01-01T02:00:00Z");
  });

  it("returns empty lived before the first point", () => {
    const split = splitTrackAt(pts, "2025-12-31T00:00:00Z");
    expect(split.lived).toHaveLength(0);
    expect(split.future).toHaveLength(3);
  });
});

describe("computePlaybackWindow", () => {
  it("returns null for fewer than 2 points", () => {
    const pts = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    expect(computePlaybackWindow(pts)).toBeNull();
    expect(computePlaybackWindow([])).toBeNull();
  });

  it("computes start, end and duration", () => {
    const pts = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 41.0, lng: 6.0, ts: "2026-01-02T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    const window = computePlaybackWindow(pts);
    expect(window).not.toBeNull();
    expect(window!.durationMs).toBe(24 * 60 * 60 * 1000);
  });

  it("returns null when duration is zero", () => {
    const pts = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
      { lat: 41.0, lng: 6.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    expect(computePlaybackWindow(pts)).toBeNull();
  });
});

describe("computeDayMarkers", () => {
  const pts = [
    { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    { lat: 41.0, lng: 6.0, ts: "2026-01-02T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    { lat: 42.0, lng: 7.0, ts: "2026-01-03T12:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
  ];

  it("places a marker at each 24h boundary within the track", () => {
    const markers = computeDayMarkers(pts);
    expect(markers).toHaveLength(2);
    expect(markers[0]!.dayIndex).toBe(1);
    expect(new Date(markers[0]!.ts).getTime()).toBe(
      new Date("2026-01-02T00:00:00Z").getTime(),
    );
    expect(markers[0]!.lat).toBeCloseTo(41.0, 5);
  });

  it("returns empty for fewer than 2 points", () => {
    const single = [
      { lat: 40.0, lng: 5.0, ts: "2026-01-01T00:00:00Z", sog: null, cog: null, heading: null, navStatus: null },
    ];
    expect(computeDayMarkers(single)).toHaveLength(0);
    expect(computeDayMarkers([])).toHaveLength(0);
  });
});
