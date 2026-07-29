"use client";

import { useState, useEffect, useCallback } from "react";

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

interface AuditEntry {
  readonly id: string;
  readonly review_task_id: string;
  readonly field_name: string | null;
  readonly action: string;
  readonly previous_value: unknown | null;
  readonly new_value: unknown | null;
  readonly reviewer: string;
  readonly notes: string | null;
  readonly created_at: string;
}

interface ReviewTaskDetail {
  readonly task: ReviewTaskRow;
  readonly document: {
    readonly id: string;
    readonly title: string;
    readonly filename: string;
    readonly document_type: string;
    readonly status: string;
    readonly vessel_id: string | null;
    readonly created_at: string;
  } | null;
  readonly auditHistory: AuditEntry[];
}

interface ReviewTaskFilter {
  status?: string;
  assignee?: string;
  vesselId?: string;
  documentType?: string;
}

interface UseReviewTasksResult {
  readonly tasks: ReviewTaskRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useReviewTasks(filter?: ReviewTaskFilter): UseReviewTasksResult {
  const [tasks, setTasks] = useState<ReviewTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter?.status) params.set("status", filter.status);
      if (filter?.assignee) params.set("assignee", filter.assignee);
      if (filter?.vesselId) params.set("vesselId", filter.vesselId);
      if (filter?.documentType) params.set("documentType", filter.documentType);

      const qs = params.toString();
      const res = await fetch(`/api/review-tasks${qs ? `?${qs}` : ""}`);
      const json = await res.json();

      if (json.success) {
        setTasks(json.data);
      } else {
        setError(json.error?.message ?? "Failed to fetch review tasks");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [filter?.status, filter?.assignee, filter?.vesselId, filter?.documentType]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}

interface UseReviewTaskDetailResult {
  readonly detail: ReviewTaskDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useReviewTaskDetail(taskId: string | null): UseReviewTaskDetailResult {
  const [detail, setDetail] = useState<ReviewTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/review-tasks/${taskId}`);
      const json = await res.json();

      if (json.success) {
        setDetail(json.data);
      } else {
        setError(json.error?.message ?? "Failed to fetch review task");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { detail, loading, error, refetch: fetchDetail };
}

interface UseReviewActionsResult {
  readonly submitAction: (action: string, body: Record<string, unknown>) => Promise<boolean>;
  readonly submitting: boolean;
  readonly actionError: string | null;
}

export function useReviewActions(taskId: string): UseReviewActionsResult {
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const submitAction = useCallback(async (action: string, body: Record<string, unknown>): Promise<boolean> => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/review-tasks/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();

      if (json.success) {
        return true;
      } else {
        setActionError(json.error?.message ?? "Action failed");
        return false;
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [taskId]);

  return { submitAction, submitting, actionError };
}

export type { ReviewTaskRow, ReviewTaskDetail, AuditEntry };
