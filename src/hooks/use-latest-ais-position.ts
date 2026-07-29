"use client";

import { useState, useEffect, useCallback } from "react";
import { getLatestAisPosition } from "@/services/ais.service";
import { ApiError } from "@/services/api-client";
import type { AisPositionRow } from "@/lib/supabase/types";

interface UseLatestAisPositionResult {
  readonly position: AisPositionRow | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly refetch: () => void;
}

export function useLatestAisPosition(
  vesselId: string | null,
): UseLatestAisPositionResult {
  const [position, setPosition] = useState<AisPositionRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!vesselId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLatestAisPosition(vesselId);
      setPosition(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { position, isLoading, error, refetch: fetchData };
}
