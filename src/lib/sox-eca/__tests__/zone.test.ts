import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  SOX_MOCK_ZONE,
  SOX_POSITION_INSIDE,
  SOX_POSITION_OUTSIDE,
} from "../mock-data";
import { toEnvironmentalZone, hasUsableGeometry, isMedSoxZone, isInsideZone, computeZoneState } from "../zone";

describe("sox-eca zone — geometry reuse", () => {
  it("recognises the seeded Med SOx ECA row as usable", () => {
    const row = {
      id: "z1",
      code: "MED_SOX_ECA",
      name: "Mediterranean Sea SOx Emission Control Area",
      category: "ECA_SOX",
      geometry_type: "POLYGON",
      geometry_coordinates: SOX_MOCK_ZONE.geometryCoordinates,
      description: null,
      regulation_reference: null,
      geometry_version: "1.0",
      jurisdiction: null,
      effective_from: "2025-05-01",
      effective_until: null,
      is_active: true,
    };
    const zone = toEnvironmentalZone(row);
    expect(zone.code).toBe("MED_SOX_ECA");
    expect(zone.category).toBe("ECA_SOX");
    expect(hasUsableGeometry(zone)).toBe(true);
    expect(isMedSoxZone(zone)).toBe(true);
  });

  it("rejects null / empty geometry", () => {
    expect(hasUsableGeometry(null)).toBe(false);
    expect(hasUsableGeometry({ ...SOX_MOCK_ZONE, geometryCoordinates: [] })).toBe(false);
    expect(hasUsableGeometry({ ...SOX_MOCK_ZONE, geometryCoordinates: [[], []] })).toBe(false);
  });

  it("determines inside/outside via the existing geo engine", () => {
    expect(isInsideZone({ lat: SOX_POSITION_INSIDE.lat, lng: SOX_POSITION_INSIDE.lng }, SOX_MOCK_ZONE)).toBe(true);
    expect(isInsideZone({ lat: SOX_POSITION_OUTSIDE.lat, lng: SOX_POSITION_OUTSIDE.lng }, SOX_MOCK_ZONE)).toBe(false);
    expect(isInsideZone(null, SOX_MOCK_ZONE)).toBe(false);
  });
});

describe("sox-eca zone — transition state", () => {
  const inside = { lat: SOX_POSITION_INSIDE.lat, lng: SOX_POSITION_INSIDE.lng };
  const outside = { lat: SOX_POSITION_OUTSIDE.lat, lng: SOX_POSITION_OUTSIDE.lng };

  it("detects ENTRY when moving from outside to inside", () => {
    expect(computeZoneState("OUTSIDE", inside, outside, SOX_MOCK_ZONE)).toBe("ENTRY");
  });

  it("detects EXIT when moving from inside to outside", () => {
    expect(computeZoneState("WITHIN", outside, inside, SOX_MOCK_ZONE)).toBe("EXIT");
  });

  it("returns WITHIN while staying inside", () => {
    expect(computeZoneState("ENTRY", inside, inside, SOX_MOCK_ZONE)).toBe("WITHIN");
    expect(computeZoneState("WITHIN", inside, inside, SOX_MOCK_ZONE)).toBe("WITHIN");
  });

  it("returns OUTSIDE while staying outside", () => {
    expect(computeZoneState("OUTSIDE", outside, outside, SOX_MOCK_ZONE)).toBe("OUTSIDE");
  });

  it("infers ENTRY from previous state alone when no previous position exists", () => {
    expect(computeZoneState("OUTSIDE", inside, null, SOX_MOCK_ZONE)).toBe("ENTRY");
    expect(computeZoneState(null, inside, null, SOX_MOCK_ZONE)).toBe("ENTRY");
  });

  it("infers EXIT from previous state alone when no previous position exists", () => {
    expect(computeZoneState("WITHIN", outside, null, SOX_MOCK_ZONE)).toBe("EXIT");
  });

  it("stays OUTSIDE when the zone geometry is unavailable", () => {
    expect(computeZoneState("WITHIN", inside, null, null)).toBe("OUTSIDE");
    expect(computeZoneState(null, inside, null, null)).toBe("OUTSIDE");
  });
});

run();
