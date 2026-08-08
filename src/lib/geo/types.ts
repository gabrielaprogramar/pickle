export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface GeoPolygon {
  readonly type: "Polygon";
  readonly coordinates: number[][][];
}

export interface GeoMultiPolygon {
  readonly type: "MultiPolygon";
  readonly coordinates: number[][][][];
}

export type GeoGeometry = GeoPolygon | GeoMultiPolygon;

export type ZoneCategory =
  | "ECA_SOX"
  | "ECA_NOX"
  | "SECA"
  | "PSSA"
  | "MED_BALLAST"
  | "PORT_CONTROL";

export type ZoneEventType = "ENTRY" | "EXIT" | "WITHIN" | "ALERT";

export interface EnvironmentalZone {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: ZoneCategory;
  readonly geometryType: string;
  readonly geometryCoordinates: number[] | number[][] | number[][][] | number[][][][];
  readonly description: string | null;
  readonly regulationReference: string | null;
  readonly geometryVersion: string;
  readonly jurisdiction: string | null;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly isActive: boolean;
}

export interface PortCall {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string | null;
  readonly portName: string;
  readonly portId: string | null;
  readonly portCountry: string | null;
  readonly portLatitude: number | null;
  readonly portLongitude: number | null;
  readonly arrTs: string | null;
  readonly depTs: string | null;
  readonly isMock: boolean;
  readonly source: string;
}

export interface ZoneEvent {
  readonly id: string;
  readonly vesselId: string;
  readonly zoneId: string;
  readonly eventType: ZoneEventType;
  readonly aisPositionId: string | null;
  readonly detectedAt: string;
  readonly entryTs: string | null;
  readonly exitTs: string | null;
  readonly durationMinutes: number | null;
  readonly coordinates: GeoPoint | null;
  readonly details: Record<string, unknown> | null;
  readonly calculationVersion: string;
}

export interface ZoneAlert {
  readonly zone: EnvironmentalZone;
  readonly event: ZoneEvent;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
}

export interface ProcessedTrackPoint extends GeoPoint {
  readonly ts: string;
  readonly sog: number | null;
  readonly cog: number | null;
  readonly heading: number | null;
  readonly navStatus: string | null;
}

export interface ProcessedTrack {
  readonly points: readonly ProcessedTrackPoint[];
  readonly pointCount: number;
  readonly distanceNm: number | null;
  readonly startTs: string;
  readonly endTs: string;
  readonly gaps: readonly TrackGap[];
}

export interface TrackGap {
  readonly fromTs: string;
  readonly toTs: string;
  readonly fromPoint: GeoPoint;
  readonly toPoint: GeoPoint;
  readonly durationMinutes: number;
}

export interface TrackDayMarker extends GeoPoint {
  readonly ts: string;
  readonly dayIndex: number;
}

export interface TrackPlaybackWindow {
  readonly startTs: string;
  readonly endTs: string;
  readonly durationMs: number;
}

export interface TrackSplit {
  readonly lived: readonly ProcessedTrackPoint[];
  readonly future: readonly ProcessedTrackPoint[];
}

export interface TrackStats {
  readonly pointCount: number;
  readonly distanceNm: number | null;
  readonly startTs: string;
  readonly endTs: string;
  readonly durationHours: number | null;
}
