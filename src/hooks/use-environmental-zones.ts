"use client";

import { useState, useEffect, useCallback } from "react";
import type { EnvironmentalZoneRow } from "@/lib/supabase/types";

interface UseEnvironmentalZonesResult {
  zones: EnvironmentalZoneRow[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useEnvironmentalZones(): UseEnvironmentalZonesResult {
  const [zones, setZones] = useState<EnvironmentalZoneRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/environmental-zones");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setZones(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  return { zones, isLoading, error, refetch: fetchZones };
}
