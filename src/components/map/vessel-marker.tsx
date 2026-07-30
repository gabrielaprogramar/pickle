"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";

interface VesselMarkerProps {
  map: LMap | null;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export function VesselMarker({
  map,
  lat,
  lng,
  label,
  color = "#00B89F",
}: VesselMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const icon = L.divIcon({
        className: "vessel-marker",
        html: `<div style="
          width: 18px; height: 18px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      if (label) {
        marker.bindPopup(
          `<div style="font-family: monospace; font-size: 11px;">
            <strong>${label}</strong><br/>
            ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>`,
        );
      }

      markerRef.current = marker;
    };

    init();

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, lat, lng, label, color]);

  return null;
}
