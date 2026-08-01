"use client";

import { useState, useEffect, useCallback } from "react";
import type { CertificateView } from "@/lib/certificates";

export interface CertificatesData {
  readonly vesselId: string;
  readonly imo: string;
  readonly mock: boolean;
  readonly certificates: CertificateView[];
  readonly count: number;
  readonly summary: Record<string, number>;
}

interface UseCertificatesOptions {
  readonly mock?: boolean;
}

interface UseCertificatesResult {
  readonly data: CertificatesData | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
}

export function useCertificates(
  imo: string | null,
  options: UseCertificatesOptions = {},
): UseCertificatesResult {
  const { mock = true } = options;
  const [data, setData] = useState<CertificatesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCertificates = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = mock ? "?mock=true" : "";
      const res = await fetch(`/api/vessels/${imo}/certificates${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setData(body.data as CertificatesData);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [imo, mock]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  return { data, isLoading, error, refetch: fetchCertificates };
}
