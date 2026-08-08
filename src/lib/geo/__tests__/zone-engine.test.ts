import { describe, it, expect } from "vitest";
import { pointInZone, detectZoneTransition, checkZoneAlerts, getZoneColor } from "../zone-engine";
import type { EnvironmentalZone } from "../types";

const medSoxZone: EnvironmentalZone = {
  id: "z1",
  code: "MED_SOX_ECA",
  name: "Mediterranean Sea SOx ECA",
  category: "ECA_SOX",
  geometryType: "POLYGON",
  geometryCoordinates: [[[-5.0, 35.0], [5.0, 35.0], [5.0, 46.0], [30.0, 46.0], [30.0, 36.0], [36.0, 36.0], [36.0, 32.0], [20.0, 30.0], [10.0, 30.0], [-5.0, 35.0]]],
  description: null,
  regulationReference: null,
  geometryVersion: "1.0",
  jurisdiction: null,
  effectiveFrom: "2025-05-01",
  effectiveUntil: null,
  isActive: true,
};

describe("pointInZone", () => {
  it("returns true for a point inside the Med SOx ECA", () => {
    expect(pointInZone({ lat: 38.0, lng: 15.0 }, medSoxZone)).toBe(true);
  });

  it("returns true for a point inside near Antibes", () => {
    expect(pointInZone({ lat: 43.58, lng: 7.13 }, medSoxZone)).toBe(true);
  });

  it("returns false for a point just south of the polygon boundary (near Palma)", () => {
    expect(pointInZone({ lat: 39.57, lng: 2.64 }, medSoxZone)).toBe(false);
  });

  it("returns false for a point outside (North Atlantic)", () => {
    expect(pointInZone({ lat: 50.0, lng: -10.0 }, medSoxZone)).toBe(false);
  });

  it("returns false for a point outside (South of Mediterranean)", () => {
    expect(pointInZone({ lat: 25.0, lng: 15.0 }, medSoxZone)).toBe(false);
  });
});

describe("detectZoneTransition", () => {
  const pointInside = { lat: 38.0, lng: 15.0 };
  const pointOutside = { lat: 50.0, lng: -10.0 };

  it("detects ENTRY when moving from outside to inside", () => {
    const result = detectZoneTransition(pointOutside, pointInside, medSoxZone);
    expect(result).toBe("ENTRY");
  });

  it("detects EXIT when moving from inside to outside", () => {
    const result = detectZoneTransition(pointInside, pointOutside, medSoxZone);
    expect(result).toBe("EXIT");
  });

  it("detects WITHIN when staying inside", () => {
    const result = detectZoneTransition(pointInside, pointInside, medSoxZone);
    expect(result).toBe("WITHIN");
  });

  it("returns null when staying outside", () => {
    const result = detectZoneTransition(pointOutside, pointOutside, medSoxZone);
    expect(result).toBeNull();
  });

  it("returns WITHIN when inside with no previous position", () => {
    const result = detectZoneTransition(null, pointInside, medSoxZone);
    expect(result).toBe("WITHIN");
  });

  it("returns null when outside with no previous position", () => {
    const result = detectZoneTransition(null, pointOutside, medSoxZone);
    expect(result).toBeNull();
  });
});

describe("checkZoneAlerts", () => {
  it("generates entry alert when entering a zone", () => {
    const track = [{ lat: 50.0, lng: -10.0 }, { lat: 38.0, lng: 15.0 }];
    const alerts = checkZoneAlerts(track, [medSoxZone], "v1", "2026-01-01T00:00:00Z");
    const entries = alerts.filter((a) => a.event.eventType === "ENTRY");
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for track entirely outside zone", () => {
    const track = [{ lat: 50.0, lng: -10.0 }, { lat: 55.0, lng: -5.0 }];
    const alerts = checkZoneAlerts(track, [medSoxZone], "v1", "2026-01-01T00:00:00Z");
    expect(alerts).toHaveLength(0);
  });

  it("does not emit repeated WITHIN for consecutive inside points", () => {
    const track = [
      { lat: 50.0, lng: -10.0 },
      { lat: 38.0, lng: 15.0 },
      { lat: 38.5, lng: 15.5 },
      { lat: 39.0, lng: 16.0 },
    ];
    const alerts = checkZoneAlerts(track, [medSoxZone], "v1", "2026-01-01T00:00:00Z");
    expect(alerts.filter((a) => a.event.eventType === "ENTRY")).toHaveLength(1);
    expect(alerts.filter((a) => a.event.eventType === "WITHIN")).toHaveLength(0);
  });

  it("emits a single WITHIN for a track that starts inside the zone", () => {
    const track = [
      { lat: 38.0, lng: 15.0 },
      { lat: 38.5, lng: 15.5 },
      { lat: 39.0, lng: 16.0 },
    ];
    const alerts = checkZoneAlerts(track, [medSoxZone], "v1", "2026-01-01T00:00:00Z");
    const within = alerts.filter((a) => a.event.eventType === "WITHIN");
    expect(within).toHaveLength(1);
  });

  it("skips inactive zones", () => {
    const inactive = { ...medSoxZone, isActive: false };
    const track = [{ lat: 50.0, lng: -10.0 }, { lat: 38.0, lng: 15.0 }];
    const alerts = checkZoneAlerts(track, [inactive], "v1", "2026-01-01T00:00:00Z");
    expect(alerts).toHaveLength(0);
  });
});

describe("getZoneColor", () => {
  it("returns red for ECA_SOX", () => {
    expect(getZoneColor("ECA_SOX")).toBe("#D94F4F");
  });

  it("returns gold for ECA_NOX", () => {
    expect(getZoneColor("ECA_NOX")).toBe("#C9A84C");
  });

  it("returns teal for MED_BALLAST", () => {
    expect(getZoneColor("MED_BALLAST")).toBe("#00B89F");
  });
});
