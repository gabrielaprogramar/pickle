"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computePlaybackWindow } from "@/lib/geo/track";
import type { ProcessedTrackPoint } from "@/lib/geo/types";

const TICK_MS = 250;
const PLAYBACK_WALL_MS = 20_000;

interface UseTrackPlaybackResult {
  playbackTs: string | null;
  playing: boolean;
  canPlayback: boolean;
  startTs: string | null;
  endTs: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  scrub: (ts: string) => void;
  reset: () => void;
}

export function useTrackPlayback(
  points: readonly ProcessedTrackPoint[] | undefined,
): UseTrackPlaybackResult {
  const window = useMemo(() => computePlaybackWindow(points ?? []), [points]);
  const [playbackTs, setPlaybackTs] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tsRef = useRef<string | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    stopInterval();
    tsRef.current = null;
    setPlaybackTs(null);
    return stopInterval;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window?.startTs, window?.endTs, window?.durationMs, stopInterval]);

  const advance = useCallback(() => {
    if (!window) return;
    const currentMs = new Date(tsRef.current ?? window.startTs).getTime();
    const stepMs =
      window.durationMs * (TICK_MS / PLAYBACK_WALL_MS);
    const nextMs = currentMs + stepMs;
    const endMs = new Date(window.endTs).getTime();

    if (nextMs >= endMs) {
      tsRef.current = window.endTs;
      setPlaybackTs(window.endTs);
      stopInterval();
      return;
    }

    const next = new Date(nextMs).toISOString();
    tsRef.current = next;
    setPlaybackTs(next);
  }, [window, stopInterval]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(advance, TICK_MS);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [playing, advance]);

  const play = useCallback(() => {
    if (!window) return;
    if (!tsRef.current || new Date(tsRef.current).getTime() >= new Date(window.endTs).getTime()) {
      tsRef.current = window.startTs;
      setPlaybackTs(window.startTs);
    }
    setPlaying(true);
  }, [window]);

  const pause = useCallback(() => {
    stopInterval();
  }, [stopInterval]);

  const toggle = useCallback(() => {
    if (playing) {
      pause();
    } else {
      play();
    }
  }, [playing, pause, play]);

  const scrub = useCallback((ts: string) => {
    tsRef.current = ts;
    setPlaybackTs(ts);
  }, []);

  const reset = useCallback(() => {
    stopInterval();
    tsRef.current = null;
    setPlaybackTs(null);
  }, [stopInterval]);

  return {
    playbackTs,
    playing,
    canPlayback: window !== null,
    startTs: window?.startTs ?? null,
    endTs: window?.endTs ?? null,
    play,
    pause,
    toggle,
    scrub,
    reset,
  };
}
