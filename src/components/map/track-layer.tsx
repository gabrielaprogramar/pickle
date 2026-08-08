"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import type { ProcessedTrackPoint } from "@/lib/geo/types";
import { VESSEL_DEFAULTS } from "@/lib/geo/constants";
import { splitTrackAt } from "@/lib/geo/track";

interface TrackLayerProps {
  map: LMap | null;
  points: readonly ProcessedTrackPoint[];
  cutoffTs?: string | null;
  color?: string;
  weight?: number;
  opacity?: number;
}

export function TrackLayer({
  map,
  points,
  cutoffTs = null,
  color = VESSEL_DEFAULTS.trackColor,
  weight = VESSEL_DEFAULTS.trackWeight,
  opacity = VESSEL_DEFAULTS.trackOpacity,
}: TrackLayerProps) {
  const groupRef = useRef<L.LayerGroup | null>(null);
  const didFitRef = useRef(false);
  const trackSigRef = useRef("");

  useEffect(() => {
    if (!map || points.length < 2) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (groupRef.current) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }

      const sig = `${points[0]?.ts ?? ""}|${points[points.length - 1]?.ts ?? ""}|${points.length}`;
      if (sig !== trackSigRef.current) {
        trackSigRef.current = sig;
        didFitRef.current = false;
      }

      const group = L.layerGroup().addTo(map);
      groupRef.current = group;

      const split = splitTrackAt(points, cutoffTs);
      const latlngs = (pts: readonly ProcessedTrackPoint[]) =>
        pts.map((p) => [p.lat, p.lng] as [number, number]);

      if (split.lived.length >= 2) {
        L.polyline(latlngs(split.lived), {
          color,
          weight,
          opacity,
          smoothFactor: 1,
        }).addTo(group);
      }

      if (split.future.length >= 2) {
        L.polyline(latlngs(split.future), {
          color: "rgba(255,255,255,0.35)",
          weight: Math.max(weight - 1, 1.5),
          opacity: 0.5,
          dashArray: "6 6",
          smoothFactor: 1,
        }).addTo(group);
      }

      if (!didFitRef.current && (split.lived.length >= 2 || split.future.length >= 2)) {
        const all = split.lived.concat(split.future);
        const bounds = L.latLngBounds(all.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [30, 30] });
        didFitRef.current = true;
      }
    };

    init();

    return () => {
      if (groupRef.current) {
        map?.removeLayer(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [map, points, cutoffTs, color, weight, opacity]);

  return null;
}
