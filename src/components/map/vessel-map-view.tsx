"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as LMap } from "leaflet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProcessedTrackPoint, ZoneAlert } from "@/lib/geo/types";
import { computeDayMarkers, computeTrackStats, interpolateTrackPoint } from "@/lib/geo/track";
import { useTrackPlayback } from "@/hooks/use-track-playback";
import { DistanceScale } from "./distance-scale";
import { NorthIndicator } from "./north-indicator";
import { TrackLegend } from "./track-legend";
import { Graticule } from "./graticule";
import { TrackPlaybackBar } from "./track-playback-bar";

const MapContainer = dynamic(
  () => import("./map-container").then((m) => ({ default: m.MapContainer })),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-md" /> },
);

const TrackLayer = dynamic(
  () => import("./track-layer").then((m) => ({ default: m.TrackLayer })),
  { ssr: false },
);

const VesselMarker = dynamic(
  () => import("./vessel-marker").then((m) => ({ default: m.VesselMarker })),
  { ssr: false },
);

const PortMarker = dynamic(
  () => import("./port-marker").then((m) => ({ default: m.PortMarker })),
  { ssr: false },
);

const ZoneLayer = dynamic(
  () => import("./zone-layer").then((m) => ({ default: m.ZoneLayer })),
  { ssr: false },
);

const ZoneEventMarkers = dynamic(
  () => import("./zone-event-markers").then((m) => ({ default: m.ZoneEventMarkers })),
  { ssr: false },
);

const DayMarkers = dynamic(
  () => import("./day-markers").then((m) => ({ default: m.DayMarkers })),
  { ssr: false },
);

interface ZoneDisplayData {
  id: string;
  name: string;
  category: string;
  geometryCoordinates: unknown;
  description: string | null;
}

interface VesselMapViewProps {
  trackPoints?: readonly ProcessedTrackPoint[];
  vesselPosition?: { lat: number; lng: number } | null;
  vesselLabel?: string;
  vesselBearing?: number | null;
  departurePort?: { lat: number; lng: number; name: string } | null;
  arrivalPort?: { lat: number; lng: number; name: string } | null;
  zones?: ZoneDisplayData[];
  zoneAlerts?: ZoneAlert[];
  height?: string;
  className?: string;
}

export function VesselMapView({
  trackPoints,
  vesselPosition,
  vesselLabel,
  vesselBearing,
  departurePort,
  arrivalPort,
  zones,
  zoneAlerts = [],
  height = "h-96",
  className = "",
}: VesselMapViewProps) {
  const [mapInstance, setMapInstance] = useState<LMap | null>(null);

  const stats = useMemo(() => computeTrackStats(trackPoints ?? []), [trackPoints]);
  const dayMarkers = useMemo(
    () => computeDayMarkers(trackPoints ?? []),
    [trackPoints],
  );
  const playback = useTrackPlayback(trackPoints);

  const effectivePosition =
    playback.playbackTs != null
      ? interpolateTrackPoint(trackPoints ?? [], playback.playbackTs)
      : (vesselPosition ?? null);

  const showVessel =
    playback.playbackTs != null ? effectivePosition != null : vesselPosition != null;

  if (!trackPoints && !vesselPosition && !departurePort && !arrivalPort) {
    return (
      <div className={`flex items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/20 ${height} text-center ${className}`}>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">
            No position data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        className={`${height} w-full rounded-md`}
        center={vesselPosition ?? departurePort ?? { lat: 38.0, lng: 15.0 }}
        zoom={vesselPosition ? 8 : 6}
        onMapReady={setMapInstance}
      >
        {mapInstance && trackPoints && trackPoints.length >= 2 && (
          <TrackLayer
            map={mapInstance}
            points={trackPoints}
            cutoffTs={playback.playbackTs}
          />
        )}
        {mapInstance && showVessel && effectivePosition && (
          <VesselMarker
            map={mapInstance}
            lat={effectivePosition.lat}
            lng={effectivePosition.lng}
            label={vesselLabel}
            bearing={playback.playbackTs != null ? null : vesselBearing}
            timestamp={playback.playbackTs}
          />
        )}
        {mapInstance && departurePort && (
          <PortMarker
            map={mapInstance}
            lat={departurePort.lat}
            lng={departurePort.lng}
            name={departurePort.name}
            type="departure"
          />
        )}
        {mapInstance && arrivalPort && (
          <PortMarker
            map={mapInstance}
            lat={arrivalPort.lat}
            lng={arrivalPort.lng}
            name={arrivalPort.name}
            type="arrival"
          />
        )}
        {mapInstance && zones && zones.length > 0 && (
          <ZoneLayer map={mapInstance} zones={zones} />
        )}
        {mapInstance && (
          <>
            <ZoneEventMarkers map={mapInstance} alerts={zoneAlerts} />
            <DayMarkers map={mapInstance} markers={dayMarkers} />
            <Graticule map={mapInstance} />
            <DistanceScale map={mapInstance} />
            <NorthIndicator
              map={mapInstance}
              target={effectivePosition ?? departurePort ?? null}
              bearing={vesselBearing}
            />
            <TrackLegend
              stats={stats}
              zoneEventCount={zoneAlerts.filter((a) => a.event.coordinates).length}
            />
          </>
        )}
      </MapContainer>

      {playback.canPlayback && (
        <TrackPlaybackBar
          playbackTs={playback.playbackTs}
          playing={playback.playing}
          startTs={playback.startTs}
          endTs={playback.endTs}
          onScrub={playback.scrub}
          onToggle={playback.toggle}
          onReset={playback.reset}
        />
      )}
    </div>
  );
}
