"use client";

import { useState, useEffect, useCallback } from "react";
import type { ZoneAlert } from "@/lib/geo/types";

interface UseZoneEventsResult {
  alerts: ZoneAlert[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useZoneEvents(imo: string | null): UseZoneEventsResult {
  const [alerts, setAlerts] = useState<ZoneAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vessels/${imo}/zone-events`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, refetch: fetchAlerts };
}
