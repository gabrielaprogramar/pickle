"use client";

import { useState, useEffect, useCallback } from "react";

interface RegistryLink {
  readonly imo: string;
  readonly vesselName: string;
}

/**
 * Resolves a document's vessel_id (UUID) to an IMO so the document detail
 * page can link into the vessel certificate registry (fleet page #certificates).
 */
export function useCertificateRegistryLink(
  vesselId: string | null | undefined,
): { link: RegistryLink | null; isLoading: boolean } {
  const [link, setLink] = useState<RegistryLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resolve = useCallback(async () => {
    if (!vesselId) {
      setLink(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/vessels?limit=200");
      if (!res.ok) {
        setLink(null);
        return;
      }
      const body = await res.json();
      const rows = (body.data?.rows ?? []) as ReadonlyArray<{ id: string; imo: string; name: string }>;
      const match = rows.find((v) => v.id === vesselId);
      setLink(match ? { imo: match.imo, vesselName: match.name } : null);
    } catch {
      setLink(null);
    } finally {
      setIsLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { link, isLoading };
}
