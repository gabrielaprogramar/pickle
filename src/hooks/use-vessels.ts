"use client";

import { useState, useEffect, useCallback } from "react";
import { getVessels } from "@/services/vessels.service";
import { ApiError } from "@/services/api-client";
import type { VesselRow } from "@/lib/supabase/types";
import { DEFAULT_PAGE_SIZE, pageOffset } from "@/services/api-client";

interface UseVesselsResult {
  readonly vessels: readonly VesselRow[];
  readonly total: number;
  readonly totalPages: number;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly page: number;
  readonly pageSize: number;
  readonly setPage: (page: number) => void;
  readonly refetch: () => void;
}

export function useVessels(pageSize = DEFAULT_PAGE_SIZE): UseVesselsResult {
  const [page, setPage] = useState(1);
  const [vessels, setVessels] = useState<readonly VesselRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getVessels({
        limit: pageSize,
        offset: pageOffset(page, pageSize),
      });
      setVessels(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    vessels,
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
