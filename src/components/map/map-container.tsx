"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Map as LMap } from "leaflet";
import { MED_DEFAULTS } from "@/lib/geo/constants";

interface MapContainerProps {
  children?: ReactNode;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMapReady?: (map: LMap) => void;
}

export function MapContainer({
  children,
  center = MED_DEFAULTS.center,
  zoom = MED_DEFAULTS.zoom,
  className = "h-96 w-full rounded-md",
  onMapReady,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LMap | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      await import("leaflet/dist/leaflet.css");

      const map = L.map(mapRef.current!, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 18,
        },
      ).addTo(map);

      const el = mapRef.current;
      const observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(el!);
      observerRef.current = observer;

      mapInstanceRef.current = map;
      onMapReady?.(map);
    };

    initMap();

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mapRef} className={className}>
      {children}
    </div>
  );
}
