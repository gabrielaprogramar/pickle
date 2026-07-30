"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";
import { getZoneColor } from "@/lib/geo/zone-engine";

interface ZoneLayerProps {
  map: LMap | null;
  zones: Array<{
    id: string;
    name: string;
    category: string;
    geometryCoordinates: unknown;
    description: string | null;
  }>;
}

export function ZoneLayer({ map, zones }: ZoneLayerProps) {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map || zones.length === 0) return;

    const init = async () => {
      const L = (await import("leaflet")).default;

      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
      } else {
        layerGroupRef.current = L.layerGroup().addTo(map);
      }

      const group = layerGroupRef.current;

      for (const zone of zones) {
        const coords = zone.geometryCoordinates as number[][][] | undefined;
        if (!coords || !Array.isArray(coords) || coords.length === 0) continue;

        const ring = coords[0];
        if (!ring) continue;

        const color = getZoneColor(zone.category);
        const latlngs: [number, number][] = ring
          .filter((c): c is number[] => Array.isArray(c) && c.length >= 2)
          .map((c) => [c[1] as number, c[0] as number]);

        if (latlngs.length < 3) continue;

        const polygon = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 1.5,
          opacity: 0.6,
        });

        polygon.bindPopup(
          `<div style="font-family: monospace; font-size: 11px; max-width: 220px;">
            <strong>${zone.name}</strong><br/>
            <span style="color: #666;">${zone.category}</span>
            ${zone.description ? `<br/><br/>${zone.description}` : ""}
          </div>`,
        );

        group.addLayer(polygon);
      }
    };

    init();

    return () => {
      // cleanup handled by parent
    };
  }, [map, zones]);

  return null;
}
