/**
 * use-document.ts — hook for fetching a single document's full status
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface AiExtractionSummary {
  readonly id: string;
  readonly document_id: string;
  readonly ocr_result_id: string | null;
  readonly status: string;
  readonly confidence: number | null;
  readonly summary: string | null;
  readonly document_type: string;
  readonly fields: Record<string, unknown>;
  readonly warnings: string[];
  readonly missing_fields: string[];
  readonly provider: string;
  readonly model: string;
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
  readonly latency_ms: number | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface DocumentStatusDetail {
  readonly document: {
    readonly id: string;
    readonly vessel_id: string | null;
    readonly document_type: string;
    readonly status: string;
    readonly title: string;
    readonly filename: string;
    readonly mime_type: string;
    readonly file_size: number | null;
    readonly storage_path: string;
    readonly created_at: string;
    readonly updated_at: string;
  };
  readonly versions: ReadonlyArray<{
    readonly id: string;
    readonly version_number: number;
    readonly filename: string;
    readonly storage_path: string;
    readonly created_at: string;
  }>;
  readonly jobs: ReadonlyArray<{
    readonly id: string;
    readonly job_type: string;
    readonly status: string;
    readonly started_at: string | null;
    readonly completed_at: string | null;
    readonly error_message: string | null;
  }>;
  readonly ocrResults: ReadonlyArray<{
    readonly id: string;
    readonly raw_text: string;
    readonly extracted_data: Record<string, unknown> | null;
    readonly confidence: number | null;
    readonly created_at: string;
  }>;
  readonly latestJob: {
    readonly id: string;
    readonly job_type: string;
    readonly status: string;
  } | null;
  readonly aiExtractions: ReadonlyArray<AiExtractionSummary>;
  readonly latestAiExtraction: AiExtractionSummary | null;
}

interface UseDocumentResult {
  readonly document: DocumentStatusDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
  readonly triggerExtraction: () => Promise<void>;
  readonly extracting: boolean;
  readonly extractionError: string | null;
}

export function useDocument(id: string | null): UseDocumentResult {
  const [document, setDocument] = useState<DocumentStatusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const json = await res.json();

      if (json.success) {
        setDocument(json.data);
      } else {
        setError(json.error?.message ?? "Failed to fetch document");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const triggerExtraction = useCallback(async () => {
    if (!id) return;
    setExtracting(true);
    setExtractionError(null);
    try {
      const res = await fetch(`/api/documents/${id}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!json.success) {
        setExtractionError(json.error?.message ?? "Extraction failed");
      }
      // Re-fetch document to pick up the new extraction.
      await fetchDocument();
    } catch (e) {
      setExtractionError(e instanceof Error ? e.message : "Network error");
    } finally {
      setExtracting(false);
    }
  }, [id, fetchDocument]);

  return {
    document,
    loading,
    error,
    refetch: fetchDocument,
    triggerExtraction,
    extracting,
    extractionError,
  };
}
