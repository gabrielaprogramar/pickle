"use client";

import { useState, useEffect, useCallback } from "react";

interface ValidationReportResult {
  readonly id: string;
  readonly document_id: string;
  readonly extraction_id: string | null;
  readonly status: string;
  readonly score: number;
  readonly rule_results: unknown[];
  readonly passed_count: number;
  readonly failed_count: number;
  readonly error_count: number;
  readonly warning_count: number;
  readonly blocking_issues: string[];
  readonly recommended_review: string[];
  readonly ready_for_review: boolean;
  readonly validator_version: string;
  readonly latency_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ValidationDetail {
  readonly report: {
    readonly status: string;
    readonly score: number;
    readonly ruleResults: ReadonlyArray<{
      readonly ruleId: string;
      readonly ruleName: string;
      readonly category: string;
      readonly passed: boolean;
      readonly severity: string | null;
      readonly message: string;
      readonly field?: string;
    }>;
    readonly passedCount: number;
    readonly failedCount: number;
    readonly errorCount: number;
    readonly warningCount: number;
    readonly blockingIssues: string[];
    readonly recommendedReview: string[];
    readonly readyForReview: boolean;
  };
  readonly persisted: ValidationReportResult;
  readonly latencyMs: number;
}

interface UseDocumentValidationResult {
  readonly validation: ValidationReportResult | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly triggerValidation: () => Promise<void>;
  readonly validating: boolean;
  readonly validationError: string | null;
  readonly validationDetail: ValidationDetail | null;
}

export function useDocumentValidation(id: string | null): UseDocumentValidationResult {
  const [validation, setValidation] = useState<ValidationReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationDetail, setValidationDetail] = useState<ValidationDetail | null>(null);

  const fetchValidation = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/validate`);
      const json = await res.json();

      if (json.success) {
        setValidation(json.data);
      } else {
        setError(json.error?.message ?? "Failed to fetch validation");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const triggerValidation = useCallback(async () => {
    if (!id) return;
    setValidating(true);
    setValidationError(null);
    try {
      const res = await fetch(`/api/documents/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        setValidationDetail(json.data);
        setValidation(json.data.persisted);
      } else {
        setValidationError(json.error?.message ?? "Validation failed");
      }
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : "Network error");
    } finally {
      setValidating(false);
    }
  }, [id]);

  return {
    validation,
    loading,
    error,
    triggerValidation,
    validating,
    validationError,
    validationDetail,
  };
}
