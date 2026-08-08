"use client";

import { useCallback, useEffect, useState } from "react";
import type { Map as LMap } from "leaflet";

const NM_STEPS: readonly number[] = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
];

const BAR_PX = 80;

function pickStep(maxNm: number): number {
  for (const step of NM_STEPS) {
    if (maxNm >= step) return step;
  }
  return NM_STEPS[NM_STEPS.length - 1]!;
}

export function DistanceScale({ map }: { map: LMap | null }) {
  const [width, setWidth] = useState(0);
  const [label, setLabel] = useState("");

  const update = useCallback(() => {
    if (!map) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const y = size.y / 2;
    const left = map.containerPointToLatLng([0, y]);
    const right = map.containerPointToLatLng([BAR_PX, y]);
    const metersPerBar = left.distanceTo(right);
    if (!Number.isFinite(metersPerBar) || metersPerBar <= 0) return;

    const maxNm = metersPerBar / 1852;
    const step = pickStep(maxNm);
    const px = Math.max(
      24,
      Math.round((step * 1852) / (metersPerBar / BAR_PX)),
    );

    setWidth(px);
    setLabel(`${step} nm`);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    update();
    map.on("zoomend moveend", update);
    return () => {
      map.off("zoomend moveend", update);
    };
  }, [map, update]);

  if (!label) return null;

  return (
    <div
      className="leaflet-bottom leaflet-left"
      style={{ margin: "12px 14px", pointerEvents: "none" }}
    >
      <div className="map-scale-bar">
        <span className="map-scale-bar__label">{label}</span>
        <div
          className="map-scale-bar__bar"
          style={{ width: `${width}px` }}
        />
      </div>
    </div>
  );
}
