"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ScanEye,
  FileWarning,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  RotateCw,
  Gauge,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOcrQueue, type OcrQueueResponse } from "@/services/ocr.service";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils/cn";

const LEVEL_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "outline",
  VERY_LOW: "destructive",
};

const PRIORITY_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  LOW: "muted",
  MEDIUM: "warning",
  HIGH: "destructive",
  CRITICAL: "destructive",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "outline" | "default" | "muted"> = {
  approved: "success",
  under_review: "warning",
  processing: "outline",
  extracted: "default",
  archived: "muted",
  queued: "muted",
};

function qualityColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 0.9) return "bg-success";
  if (score >= 0.7) return "bg-warning";
  return "bg-destructive";
}

function StatTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground/60">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
        {hint && (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OcrWorkspacePage() {
  const [data, setData] = useState<OcrQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOcrQueue();
      setData(result);
      if (result.documents.length > 0) setSelectedId((prev) => prev ?? result.documents[0]!.id);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", String(err), 0),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const selected = data?.documents.find((d) => d.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <span className="block h-px w-7 bg-primary" aria-hidden="true" />
            OCR Intelligence
          </p>
          <h1 className="font-serif text-lg font-light tracking-tight text-foreground">
            Document Intelligence Workspace
          </h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Scanned documents, quality assessment and review
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQueue}
          disabled={isLoading}
          className="h-8"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} code={error.code} onRetry={fetchQueue} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Scans in Queue"
          value={isLoading ? "—" : data?.totals.total ?? 0}
          icon={<ScanEye className="h-4 w-4" />}
          hint="deterministic demo scans"
        />
        <StatTile
          label="Needs Review"
          value={isLoading ? "—" : data?.totals.needsReview ?? 0}
          icon={<FileWarning className="h-4 w-4" />}
          hint="priority above LOW"
        />
        <StatTile
          label="High Confidence"
          value={isLoading ? "—" : data?.totals.byLevel.HIGH ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="no repair needed"
        />
        <StatTile
          label="Poor Scans"
          value={isLoading ? "—" : (data?.totals.byLevel.VERY_LOW ?? 0) + (data?.totals.byLevel.MEDIUM ?? 0)}
          icon={<ShieldAlert className="h-4 w-4" />}
          hint="medium or very low quality"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Scan Quality Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer"
                      data-state={doc.id === selectedId ? "selected" : undefined}
                      onClick={() => setSelectedId(doc.id)}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{doc.title}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {doc.family} · {doc.vesselName ?? "Unassigned"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[doc.status] ?? "muted"}>
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full", qualityColor(doc.overallQualityScore))}
                              style={{
                                width: `${Math.round((doc.overallQualityScore ?? 0) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {(doc.overallQualityScore ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEVEL_VARIANT[doc.level ?? "LOW"] ?? "outline"}>
                          {doc.level ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANT[doc.priority ?? "LOW"] ?? "muted"}>
                          {doc.priority ?? "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              {selected ? (
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Analysis
                </span>
              ) : (
                "Analysis"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-xs text-muted-foreground">
                Select a scan to inspect its assessment.
              </p>
            ) : (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Overall quality
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {(selected.overallQualityScore ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full", qualityColor(selected.overallQualityScore))}
                        style={{
                          width: `${Math.round((selected.overallQualityScore ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <Badge variant={LEVEL_VARIANT[selected.level ?? "LOW"] ?? "outline"}>
                      {selected.level ?? "—"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      OCR confidence
                    </div>
                    <div className="mt-1 font-mono text-sm tabular-nums">
                      {(selected.ocrConfidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Review task
                    </div>
                    <div className="mt-1">
                      {selected.reviewTask ? (
                        <Badge
                          variant={selected.reviewTask.status === "in_progress" ? "warning" : "outline"}
                        >
                          {selected.reviewTask.status}
                        </Badge>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {selected.priorityReasons.length > 0 && (
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Priority rationale
                    </div>
                    <ul className="space-y-1">
                      {selected.priorityReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Gauge className="mt-0.5 h-3 w-3 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.missingMandatoryFields.length > 0 && (
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-destructive">
                      Missing fields
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.missingMandatoryFields.map((f) => (
                        <Badge key={f} variant="destructive">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Detected issues
                  </div>
                  {selected.issues.filter((i) => i.detected).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No scan defects detected.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {selected.issues
                        .filter((i) => i.detected)
                        .map((issue) => (
                          <li
                            key={issue.type}
                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                          >
                            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              <span className="font-medium capitalize text-foreground">
                                {issue.type.replace(/_/g, " ")}
                              </span>
                              {issue.evidence ? ` — ${issue.evidence}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
