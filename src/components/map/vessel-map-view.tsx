"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProcessedTrackPoint } from "@/lib/geo/types";

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
  departurePort?: { lat: number; lng: number; name: string } | null;
  arrivalPort?: { lat: number; lng: number; name: string } | null;
  zones?: ZoneDisplayData[];
  height?: string;
  className?: string;
}

export function VesselMapView({
  trackPoints,
  vesselPosition,
  vesselLabel,
  departurePort,
  arrivalPort,
  zones,
  height = "h-96",
  className = "",
}: VesselMapViewProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

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
    <MapContainer
      className={`${height} w-full rounded-md ${className}`}
      center={vesselPosition ?? departurePort ?? { lat: 38.0, lng: 15.0 }}
      zoom={vesselPosition ? 8 : 6}
      onMapReady={setMapInstance}
    >
      {mapInstance && trackPoints && trackPoints.length >= 2 && (
        <TrackLayer map={mapInstance} points={trackPoints} />
      )}
      {mapInstance && vesselPosition && (
        <VesselMarker
          map={mapInstance}
          lat={vesselPosition.lat}
          lng={vesselPosition.lng}
          label={vesselLabel}
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
    </MapContainer>
  );
}
