"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import type { TrackDayMarker } from "@/lib/geo/types";

interface DayMarkersProps {
  map: LMap | null;
  markers: readonly TrackDayMarker[];
}

export function DayMarkers({ map, markers }: DayMarkersProps) {
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (groupRef.current) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }

      const group = L.layerGroup().addTo(map);
      groupRef.current = group;

      for (const marker of markers) {
        const icon = L.divIcon({
          className: "day-marker",
          html: `<div style="
            display: flex; align-items: center; justify-content: center;
            width: 16px; height: 16px;
            background: transparent;
            border: 1.5px solid rgba(255,255,255,0.75);
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(0,0,0,0.25);
          "><div style="width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.85);"></div></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -12],
        });

        L.marker([marker.lat, marker.lng], { icon })
          .addTo(group)
          .bindPopup(
            `<div style="font-family: monospace; font-size: 11px;">
              <strong>Day ${marker.dayIndex}</strong><br/>
              <span style="color: #aaa;">${new Date(marker.ts).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</span><br/>
              ${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}
            </div>`,
          );
      }
    };

    init();

    return () => {
      if (groupRef.current) {
        map?.removeLayer(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [map, markers]);

  return null;
}
