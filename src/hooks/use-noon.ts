"use client";

import { useState, useEffect, useCallback } from "react";
import { getNoonHistory, getNoonLatest, evaluateNoonReport } from "@/services/noon.service";
import type { NoonEvaluateResponse } from "@/services/noon.service";
import { ApiError } from "@/services/api-client";
import type { NoonReportRow } from "@/lib/supabase/types";
import type { NoonFinding } from "@/lib/noon-report";

interface UseNoonResult {
  readonly latest: NoonReportRow | null;
  readonly history: readonly NoonReportRow[];
  readonly findings: readonly NoonFinding[];
  readonly isLoading: boolean;
  readonly isEvaluating: boolean;
  readonly error: ApiError | null;
  readonly evaluate: () => Promise<NoonEvaluateResponse | null>;
  readonly refetch: () => void;
}

function toFindings(row: NoonReportRow | null): readonly NoonFinding[] {
  return Array.isArray(row?.findings) ? (row.findings as NoonFinding[]) : [];
}

export function useNoon(imo: string | null): UseNoonResult {
  const [latest, setLatest] = useState<NoonReportRow | null>(null);
  const [history, setHistory] = useState<readonly NoonReportRow[]>([]);
  const [findings, setFindings] = useState<readonly NoonFinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!imo) return;
    setIsLoading(true);
    setError(null);
    try {
      const [latestRes, historyRes] = await Promise.all([
        getNoonLatest(imo),
        getNoonHistory(imo, 20),
      ]);
      setLatest(latestRes.latest);
      setHistory(historyRes.history);
      setFindings(toFindings(latestRes.latest));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const evaluate = useCallback(async (): Promise<NoonEvaluateResponse | null> => {
    if (!imo) return null;
    setIsEvaluating(true);
    setError(null);
    try {
      const outcome = await evaluateNoonReport(imo, { persist: true });
      setLatest(outcome.report);
      setFindings(outcome.findings);
      await fetchData();
      return outcome;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
      return null;
    } finally {
      setIsEvaluating(false);
    }
  }, [imo, fetchData]);

  return {
    latest,
    history,
    findings,
    isLoading,
    isEvaluating,
    error,
    evaluate,
    refetch: fetchData,
  };
}
