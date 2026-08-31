"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useReviewTaskDetail, useReviewActions } from "@/hooks/use-review-tasks";
import { OcrQualityPanel } from "@/components/ocr/ocr-quality-panel";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DEMO_OWNER } from "@/constants/demo";
import { ArrowLeft, Clock, History, MessageSquare, UserCheck, UserPlus } from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  pending: "warning",
  in_progress: "secondary",
  completed: "success",
  cancelled: "muted",
};

const PRIORITY_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  low: "muted",
  normal: "secondary",
  high: "warning",
  urgent: "destructive",
};

const ACTION_LABELS: Record<string, string> = {
  assigned: "Assigned",
  approved: "Approved",
  rejected: "Rejected",
  needs_changes: "Needs Changes",
  escalated: "Escalated",
  field_approved: "Field Approved",
  field_rejected: "Field Rejected",
  field_edited: "Field Edited",
  field_uncertain: "Marked Uncertain",
  comment_added: "Comment",
};

const DEFAULT_REVIEWER = DEMO_OWNER.email;

export default function ReviewDetailPage() {
  const params = useParams();
  const taskId = typeof params.id === "string" ? params.id : null;
  const { detail, loading, error, refetch } = useReviewTaskDetail(taskId);
  const { submitAction, submitting, actionError } = useReviewActions(taskId ?? "");

  const [reviewer, setReviewer] = useState<string>(DEFAULT_REVIEWER);
  const [notes, setNotes] = useState("");
  const [newFieldValue, setNewFieldValue] = useState<string>("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Loading review task...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive-foreground">
        Error: {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Review task not found.
        </p>
      </div>
    );
  }

  const { task, document: doc, auditHistory } = detail;
  const isCompleted = task.status === "completed";

  async function handleDecision(action: string) {
    await submitAction(action, { reviewer, comment: notes || undefined });
    refetch();
  }

  async function handleFieldAction(fieldName: string, action: string, value?: unknown) {
    const body: Record<string, unknown> = { reviewer, fieldName };
    if (action === "edit_field") {
      body.newValue = value;
      body.comment = notes || undefined;
    } else if (action === "field_rejected") {
      body.reason = notes || "Rejected";
    } else {
      body.comment = notes || undefined;
    }
    await submitAction(action, body);
    setEditingField(null);
    setNewFieldValue("");
    refetch();
  }

  async function handleAssign() {
    if (!assignee.trim()) return;
    await submitAction("assign", { assignee: assignee.trim() });
    refetch();
  }

  async function handleAddComment() {
    if (!notes.trim()) return;
    await submitAction("comment", { reviewer, comment: notes.trim() });
    setNotes("");
    refetch();
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/review"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-3 w-3 inline mr-1" />
          Back to Review Queue
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-lg font-light tracking-tight">Review Task</h1>
          {doc && (
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {doc.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={STATUS_VARIANTS[task.status] ?? "muted"}
            className="text-[9px]"
          >
            {task.status.replace("_", " ")}
          </Badge>
          <Badge
            variant={PRIORITY_VARIANTS[task.priority] ?? "muted"}
            className="text-[9px]"
          >
            {task.priority} priority
          </Badge>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            Reviewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Reviewer email"
              className="max-w-xs"
            />
            {!isCompleted && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Your identity for audit trail
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {!isCompleted && !task.assigned_to && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Reviewer email to assign"
                className="max-w-xs"
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleAssign}
                disabled={submitting || !assignee.trim()}
              >
                {submitting ? "Assigning..." : "Assign to Me"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {doc && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Document Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Title</dt>
              <dd>{doc.title}</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Filename</dt>
              <dd className="font-mono-technical text-[11px]">{doc.filename}</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Type</dt>
              <dd>{doc.document_type}</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Status</dt>
              <dd>
                <Badge
                  variant={STATUS_VARIANTS[doc.status] ?? "muted"}
                  className="text-[9px]"
                >
                  {doc.status}
                </Badge>
              </dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Created</dt>
              <dd className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                {new Date(doc.created_at).toLocaleString()}
              </dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {task.document_id && (
        <div className="mb-4">
          <OcrQualityPanel documentId={task.document_id} />
        </div>
      )}

      {!isCompleted && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-primary" />
              Review Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y"
              placeholder="Add notes or comments about your decision..."
            />

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleDecision("approve")}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Approve"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDecision("reject")}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Reject"}
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={() => handleDecision("needs_changes")}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Needs Changes"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDecision("escalate")}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Escalate"}
              </Button>
            </div>

            {actionError && (
              <p className="text-xs text-destructive">{actionError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isCompleted && task.review_note && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs mb-1">{task.review_note}</p>
            {task.completed_at && (
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Completed: {new Date(task.completed_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {auditHistory.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-primary" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-5 space-y-0">
              {auditHistory.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="relative pb-4 pl-4 border-l-2 border-border last:border-l-0 last:pb-0"
                >
                  <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-xs">
                    <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    {entry.field_name && (
                      <span className="text-muted-foreground"> — {entry.field_name}</span>
                    )}
                    <span className="text-muted-foreground ml-2">by {entry.reviewer}</span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-foreground mt-0.5">{entry.notes}</p>
                  )}
                  {entry.previous_value !== null && entry.previous_value !== undefined && (
                    <p className="font-mono-technical text-[10px] text-muted-foreground mt-0.5">
                      Previous: {JSON.stringify(entry.previous_value)}
                      {entry.new_value !== null && entry.new_value !== undefined && (
                        <> → New: {JSON.stringify(entry.new_value)}</>
                      )}
                    </p>
                  )}
                  <p className="font-mono-technical text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isCompleted && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Add Comment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-start">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] resize-y"
                placeholder="Enter your comment..."
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleAddComment}
                disabled={submitting || !notes.trim()}
                className="shrink-0"
              >
                {submitting ? "Sending..." : "Comment"}
              </Button>
            </div>
            {actionError && (
              <p className="mt-2 text-xs text-destructive">{actionError}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
