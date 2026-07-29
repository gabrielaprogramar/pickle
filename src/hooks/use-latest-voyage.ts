"use client";

import { useState, useEffect, useCallback } from "react";
import { getLatestVoyage } from "@/services/voyages.service";
import { ApiError } from "@/services/api-client";
import type { VoyageRow } from "@/lib/supabase/types";

interface UseLatestVoyageResult {
  readonly voyage: VoyageRow | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly refetch: () => void;
}

export function useLatestVoyage(imo: string | null): UseLatestVoyageResult {
  const [voyage, setVoyage] = useState<VoyageRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLatestVoyage(imo);
      setVoyage(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { voyage, isLoading, error, refetch: fetchData };
}
