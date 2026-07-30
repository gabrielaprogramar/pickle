"use client";

import { useState, useEffect, useCallback } from "react";
import type { VoyageRow } from "@/lib/supabase/types";

interface UseVoyageDetailResult {
  voyage: VoyageRow | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVoyageDetail(voyageId: string | null): UseVoyageDetailResult {
  const [voyage, setVoyage] = useState<VoyageRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVoyage = useCallback(async () => {
    if (!voyageId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/voyages/${voyageId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setVoyage(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [voyageId]);

  useEffect(() => {
    fetchVoyage();
  }, [fetchVoyage]);

  return { voyage, isLoading, error, refetch: fetchVoyage };
}
