"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";

interface PortMarkerProps {
  map: LMap | null;
  lat: number;
  lng: number;
  name: string;
  type?: "departure" | "arrival";
}

export function PortMarker({
  map,
  lat,
  lng,
  name,
  type = "arrival",
}: PortMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const color = type === "departure" ? "#00B89F" : "#D94F4F";
      const icon = L.divIcon({
        className: "port-marker",
        html: `<div style="
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px;
          background: ${color};
          border: 2px solid white;
          border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          color: white;
          font-size: 12px;
          font-weight: bold;
        ">${type === "departure" ? "&#x2693;" : "&#x1F4CD;"}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: monospace; font-size: 11px;">
            <strong>${name}</strong><br/>
            ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>`,
        );
    };

    init();

    return () => {
      // handled by parent
    };
  }, [map, lat, lng, name, type]);

  return null;
}
