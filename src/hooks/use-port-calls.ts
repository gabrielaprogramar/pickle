"use client";

import { useState, useEffect, useCallback } from "react";
import type { PortCallRow } from "@/lib/supabase/types";

interface UsePortCallsResult {
  portCalls: PortCallRow[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePortCalls(imo: string | null): UsePortCallsResult {
  const [portCalls, setPortCalls] = useState<PortCallRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPortCalls = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vessels/${imo}/port-calls`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPortCalls(data.portCalls ?? []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchPortCalls();
  }, [fetchPortCalls]);

  return { portCalls, isLoading, error, refetch: fetchPortCalls };
}
