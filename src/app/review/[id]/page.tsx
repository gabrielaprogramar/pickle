"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useReviewTaskDetail, useReviewActions } from "@/hooks/use-review-tasks";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#10b981",
  cancelled: "#6b7280",
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

const DEFAULT_REVIEWER = "reviewer@poseidon-ledger.io";

export default function ReviewDetailPage() {
  const params = useParams();
  const taskId = typeof params.id === "string" ? params.id : null;
  const { detail, loading, error, refetch } = useReviewTaskDetail(taskId);
  const { submitAction, submitting, actionError } = useReviewActions(taskId ?? "");

  const [reviewer, setReviewer] = useState(DEFAULT_REVIEWER);
  const [notes, setNotes] = useState("");
  const [newFieldValue, setNewFieldValue] = useState<string>("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");

  if (loading) {
    return <p style={{ color: "#666" }}>Loading review task...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px" }}>
        Error: {error}
      </div>
    );
  }

  if (!detail) {
    return <p style={{ color: "#666" }}>Review task not found.</p>;
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
      <div style={{ marginBottom: "24px" }}>
        <Link href="/review" style={{ color: "#1a73e8", fontSize: "14px" }}>← Back to Review Queue</Link>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }}>
            Review Task
          </h1>
          {doc && (
            <p style={{ color: "#666", fontSize: "14px" }}>{doc.title}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{
            padding: "4px 12px",
            borderRadius: "4px",
            fontWeight: "500",
            fontSize: "13px",
            backgroundColor: `${STATUS_COLORS[task.status] ?? "#6b7280"}22`,
            color: STATUS_COLORS[task.status] ?? "#6b7280",
          }}>
            {task.status.replace("_", " ")}
          </span>
          <span style={{
            padding: "4px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "500",
            backgroundColor: "#f3f4f6",
            color: "#374151",
          }}>
            {task.priority} priority
          </span>
        </div>
      </div>

      {/* Reviewer Identity */}
      <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Reviewer</h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              flex: 1,
              maxWidth: "300px",
            }}
            placeholder="Reviewer email"
          />
          {!isCompleted && (
            <span style={{ fontSize: "12px", color: "#666" }}>Your identity for audit trail</span>
          )}
        </div>
      </section>

      {/* Assignment */}
      {!isCompleted && !task.assigned_to && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Assignment</h2>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                flex: 1,
                maxWidth: "300px",
              }}
              placeholder="Reviewer email to assign"
            />
            <button
              onClick={handleAssign}
              disabled={submitting || !assignee.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting || !assignee.trim() ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting || !assignee.trim() ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Assigning..." : "Assign to Me"}
            </button>
          </div>
        </section>
      )}

      {/* Document Info */}
      {doc && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Document Info</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px", fontSize: "14px" }}>
            <dt style={{ fontWeight: "500", color: "#666" }}>Title</dt>
            <dd>{doc.title}</dd>
            <dt style={{ fontWeight: "500", color: "#666" }}>Filename</dt>
            <dd>{doc.filename}</dd>
            <dt style={{ fontWeight: "500", color: "#666" }}>Type</dt>
            <dd>{doc.document_type}</dd>
            <dt style={{ fontWeight: "500", color: "#666" }}>Status</dt>
            <dd>{doc.status}</dd>
            <dt style={{ fontWeight: "500", color: "#666" }}>Created</dt>
            <dd>{new Date(doc.created_at).toLocaleString()}</dd>
          </dl>
        </section>
      )}

      {/* Decision Buttons */}
      {!isCompleted && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Review Decision</h2>

          {/* Notes */}
          <div style={{ marginBottom: "12px" }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                minHeight: "60px",
                boxSizing: "border-box",
              }}
              placeholder="Add notes or comments about your decision..."
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => handleDecision("approve")}
              disabled={submitting}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting ? "#a7f3d0" : "#10b981",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={() => handleDecision("reject")}
              disabled={submitting}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting ? "#fecaca" : "#ef4444",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Processing..." : "Reject"}
            </button>
            <button
              onClick={() => handleDecision("needs_changes")}
              disabled={submitting}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting ? "#fde68a" : "#f59e0b",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Processing..." : "Needs Changes"}
            </button>
            <button
              onClick={() => handleDecision("escalate")}
              disabled={submitting}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting ? "#ddd6fe" : "#8b5cf6",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Processing..." : "Escalate"}
            </button>
          </div>

          {actionError && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{actionError}</p>
          )}
        </section>
      )}

      {/* Completed Status */}
      {isCompleted && task.review_note && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px", backgroundColor: "#f9fafb" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Completed</h2>
          <p style={{ fontSize: "14px", color: "#374151" }}>{task.review_note}</p>
          {task.completed_at && (
            <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
              Completed: {new Date(task.completed_at).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {/* Audit History Timeline */}
      {auditHistory.length > 0 && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Audit Trail</h2>
          <div style={{ position: "relative", paddingLeft: "20px" }}>
            {auditHistory.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  position: "relative",
                  paddingBottom: idx < auditHistory.length - 1 ? "16px" : "0",
                  paddingLeft: "16px",
                  borderLeft: idx < auditHistory.length - 1 ? "2px solid #e0e0e0" : "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "-6px",
                    top: "4px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: "#3b82f6",
                  }}
                />
                <div style={{ fontSize: "13px" }}>
                  <span style={{ fontWeight: "500" }}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  {entry.field_name && (
                    <span style={{ color: "#666" }}> — {entry.field_name}</span>
                  )}
                  <span style={{ color: "#666", marginLeft: "8px" }}>by {entry.reviewer}</span>
                </div>
                {entry.notes && (
                  <p style={{ fontSize: "13px", color: "#374151", margin: "2px 0" }}>{entry.notes}</p>
                )}
                {entry.previous_value !== null && entry.previous_value !== undefined && (
                  <p style={{ fontSize: "12px", color: "#666", margin: "2px 0" }}>
                    Previous: {JSON.stringify(entry.previous_value)}
                    {entry.new_value !== null && entry.new_value !== undefined && (
                      <> → New: {JSON.stringify(entry.new_value)}</>
                    )}
                  </p>
                )}
                <p style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 0 0" }}>
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Comment */}
      {!isCompleted && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Add Comment</h2>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                minHeight: "40px",
              }}
              placeholder="Enter your comment..."
            />
            <button
              onClick={handleAddComment}
              disabled={submitting || !notes.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: submitting || !notes.trim() ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting || !notes.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {submitting ? "Sending..." : "Comment"}
            </button>
          </div>
          {actionError && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{actionError}</p>
          )}
        </section>
      )}
    </div>
  );
}
