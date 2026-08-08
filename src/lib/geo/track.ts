import type {
  GeoPoint,
  ProcessedTrack,
  ProcessedTrackPoint,
  TrackDayMarker,
  TrackGap,
  TrackPlaybackWindow,
  TrackSplit,
  TrackStats,
} from "./types";
import type { AisPositionRow } from "../supabase/types";

const GAP_THRESHOLD_MINUTES = 120;

function haversineDistanceNm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 3440.065;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function processAisTrack(rows: readonly AisPositionRow[]): ProcessedTrack {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );

  const points: ProcessedTrackPoint[] = [];
  const gaps: TrackGap[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    if (!validateCoordinate(row.latitude, row.longitude)) continue;

    points.push({
      lat: row.latitude,
      lng: row.longitude,
      ts: row.ts,
      sog: row.sog,
      cog: row.cog,
      heading: row.heading,
      navStatus: row.nav_status,
    });

    if (i > 0) {
      const prev = sorted[i - 1]!;
      const gapMinutes =
        (new Date(row.ts).getTime() - new Date(prev.ts).getTime()) / 60000;
      if (gapMinutes > GAP_THRESHOLD_MINUTES) {
        gaps.push({
          fromTs: prev.ts,
          toTs: row.ts,
          fromPoint: { lat: prev.latitude, lng: prev.longitude },
          toPoint: { lat: row.latitude, lng: row.longitude },
          durationMinutes: Math.round(gapMinutes),
        });
      }
    }
  }

  let distanceNm: number | null = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineDistanceNm(points[i - 1]!, points[i]!);
    distanceNm += seg;
  }
  if (points.length < 2) distanceNm = null;

  return {
    points,
    pointCount: points.length,
    distanceNm: distanceNm != null ? Math.round(distanceNm * 100) / 100 : null,
    startTs: points.length > 0 ? points[0]!.ts : "",
    endTs: points.length > 0 ? points[points.length - 1]!.ts : "",
    gaps,
  };
}

export function interpolateTrackPoint(
  points: readonly ProcessedTrackPoint[],
  targetTs: string,
): GeoPoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { lat: points[0]!.lat, lng: points[0]!.lng };

  const target = new Date(targetTs).getTime();

  let before = points[0]!;
  for (let i = 1; i < points.length; i++) {
    const after = points[i]!;
    const tBefore = new Date(before.ts).getTime();
    const tAfter = new Date(after.ts).getTime();

    if (target >= tBefore && target <= tAfter) {
      const ratio = (target - tBefore) / (tAfter - tBefore);
      return {
        lat: before.lat + (after.lat - before.lat) * ratio,
        lng: before.lng + (after.lng - before.lng) * ratio,
      };
    }
    before = after;
  }

  return { lat: points[points.length - 1]!.lat, lng: points[points.length - 1]!.lng };
}

export function simplifyTrack(
  points: readonly ProcessedTrackPoint[],
  minDistanceNm: number = 0.1,
): ProcessedTrackPoint[] {
  if (points.length <= 2) return [...points];

  const result: ProcessedTrackPoint[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = haversineDistanceNm(result[result.length - 1]!, points[i]!);
    if (dist >= minDistanceNm) {
      result.push(points[i]!);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

export function computeTrackStats(
  points: readonly ProcessedTrackPoint[],
): TrackStats {
  if (points.length === 0) {
    return {
      pointCount: 0,
      distanceNm: null,
      startTs: "",
      endTs: "",
      durationHours: null,
    };
  }

  let distanceNm = 0;
  for (let i = 1; i < points.length; i++) {
    distanceNm += haversineDistanceNm(points[i - 1]!, points[i]!);
  }

  const firstTs = new Date(points[0]!.ts).getTime();
  const lastTs = new Date(points[points.length - 1]!.ts).getTime();
  const durationHours = Number.isFinite(firstTs) && Number.isFinite(lastTs)
    ? (lastTs - firstTs) / 3_600_000
    : null;

  return {
    pointCount: points.length,
    distanceNm: points.length > 1 ? Math.round(distanceNm * 100) / 100 : null,
    startTs: points[0]!.ts,
    endTs: points[points.length - 1]!.ts,
    durationHours:
      durationHours !== null ? Math.round(durationHours * 10) / 10 : null,
  };
}

export function splitTrackAt(
  points: readonly ProcessedTrackPoint[],
  ts: string | null,
): TrackSplit {
  if (!ts || points.length === 0) {
    return { lived: [...points], future: [] };
  }

  const target = new Date(ts).getTime();
  const lived: ProcessedTrackPoint[] = [];
  const future: ProcessedTrackPoint[] = [];

  for (const point of points) {
    if (new Date(point.ts).getTime() <= target) {
      lived.push(point);
    } else {
      future.push(point);
    }
  }

  return { lived, future };
}

export function computePlaybackWindow(
  points: readonly ProcessedTrackPoint[],
): TrackPlaybackWindow | null {
  if (points.length < 2) return null;
  const startTs = points[0]!.ts;
  const endTs = points[points.length - 1]!.ts;
  const durationMs =
    new Date(endTs).getTime() - new Date(startTs).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  return { startTs, endTs, durationMs };
}

export function computeDayMarkers(
  points: readonly ProcessedTrackPoint[],
): TrackDayMarker[] {
  if (points.length < 2) return [];

  const startMs = new Date(points[0]!.ts).getTime();
  const endMs = new Date(points[points.length - 1]!.ts).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const markers: TrackDayMarker[] = [];

  let dayIndex = 0;
  let boundaryMs = startMs + DAY_MS;
  while (boundaryMs <= endMs) {
    dayIndex += 1;
    const position = interpolateTrackPoint(
      points,
      new Date(boundaryMs).toISOString(),
    );
    if (position) {
      markers.push({
        lat: position.lat,
        lng: position.lng,
        ts: new Date(boundaryMs).toISOString(),
        dayIndex,
      });
    }
    boundaryMs += DAY_MS;
  }

  return markers;
}
