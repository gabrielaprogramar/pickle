"use client";

import { useState } from "react";
import { useReviewTasks } from "@/hooks/use-review-tasks";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, ArrowLeft } from "lucide-react";

const PRIORITY_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  low: "muted",
  normal: "secondary",
  high: "warning",
  urgent: "destructive",
};

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  pending: "warning",
  in_progress: "secondary",
  completed: "success",
  cancelled: "muted",
};

export default function ReviewQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { tasks, loading, error } = useReviewTasks(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="font-serif text-lg font-light tracking-tight">Human Review Queue</h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Review and validate AI-extracted information before documents become trusted.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/documents">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Documents
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mr-1">
          Status:
        </span>
        {["all", "pending", "in_progress", "completed"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            code="LOAD_ERROR"
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Loading review tasks...
          </p>
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="No review tasks found"
          description="Submit a document for review to see tasks here."
        />
      )}

      {tasks.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Badge
                      variant={PRIORITY_VARIANTS[task.priority] ?? "muted"}
                      className="text-[9px]"
                    >
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/review/${task.id}`}
                      className="font-mono text-[11px] text-primary hover:text-primary/80 transition-colors"
                    >
                      {task.id.slice(0, 8)}...
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANTS[task.status] ?? "muted"}
                      className="text-[9px]"
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.assigned_to ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                    {task.due_at ? new Date(task.due_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                    {new Date(task.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
