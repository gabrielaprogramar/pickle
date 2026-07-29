"use client";

import { useState } from "react";
import { useReviewTasks } from "@/hooks/use-review-tasks";
import Link from "next/link";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  normal: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#10b981",
  cancelled: "#6b7280",
};

export default function ReviewQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { tasks, loading, error } = useReviewTasks(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }}>Human Review Queue</h1>
            <p style={{ color: "#666", fontSize: "14px" }}>
              Review and validate AI-extracted information before documents become trusted.
            </p>
          </div>
          <Link
            href="/documents"
            style={{ color: "#1a73e8", fontSize: "14px" }}
          >
            ← Back to Documents
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "14px", color: "#666" }}>Status:</span>
        {["all", "pending", "in_progress", "completed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: statusFilter === s ? "#2563eb" : "#fff",
              color: statusFilter === s ? "#fff" : "#374151",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px", marginBottom: "16px" }}>
          Error: {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "#666" }}>Loading review tasks...</p>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>No review tasks found.</p>
          <p style={{ fontSize: "14px" }}>Submit a document for review to see tasks here.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Priority</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Task</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Status</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Assigned To</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Due</th>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "500",
                    backgroundColor: `${PRIORITY_COLORS[task.priority] ?? "#6b7280"}22`,
                    color: PRIORITY_COLORS[task.priority] ?? "#6b7280",
                  }}>
                    {task.priority}
                  </span>
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <Link
                    href={`/review/${task.id}`}
                    style={{ color: "#1a73e8", textDecoration: "none" }}
                  >
                    {task.id.slice(0, 8)}...
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "500",
                    backgroundColor: `${STATUS_COLORS[task.status] ?? "#6b7280"}22`,
                    color: STATUS_COLORS[task.status] ?? "#6b7280",
                  }}>
                    {task.status.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 8px", color: "#666" }}>
                  {task.assigned_to ?? "Unassigned"}
                </td>
                <td style={{ padding: "10px 8px", color: "#666" }}>
                  {task.due_at ? new Date(task.due_at).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "10px 8px", color: "#666" }}>
                  {new Date(task.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
