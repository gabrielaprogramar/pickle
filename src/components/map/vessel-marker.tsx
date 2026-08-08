"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";

interface VesselMarkerProps {
  map: LMap | null;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  bearing?: number | null;
  timestamp?: string | null;
}

export function VesselMarker({
  map,
  lat,
  lng,
  label,
  color = "hsl(var(--primary))",
  bearing,
  timestamp,
}: VesselMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const arrow = (angle: number) => `
        <div style="
          position: absolute; top: 2px; left: 2px;
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-bottom: 12px solid rgba(255,255,255,0.95);
          transform: rotate(${angle}deg);
          transform-origin: 7px 11px;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.6));
        "></div>`;

      const dot = `
        <div style="
          position: relative;
          width: 18px; height: 18px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${bearing != null && Number.isFinite(bearing) ? arrow(bearing) : ""}</div>`;

      const icon = L.divIcon({
        className: "vessel-marker",
        html: dot,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const lines = [];
      if (label) lines.push(`<strong>${label}</strong>`);
      lines.push(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      if (timestamp) {
        lines.push(
          `<span style="color:#aaa;">${new Date(timestamp).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}</span>`,
        );
      }
      marker.bindPopup(
        `<div style="font-family: monospace; font-size: 11px;">${lines.join("<br/>")}</div>`,
      );

      markerRef.current = marker;
    };

    init();

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, lat, lng, label, color, bearing, timestamp]);

  return null;
}
