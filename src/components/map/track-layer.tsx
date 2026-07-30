"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import type { ProcessedTrackPoint } from "@/lib/geo/types";
import { VESSEL_DEFAULTS } from "@/lib/geo/constants";

interface TrackLayerProps {
  map: LMap | null;
  points: readonly ProcessedTrackPoint[];
  color?: string;
  weight?: number;
  opacity?: number;
}

export function TrackLayer({
  map,
  points,
  color = VESSEL_DEFAULTS.trackColor,
  weight = VESSEL_DEFAULTS.trackWeight,
  opacity = VESSEL_DEFAULTS.trackOpacity,
}: TrackLayerProps) {
  const layerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || points.length < 2) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (layerRef.current) {
        layerRef.current.remove();
      }

      const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      const polyline = L.polyline(latlngs, {
        color,
        weight,
        opacity,
        smoothFactor: 1,
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

      layerRef.current = polyline;
    };

    init();

    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, [map, points, color, weight, opacity]);

  return null;
}
