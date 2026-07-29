"use client";

import { useState, useEffect, useCallback } from "react";
import { getAisPositions } from "@/services/ais.service";
import { ApiError, DEFAULT_PAGE_SIZE, pageOffset } from "@/services/api-client";
import type { AisPositionRow } from "@/lib/supabase/types";

interface UseAisPositionsResult {
  readonly positions: readonly AisPositionRow[];
  readonly total: number;
  readonly totalPages: number;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly page: number;
  readonly pageSize: number;
  readonly setPage: (page: number) => void;
  readonly refetch: () => void;
}

export function useAisPositions(
  imo: string | null,
  pageSize = DEFAULT_PAGE_SIZE,
): UseAisPositionsResult {
  const [page, setPage] = useState(1);
  const [positions, setPositions] = useState<readonly AisPositionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAisPositions(imo, {
        limit: pageSize,
        offset: pageOffset(page, pageSize),
      });
      setPositions(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [imo, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    positions,
    total,
    totalPages,
    isLoading,
    error,
    page,
    pageSize,
    setPage,
    refetch: fetchData,
  };
}
