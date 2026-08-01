"use client";

import { useState, useEffect, useCallback } from "react";

interface OcrQualityIssueApi {
  readonly type: string;
  readonly detected: boolean;
  readonly severity: string;
  readonly evidence?: string;
}

interface OcrQualitySnapshot {
  readonly detectedFamily: string | null;
  readonly level: string | null;
  readonly overallQualityScore: number | null;
  readonly pageQuality: number | null;
  readonly textCoverage: number | null;
  readonly fieldCoverage: number | null;
  readonly confidenceScore: number | null;
  readonly issues: OcrQualityIssueApi[];
  readonly missingMandatoryFields: string[];
  readonly priority: string | null;
  readonly priorityReasons: string[];
}

interface OcrQualityRecord {
  readonly id: string;
  readonly ocr_result_id: string;
  readonly document_id: string;
  readonly detected_family: string;
  readonly overall_quality_score: number;
  readonly level: string;
  readonly page_quality: number;
  readonly text_coverage: number;
  readonly field_coverage: number;
  readonly confidence_score: number;
  readonly confidence_distribution: Record<string, number>;
  readonly issues: unknown[];
  readonly missing_mandatory_fields: string[];
  readonly created_at: string;
}

interface OcrSuggestionRow {
  readonly id: string;
  readonly document_id: string;
  readonly field_key: string;
  readonly kind: string;
  readonly original_value: string;
  readonly suggested_value: string;
  readonly confidence: number;
  readonly reason: string;
  readonly priority: string;
  readonly status: string;
  readonly created_at: string;
}

interface OcrReviewOutcome {
  readonly priority: string;
  readonly reviewRequired: boolean;
  readonly level: string | null;
  readonly overallQualityScore: number | null;
  readonly reasons: string[];
}

interface UseOcrQualityResult {
  readonly snapshot: OcrQualitySnapshot | null;
  readonly record: OcrQualityRecord | null;
  readonly suggestions: OcrSuggestionRow[] | null;
  readonly lastOutcome: OcrReviewOutcome | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly runReview: (assignee?: string) => Promise<boolean>;
  readonly reviewing: boolean;
  readonly updateSuggestion: (id: string, status: "accepted" | "rejected" | "resolved") => Promise<boolean>;
  readonly updatingId: string | null;
  readonly refresh: () => void;
}

export function useOcrQuality(documentId: string | null): UseOcrQualityResult {
  const [snapshot, setSnapshot] = useState<OcrQualitySnapshot | null>(null);
  const [record, setRecord] = useState<OcrQualityRecord | null>(null);
  const [suggestions, setSuggestions] = useState<OcrSuggestionRow[] | null>(null);
  const [lastOutcome, setLastOutcome] = useState<OcrReviewOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchQuality = useCallback(async () => {
    if (!documentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ocr/quality?documentId=${encodeURIComponent(documentId)}`);
      const json = await res.json();
      if (json.success) {
        setSnapshot(json.data.computed);
        setRecord(json.data.record);
      } else {
        if (res.status !== 404) {
          setError(json.error?.message ?? "Failed to fetch OCR quality");
        }
        setSnapshot(null);
        setRecord(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const fetchSuggestions = useCallback(async () => {
    if (!documentId) return;
    try {
      const res = await fetch("/api/ocr/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = await res.json();
      if (json.success) {
        setSuggestions(json.data.records);
      }
    } catch {
      // suggestions are auxiliary; the panel still shows quality
    }
  }, [documentId]);

  const refresh = useCallback(() => {
    fetchQuality();
    fetchSuggestions();
  }, [fetchQuality, fetchSuggestions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runReview = useCallback(
    async (assignee?: string): Promise<boolean> => {
      if (!documentId) return false;
      setReviewing(true);
      setError(null);
      try {
        const res = await fetch("/api/ocr/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, assignee }),
        });
        const json = await res.json();
        if (json.success) {
          setLastOutcome(json.data.outcome);
          setRecord(json.data.qualityRecord);
          setSuggestions(json.data.suggestions);
          refresh();
          return true;
        }
        setError(json.error?.message ?? "OCR review failed");
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        return false;
      } finally {
        setReviewing(false);
      }
    },
    [documentId, refresh],
  );

  const updateSuggestion = useCallback(
    async (id: string, status: "accepted" | "rejected" | "resolved"): Promise<boolean> => {
      setUpdatingId(id);
      try {
        const res = await fetch(`/api/ocr/suggestions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (json.success) {
          setSuggestions((prev) =>
            (prev ?? []).map((s) =>
              s.id === id ? { ...s, status: json.data.suggestion.status } : s,
            ),
          );
          return true;
        }
        setError(json.error?.message ?? "Failed to update suggestion");
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [],
  );

  return {
    snapshot,
    record,
    suggestions,
    lastOutcome,
    loading,
    error,
    runReview,
    reviewing,
    updateSuggestion,
    updatingId,
    refresh,
  };
}
