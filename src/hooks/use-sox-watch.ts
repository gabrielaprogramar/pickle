"use client";

import { useState, useEffect, useCallback } from "react";
import type { SoxComplianceEvent, SoxWatchState } from "@/lib/sox-eca";

export interface SoxWatchData {
  readonly vesselId: string;
  readonly imo: string;
  readonly watch: SoxWatchState | null;
  readonly events: SoxComplianceEvent[];
  readonly eventCount: number;
}

export interface SoxEvaluateData {
  readonly imo: string;
  readonly vesselId: string;
  readonly evaluation: {
    readonly evaluatedAt: string;
    readonly insideEca: boolean;
    readonly ecaEffective: boolean;
    readonly zoneState: string;
    readonly evidenceStatus: string | null;
    readonly applicableLimitPct: number | null;
    readonly sulphurContentPct: number | null;
    readonly selectedDeliveryId: string | null;
    readonly watchStatus: string;
    readonly severity: string;
    readonly ruleResults: ReadonlyArray<{ readonly rule_id: string; readonly kind: string; readonly explanation: string }>;
    readonly reviewRequired: boolean;
    readonly ambiguous: boolean;
  };
  readonly event: SoxComplianceEvent | null;
  readonly watchState: SoxWatchState | null;
  readonly wasDuplicated: boolean;
  readonly dispatchedNotifications: number;
  readonly captain: string;
}

interface UseSoxWatchResult {
  readonly data: SoxWatchData | null;
  readonly isLoading: boolean;
  readonly isEvaluating: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
  readonly evaluate: (scenario?: string) => Promise<SoxEvaluateData | null>;
}

export function useSoxWatch(imo: string | null): UseSoxWatchResult {
  const [data, setData] = useState<SoxWatchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWatch = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vessels/${imo}/sox-watch`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setData(body.data as SoxWatchData);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchWatch();
  }, [fetchWatch]);

  const evaluate = useCallback(
    async (scenario?: string): Promise<SoxEvaluateData | null> => {
      if (!imo) return null;
      setIsEvaluating(true);
      setError(null);
      try {
        const res = await fetch(`/api/vessels/${imo}/sox-watch/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario ? { scenario, persist: true } : { persist: true }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.message ?? `HTTP ${res.status}`);
        }
        const body = await res.json();
        const result = body.data as SoxEvaluateData;
        await fetchWatch();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      } finally {
        setIsEvaluating(false);
      }
    },
    [imo, fetchWatch],
  );

  return { data, isLoading, isEvaluating, error, refetch: fetchWatch, evaluate };
}
