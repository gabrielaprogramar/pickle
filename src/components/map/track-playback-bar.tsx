"use client";

import { useMemo } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLIDER_STEPS = 1000;

interface TrackPlaybackBarProps {
  playbackTs: string | null;
  playing: boolean;
  startTs: string | null;
  endTs: string | null;
  onScrub: (ts: string) => void;
  onToggle: () => void;
  onReset: () => void;
}

function formatClock(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDay(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function TrackPlaybackBar({
  playbackTs,
  playing,
  startTs,
  endTs,
  onScrub,
  onToggle,
  onReset,
}: TrackPlaybackBarProps) {
  const bounds = useMemo(() => {
    if (!startTs || !endTs) return null;
    const start = new Date(startTs).getTime();
    const end = new Date(endTs).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end };
  }, [startTs, endTs]);

  if (!bounds) return null;

  const value = playbackTs
    ? Math.round(
        ((new Date(playbackTs).getTime() - bounds.start) /
          (bounds.end - bounds.start)) *
          SLIDER_STEPS,
      )
    : SLIDER_STEPS;

  const handleChange = (v: number) => {
    const ts = new Date(
      bounds.start + (v / SLIDER_STEPS) * (bounds.end - bounds.start),
    ).toISOString();
    onScrub(ts);
  };

  return (
    <div className="mt-2 flex items-center gap-3 rounded-md border border-white/10 bg-[#0D1B30]/80 px-3 py-2 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-white/85 hover:text-[#00D4B8]"
        onClick={onToggle}
        title={playing ? "Pause" : "Play track"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>

      <span className="w-20 shrink-0 font-mono-technical text-[10px] tabular-nums text-white/80">
        {playbackTs ? formatClock(playbackTs) : "Live"}
      </span>

      <input
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="flex-1 cursor-pointer"
        aria-label="Track playback position"
      />

      <span className="w-14 shrink-0 text-right font-mono-technical text-[10px] tabular-nums text-white/50">
        {formatDay(playbackTs ?? endTs!)}
      </span>

      {playbackTs && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-white/60 hover:text-white"
          onClick={onReset}
          title="Back to live position"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
