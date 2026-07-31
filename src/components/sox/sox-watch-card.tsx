"use client";

import { useState } from "react";
import { Waves, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useSoxWatch } from "@/hooks/use-sox-watch";
import type { SoxComplianceEvent } from "@/lib/sox-eca";
import { cn } from "@/lib/utils/cn";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline" | "muted"> = {
  CLEAR: "success",
  WARNING: "warning",
  NON_CONFORMING: "destructive",
  NO_EVIDENCE: "warning",
  UNKNOWN: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  CLEAR: "Clear",
  WARNING: "Warning",
  NON_CONFORMING: "Non-Conforming",
  NO_EVIDENCE: "No Evidence",
  UNKNOWN: "Unknown",
};

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className={`text-xs ${mono ? "font-mono-technical tabular-nums" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function SoxWatchCard({ imo }: { readonly imo: string }) {
  const { data, isLoading, isEvaluating, error, refetch, evaluate } = useSoxWatch(imo);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const watch = data?.watch ?? null;
  const status = watch?.status ?? null;

  async function runScenario(key: string) {
    setActiveScenario(key);
    await evaluate(key);
    setActiveScenario(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
          <Waves className="h-3.5 w-3.5 text-primary" />
          Med SOx ECA Compliance
        </CardTitle>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="text-[9px]">
              {STATUS_LABEL[status] ?? status}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={refetch}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>{error.message}</span>
          </div>
        ) : !watch ? (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              No SOx ECA watch state recorded yet. Run an evaluation to seed one.
            </p>
            <div className="flex flex-wrap gap-2">
              {["inside-conforming", "inside-non-conforming", "inside-no-evidence"].map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  disabled={isEvaluating}
                  onClick={() => runScenario(key)}
                >
                  {isEvaluating && activeScenario === key ? "Running…" : key}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <InfoRow label="Zone State" value={watch.zone_state} mono />
              <InfoRow label="Evidence" value={watch.evidence_status ?? "—"} mono />
              <InfoRow
                label="Applicable Limit"
                value={watch.applicable_limit_pct != null ? `${watch.applicable_limit_pct.toFixed(2)}% S` : "—"}
                mono
              />
              <InfoRow
                label="Sulphur Content"
                value={watch.sulphur_content_pct != null ? `${watch.sulphur_content_pct.toFixed(2)}% S` : "—"}
                mono
              />
              <InfoRow label="Inside ECA" value={watch.inside_eca ? "Yes" : "No"} />
              <InfoRow label="ECA Effective" value={watch.eca_effective ? "Yes" : "No"} />
            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <InfoRow label="Last Entry" value={formatTs(watch.last_entry_ts)} />
              <InfoRow label="Last Exit" value={formatTs(watch.last_exit_ts)} />
              <InfoRow label="Last Evaluated" value={formatTs(watch.last_evaluated_at)} />
              <InfoRow
                label="Review Required"
                value={watch.review_required ? "Yes" : "No"}
              />
            </div>
            {data && data.events.length > 0 && (
              <>
                <Separator className="my-2" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    Recent Events
                  </p>
                  <div className="flex flex-col gap-1">
                    {data.events.slice(0, 5).map((event: SoxComplianceEvent) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between text-[11px] py-0.5"
                      >
                        <span className="font-mono-technical text-muted-foreground">
                          {formatTs(event.event_ts)}
                        </span>
                        <span className="font-mono uppercase tracking-wide text-[10px]">
                          {event.event_type}
                        </span>
                        <Badge
                          variant={STATUS_VARIANT[event.watch_status] ?? "outline"}
                          className="text-[8px]"
                        >
                          {STATUS_LABEL[event.watch_status] ?? event.watch_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
