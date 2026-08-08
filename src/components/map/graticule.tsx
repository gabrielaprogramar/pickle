"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap } from "leaflet";

function stepForZoom(zoom: number): number {
  if (zoom >= 10) return 0.5;
  if (zoom >= 8) return 1;
  if (zoom >= 6) return 2;
  if (zoom >= 4) return 5;
  return 10;
}

function stepForLat(zoom: number): number {
  if (zoom >= 10) return 0.5;
  if (zoom >= 8) return 1;
  if (zoom >= 6) return 2;
  if (zoom >= 4) return 5;
  return 10;
}

interface GraticuleProps {
  map: LMap | null;
}

export function Graticule({ map }: GraticuleProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      if (!paneRef.current) {
        paneRef.current = map.createPane("graticulePane");
        paneRef.current.style.zIndex = "350";
        paneRef.current.style.pointerEvents = "none";
      }

      if (!svgRef.current) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.setAttribute("class", "map-graticule");
        paneRef.current.appendChild(svg);
        svgRef.current = svg;
      }
    };

    init();
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const draw = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const size = map.getSize();
      svg.setAttribute("width", String(size.x));
      svg.setAttribute("height", String(size.y));
      svg.innerHTML = "";

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const lngStep = stepForZoom(zoom);
      const latStep = stepForLat(zoom);

      const west = Math.floor(bounds.getWest() / lngStep) * lngStep;
      const east = Math.ceil(bounds.getEast() / lngStep) * lngStep;
      const south = Math.floor(bounds.getSouth() / latStep) * latStep;
      const north = Math.ceil(bounds.getNorth() / latStep) * latStep;

      const ns = "http://www.w3.org/2000/svg";
      const lineColor = "rgba(255, 255, 255, 0.12)";
      const lineWidth = 1;

      for (let lat = south; lat <= north; lat += latStep) {
        const start = map.latLngToLayerPoint([lat, bounds.getWest()]);
        const end = map.latLngToLayerPoint([lat, bounds.getEast()]);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        line.setAttribute("stroke", lineColor);
        line.setAttribute("stroke-width", String(lineWidth));
        svg.appendChild(line);

        const label = document.createElementNS(ns, "text");
        label.setAttribute("class", "map-graticule-label");
        label.setAttribute("x", String(Math.max(3, Math.round(start.x) + 4)));
        label.setAttribute("y", String(Math.max(10, Math.round(start.y) - 3)));
        label.textContent = `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`;
        svg.appendChild(label);
      }

      for (let lng = west; lng <= east; lng += lngStep) {
        const start = map.latLngToLayerPoint([bounds.getNorth(), lng]);
        const end = map.latLngToLayerPoint([bounds.getSouth(), lng]);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        line.setAttribute("stroke", lineColor);
        line.setAttribute("stroke-width", String(lineWidth));
        svg.appendChild(line);

        const label = document.createElementNS(ns, "text");
        label.setAttribute("class", "map-graticule-label");
        label.setAttribute("x", String(Math.round(start.x) + 4));
        label.setAttribute("y", String(Math.max(size.y - 6, 10)));
        label.textContent = `${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}`;
        svg.appendChild(label);
      }
    };

    draw();
    map.on("move zoomend viewreset", draw);
    return () => {
      map.off("move zoomend viewreset", draw);
    };
  }, [map]);

  return null;
}
