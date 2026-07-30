"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProcessedTrack } from "@/lib/geo/types";

interface UseVesselTrackResult {
  track: ProcessedTrack | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVesselTrack(imo: string | null): UseVesselTrackResult {
  const [track, setTrack] = useState<ProcessedTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrack = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vessels/${imo}/track`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTrack(data.track);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchTrack();
  }, [fetchTrack]);

  return { track, isLoading, error, refetch: fetchTrack };
}
