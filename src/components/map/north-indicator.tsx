"use client";

import { useCallback } from "react";
import type { Map as LMap } from "leaflet";
import { LocateFixed } from "lucide-react";

interface NorthIndicatorProps {
  map: LMap | null;
  target?: { lat: number; lng: number } | null;
  zoom?: number;
  bearing?: number | null;
}

export function NorthIndicator({
  map,
  target,
  zoom,
  bearing,
}: NorthIndicatorProps) {
  const recenter = useCallback(() => {
    if (!map || !target) return;
    map.setView([target.lat, target.lng], zoom ?? map.getZoom(), {
      animate: true,
      duration: 0.6,
    });
  }, [map, target, zoom]);

  return (
    <div
      className="leaflet-top leaflet-right"
      style={{ margin: "12px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
    >
      {bearing != null && Number.isFinite(bearing) && (
        <div
          className="map-overlay-panel flex items-center justify-center h-9 w-9 rounded-full border border-white/10 bg-[#0D1B30]/90 shadow-lg backdrop-blur-sm"
          style={{ pointerEvents: "none" }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" style={{ transform: `rotate(${bearing}deg)` }}>
            <polygon points="11,1 14,15 11,12 8,15" fill="#00D4B8" stroke="#0D1B30" strokeWidth="0.5" />
            <polygon points="11,21 14,7 11,10 8,7" fill="#D94F4F" stroke="#0D1B30" strokeWidth="0.5" />
            <circle cx="11" cy="11" r="1.2" fill="#0D1B30" />
          </svg>
        </div>
      )}
      <button
        type="button"
        onClick={recenter}
        disabled={!map || !target}
        title="Re-center on vessel (north up)"
        className="map-overlay-panel flex items-center justify-center h-9 w-9 rounded-md border border-white/10 bg-[#0D1B30]/90 shadow-lg backdrop-blur-sm text-white/85 transition-colors hover:text-[#00D4B8] hover:border-[#00D4B8]/40 disabled:opacity-40"
      >
        <LocateFixed className="h-4 w-4" />
      </button>
    </div>
  );
}
