"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import type { ZoneAlert, ZoneEventType } from "@/lib/geo/types";

const EVENT_COLORS: Record<ZoneEventType, string> = {
  ENTRY: "#D94F4F",
  EXIT: "#00B89F",
  WITHIN: "#C9A84C",
  ALERT: "#9B6BFF",
};

const EVENT_LABELS: Record<ZoneEventType, string> = {
  ENTRY: "Entry",
  EXIT: "Exit",
  WITHIN: "Within",
  ALERT: "Alert",
};

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ZoneEventMarkersProps {
  map: LMap | null;
  alerts: readonly ZoneAlert[];
}

export function ZoneEventMarkers({ map, alerts }: ZoneEventMarkersProps) {
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

      for (const alert of alerts) {
        const { event, zone } = alert;
        if (!event.coordinates) continue;
        const color = EVENT_COLORS[event.eventType] ?? "#9B6BFF";

        const icon = L.divIcon({
          className: "zone-event-marker",
          html: `<div style="
            display: flex; align-items: center; justify-content: center;
            width: 20px; height: 20px;
            background: ${color};
            border: 2px solid rgba(255,255,255,0.85);
            border-radius: 4px;
            transform: rotate(45deg);
            box-shadow: 0 2px 6px rgba(0,0,0,0.45);
          "><div style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.9);transform:rotate(-45deg);"></div></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        });

        L.marker([event.coordinates.lat, event.coordinates.lng], { icon })
          .addTo(group)
          .bindPopup(
            `<div style="font-family: monospace; font-size: 11px; max-width: 220px;">
              <strong style="color: ${color};">${EVENT_LABELS[event.eventType]}</strong>
              <span style="color: #888;"> · ${zone.name}</span><br/>
              <span style="color: #aaa;">${formatTs(event.detectedAt)}</span><br/>
              ${event.coordinates.lat.toFixed(4)}, ${event.coordinates.lng.toFixed(4)}
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
  }, [map, alerts]);

  return null;
}
