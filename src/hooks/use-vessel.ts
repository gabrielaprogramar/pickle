"use client";

import { useState, useEffect, useCallback } from "react";
import { getVesselByImo } from "@/services/vessels.service";
import { ApiError } from "@/services/api-client";
import type { VesselRow } from "@/lib/supabase/types";

interface UseVesselResult {
  readonly vessel: VesselRow | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly refetch: () => void;
}

export function useVessel(imo: string | null): UseVesselResult {
  const [vessel, setVessel] = useState<VesselRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getVesselByImo(imo);
      setVessel(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { vessel, isLoading, error, refetch: fetchData };
}
