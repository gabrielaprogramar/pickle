"use client";

import { ScanLine, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useOcrQuality } from "@/hooks/use-ocr-quality";

const LEVEL_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "warning",
  VERY_LOW: "destructive",
};

const PRIORITY_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "destructive",
};

const SUGGESTION_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "muted"> = {
  open: "secondary",
  accepted: "success",
  rejected: "muted",
  resolved: "success",
};

function scoreLabel(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function ScoreBar({ label, value }: { readonly label: string; readonly value: number | null }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-32 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono-technical text-[11px] tabular-nums">
        {scoreLabel(value)}
      </span>
    </div>
  );
}

export function OcrQualityPanel({ documentId }: { readonly documentId: string }) {
  const {
    snapshot,
    suggestions,
    lastOutcome,
    loading,
    error,
    runReview,
    reviewing,
    updateSuggestion,
    updatingId,
    refresh,
  } = useOcrQuality(documentId);

  const hasData = snapshot !== null;
  const openSuggestions = (suggestions ?? []).filter((s) => s.status === "open");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
          <ScanLine className="h-3.5 w-3.5 text-primary" />
          OCR Quality Intelligence
        </CardTitle>
        <div className="flex items-center gap-2">
          {snapshot?.level && (
            <Badge variant={LEVEL_VARIANT[snapshot.level] ?? "outline"} className="text-[9px]">
              {snapshot.level}
            </Badge>
          )}
          {snapshot?.priority && (
            <Badge variant={PRIORITY_VARIANT[snapshot.priority] ?? "muted"} className="text-[9px]">
              {snapshot.priority}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={refresh}
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-muted-foreground">{error}</p>
        ) : !hasData ? (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              No OCR quality snapshot for this document yet. Run the deterministic review to
              score the scan and propose corrections.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              disabled={reviewing}
              onClick={() => runReview()}
            >
              {reviewing ? "Reviewing…" : "Run OCR Review"}
            </Button>
          </div>
        ) : (
          <div>
            <div className="space-y-0.5">
              <ScoreBar label="Overall" value={snapshot.overallQualityScore} />
              <ScoreBar label="Page Quality" value={snapshot.pageQuality} />
              <ScoreBar label="Text Coverage" value={snapshot.textCoverage} />
              <ScoreBar label="Field Coverage" value={snapshot.fieldCoverage} />
              <ScoreBar label="Confidence" value={snapshot.confidenceScore} />
            </div>

            {snapshot.issues.some((i) => i.detected) && (
              <>
                <Separator className="my-2" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    Detected Issues
                  </p>
                  <ul className="space-y-1">
                    {snapshot.issues
                      .filter((i) => i.detected)
                      .map((issue) => (
                        <li
                          key={issue.type}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="font-mono uppercase tracking-wide text-[10px]">
                            {issue.type.replaceAll("_", " ")}
                          </span>
                          <Badge
                            variant={issue.severity === "blocking" ? "destructive" : "warning"}
                            className="text-[8px]"
                          >
                            {issue.severity}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}

            {snapshot.missingMandatoryFields.length > 0 && (
              <>
                <Separator className="my-2" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    Missing Mandatory Fields
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {snapshot.missingMandatoryFields.map((f) => (
                      <Badge key={f} variant="destructive" className="text-[8px]">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {openSuggestions.length > 0 && (
              <>
                <Separator className="my-2" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    Proposed Corrections ({openSuggestions.length})
                  </p>
                  <ul className="space-y-2">
                    {openSuggestions.map((s) => (
                      <li key={s.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {s.kind.replaceAll("_", " ")}
                          </span>
                          <span className="font-mono-technical text-[10px] text-muted-foreground">
                            {s.field_key} · {(s.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs">
                          <span className="line-through text-muted-foreground">
                            {s.original_value}
                          </span>
                          {" → "}
                          <span className="text-foreground">{s.suggested_value}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{s.reason}</p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-6 text-[10px]"
                            disabled={updatingId === s.id}
                            onClick={() => updateSuggestion(s.id, "accepted")}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px]"
                            disabled={updatingId === s.id}
                            onClick={() => updateSuggestion(s.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {lastOutcome && (
              <>
                <Separator className="my-2" />
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Review result: priority {lastOutcome.priority.toLowerCase()} ·{" "}
                    {lastOutcome.reviewRequired
                      ? "sent for human review (OCR_REVIEW_REQUIRED)"
                      : "clear for capture"}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
