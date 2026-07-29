"use client";

import { useState, useCallback } from "react";

interface ReviewTaskRow {
  readonly id: string;
  readonly document_id: string;
  readonly assigned_to: string | null;
  readonly status: string;
  readonly priority: string;
  readonly due_at: string | null;
  readonly completed_at: string | null;
  readonly review_note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface UseDocumentReviewResult {
  readonly createReviewTask: (opts?: { assignee?: string; priority?: string }) => Promise<boolean>;
  readonly creating: boolean;
  readonly error: string | null;
  readonly reviewTasks: ReviewTaskRow[];
  readonly loadingTasks: boolean;
}

export function useDocumentReview(documentId: string | null): UseDocumentReviewResult {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewTasks, setReviewTasks] = useState<ReviewTaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const createReviewTask = useCallback(async (opts?: { assignee?: string; priority?: string }): Promise<boolean> => {
    if (!documentId) return false;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee: opts?.assignee,
          priority: opts?.priority,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setReviewTasks((prev) => [json.data.reviewTask, ...prev]);
        return true;
      } else {
        setError(json.error?.message ?? "Failed to create review task");
        return false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return false;
    } finally {
      setCreating(false);
    }
  }, [documentId]);

  const fetchTasks = useCallback(async () => {
    if (!documentId) return;
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/review`);
      const json = await res.json();
      if (json.success) {
        setReviewTasks(json.data);
      }
    } catch {
      // Silently fail for background fetch
    } finally {
      setLoadingTasks(false);
    }
  }, [documentId]);

  return { createReviewTask, creating, error, reviewTasks, loadingTasks };
}
