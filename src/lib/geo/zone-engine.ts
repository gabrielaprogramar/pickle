import type {
  EnvironmentalZone,
  GeoPoint,
  ZoneAlert,
  ZoneEvent,
  ZoneEventType,
} from "./types";

function parseCoordinatesPolygon(coords: number[][][]): GeoPoint[] {
  if (!coords || coords.length === 0) return [];
  const ring = coords[0];
  if (!ring) return [];
  return ring
    .filter((c): c is [number, number] | number[] => c.length >= 2)
    .map((c) => ({
      lat: c[1] as number,
      lng: c[0] as number,
    }));
}

function parseCoordinates(raw: unknown): GeoPoint[] {
  if (!raw || !Array.isArray(raw)) return [];
  const first = raw[0];
  if (!first) return [];
  if (Array.isArray(first)) {
    const inner = first as number[];
    if (inner.length >= 2 && typeof inner[0] === "number") {
      return (raw as number[][]).map((c) => ({
        lat: c[1] as number,
        lng: c[0] as number,
      }));
    }
    return parseCoordinatesPolygon(raw as number[][][]);
  }
  return [];
}

function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.lng;
    const yi = polygon[i]!.lat;
    const xj = polygon[j]!.lng;
    const yj = polygon[j]!.lat;
    if (yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInZone(point: GeoPoint, zone: EnvironmentalZone): boolean {
  const coords = parseCoordinates(zone.geometryCoordinates);
  if (coords.length < 3) return false;
  return pointInPolygon(point, coords);
}

export function detectZoneTransition(
  prevPoint: GeoPoint | null,
  currentPoint: GeoPoint,
  zone: EnvironmentalZone,
): ZoneEventType | null {
  const currentInside = pointInZone(currentPoint, zone);
  if (prevPoint === null) {
    return currentInside ? "WITHIN" : null;
  }
  const prevInside = pointInZone(prevPoint, zone);
  if (!prevInside && currentInside) return "ENTRY";
  if (prevInside && !currentInside) return "EXIT";
  if (currentInside) return "WITHIN";
  return null;
}

export function checkZoneAlerts(
  trackPoints: readonly GeoPoint[],
  zones: readonly EnvironmentalZone[],
  vesselId: string,
  now: string,
): ZoneAlert[] {
  const alerts: ZoneAlert[] = [];
  for (const zone of zones) {
    if (!zone.isActive) continue;
    for (let i = 0; i < trackPoints.length; i++) {
      const current = trackPoints[i]!;
      const prev: GeoPoint | null = i > 0 ? (trackPoints[i - 1] ?? null) : null;
      const eventType = detectZoneTransition(prev, current, zone);
      if (eventType === null) continue;
      const event: ZoneEvent = {
        id: "",
        vesselId,
        zoneId: zone.id,
        eventType,
        aisPositionId: null,
        detectedAt: now,
        entryTs: eventType === "ENTRY" ? now : null,
        exitTs: eventType === "EXIT" ? now : null,
        durationMinutes: null,
        coordinates: current,
        details: null,
        calculationVersion: "1.0",
      };
      const severity = eventType === "ENTRY" ? "warning" : "info";
      const message = `${eventType === "ENTRY" ? "Vessel entered" : eventType === "EXIT" ? "Vessel exited" : "Vessel is within"} ${zone.name}`;
      alerts.push({ zone, event, message, severity } as ZoneAlert);
    }
  }
  return alerts;
}

export function getZoneColor(category: string): string {
  switch (category) {
    case "ECA_SOX":
      return "#D94F4F";
    case "ECA_NOX":
      return "#C9A84C";
    case "SECA":
      return "#D94F4F";
    case "PSSA":
      return "#C9A84C";
    case "MED_BALLAST":
      return "#00B89F";
    case "PORT_CONTROL":
      return "#C9A84C";
    default:
      return "#00B89F";
  }
}
