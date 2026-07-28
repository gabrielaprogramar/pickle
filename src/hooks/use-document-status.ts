/**
 * use-document-status.ts — hook for polling document processing status
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Polls GET /api/documents/:id/status every 5 seconds while the document
 * is in a non-terminal status (uploaded, processing).
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DocumentStatus {
  readonly documentId: string;
  readonly status: string;
  readonly latestJob: {
    readonly id: string;
    readonly jobType: string;
    readonly status: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
    readonly errorMessage: string | null;
  } | null;
  readonly ocrResultCount: number;
}

interface UseDocumentStatusResult {
  readonly status: DocumentStatus | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

const TERMINAL_STATUSES = new Set([
  "ocr_complete",
  "extracted",
  "under_review",
  "approved",
  "rejected",
  "archived",
]);

const POLL_INTERVAL_MS = 5_000;

export function useDocumentStatus(id: string | null): UseDocumentStatusResult {
  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/documents/${id}/status`);
      const json = await res.json();

      if (json.success) {
        setStatus(json.data);
        setError(null);

        // Stop polling if document reached a terminal status.
        if (TERMINAL_STATUSES.has(json.data.status) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setError(json.error?.message ?? "Failed to fetch status");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch + start polling.
  useEffect(() => {
    fetchStatus();

    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}
