"use client";

import type { TrackStats } from "@/lib/geo/types";

function formatDuration(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return `${d}d ${h}h`;
}

interface TrackLegendProps {
  stats: TrackStats | null;
  zoneEventCount?: number;
}

export function TrackLegend({ stats, zoneEventCount = 0 }: TrackLegendProps) {
  return (
    <div
      className="leaflet-top leaflet-left"
      style={{ margin: "12px 14px" }}
    >
      <div
        className="map-overlay-panel rounded-md border border-white/10 bg-[#0D1B30]/90 px-3 py-2 shadow-lg backdrop-blur-sm"
        style={{ marginTop: 56 }}
      >
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">
          Track
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-4 rounded-full bg-[#00B89F]" />
            <span className="font-mono-technical text-[10px] tabular-nums text-white/85">
              {stats?.distanceNm != null ? `${stats.distanceNm} nm` : "—"}
            </span>
          </div>
          <div className="font-mono-technical text-[10px] tabular-nums text-white/85">
            {formatDuration(stats?.durationHours ?? null)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-4 rounded-full border border-dashed border-white/40" />
            <span className="font-mono-technical text-[10px] tabular-nums text-white/85">
              ahead
            </span>
          </div>
          <div className="font-mono-technical text-[10px] tabular-nums text-white/85">
            {stats?.pointCount ?? 0} pts
          </div>
        </div>
        {zoneEventCount > 0 && (
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#C9A84C]">
            {zoneEventCount} zone event{zoneEventCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
