"use client";

import { useState } from "react";
import { Waves, Search, RefreshCw, Play } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { useNoon } from "@/hooks/use-noon";
import type { NoonReportRow } from "@/lib/supabase/types";
import type { NoonFinding, NoonReportAnalysis } from "@/lib/noon-report";

const IMO_PATTERN = /^\d{7}$/;

const STATE_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline" | "muted"> = {
  AT_SEA: "success",
  IN_PORT: "warning",
  WAITING: "warning",
  UNKNOWN: "outline",
};

const STATE_LABEL: Record<string, string> = {
  AT_SEA: "At Sea",
  IN_PORT: "In Port",
  WAITING: "Waiting",
  UNKNOWN: "Unknown",
};

const SEVERITY_VARIANT: Record<string, "default" | "warning" | "destructive" | "outline"> = {
  BLOCKING: "destructive",
  ERROR: "destructive",
  WARNING: "warning",
  INFO: "outline",
};

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPos(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return "—";
  const latSuffix = lat >= 0 ? "N" : "S";
  const lngSuffix = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}° ${latSuffix} ${Math.abs(lng).toFixed(3)}° ${lngSuffix}`;
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

function FindingsPanel({ findings }: { readonly findings: readonly NoonFinding[] }) {
  if (findings.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No findings on the latest report.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {findings.map((f) => (
        <li
          key={f.id}
          className="rounded-md border border-border bg-muted/40 px-2 py-1.5"
        >
          <div className="flex items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[f.severity] ?? "outline"} className="text-[8px]">
              {f.severity}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {f.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug">{f.reason}</p>
          {f.remediation && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Remediation: {f.remediation}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function LatestCard({
  latest,
  findings,
}: {
  readonly latest: NoonReportRow;
  readonly findings: readonly NoonFinding[];
}) {
  const analysis = (latest.analysis ?? null) as NoonReportAnalysis | null;
  const operationalState = analysis?.operationalState ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
          <Waves className="h-3.5 w-3.5 text-primary" />
          Latest Noon Report
        </CardTitle>
        {operationalState && (
          <Badge variant={STATE_VARIANT[operationalState] ?? "outline"} className="text-[9px]">
            {STATE_LABEL[operationalState] ?? operationalState}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <InfoRow label="Report Date" value={formatTs(latest.report_date)} mono />
          <InfoRow label="Position" value={formatPos(latest.position_latitude, latest.position_longitude)} mono />
          <InfoRow
            label="Speed"
            value={latest.speed_knots != null ? `${latest.speed_knots.toFixed(2)} kn` : null}
            mono
          />
          <InfoRow
            label="RPM"
            value={latest.engine_rpm != null ? `${latest.engine_rpm}` : null}
            mono
          />
          <InfoRow
            label="Consumption"
            value={latest.fuel_consumption_tonnes != null ? `${latest.fuel_consumption_tonnes} t` : null}
            mono
          />
          <InfoRow
            label="ROB"
            value={latest.fuel_robs_tonnes != null ? `${latest.fuel_robs_tonnes} t` : null}
            mono
          />
          <InfoRow
            label="Distance to Go"
            value={latest.distance_to_go_nm != null ? `${latest.distance_to_go_nm} nm` : null}
            mono
          />
          <InfoRow
            label="Confidence"
            value={latest.confidence != null ? `${Math.round(latest.confidence * 100)}%` : null}
            mono
          />
        </div>
        {analysis && (
          <>
            <Separator className="my-2" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <InfoRow
                label="Consumption Rate"
                value={analysis.consumption.rateTonnesPerDay != null ? `${analysis.consumption.rateTonnesPerDay.toFixed(2)} t/24h` : null}
                mono
              />
              <InfoRow
                label="Slip"
                value={analysis.slip.slipPct != null ? `${analysis.slip.slipPct.toFixed(2)}%` : null}
                mono
              />
              <InfoRow
                label="Speed Made Good"
                value={analysis.voyage.speedMadeGoodKnots != null ? `${analysis.voyage.speedMadeGoodKnots.toFixed(2)} kn` : null}
                mono
              />
              <InfoRow
                label="Engine Load"
                value={analysis.engine.loadPct != null ? `${analysis.engine.loadPct.toFixed(1)}%` : null}
                mono
              />
              <InfoRow
                label="Weather"
                value={
                  analysis.weather.seaState || analysis.weather.windSpeedKnots != null
                    ? `${analysis.weather.seaState ?? "n/a"} · ${analysis.weather.windSpeedKnots ?? "n/a"} kn`
                    : null
                }
              />
              <InfoRow
                label="Evaluated At"
                value={latest.evaluated_at ? formatTs(latest.evaluated_at) : null}
                mono
              />
            </div>
          </>
        )}
        <Separator className="my-2" />
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
          Findings ({findings.length})
        </p>
        <FindingsPanel findings={findings} />
      </CardContent>
    </Card>
  );
}

export default function NoonPage() {
  const [imoInput, setImoInput] = useState("");
  const [activeImo, setActiveImo] = useState<string | null>(null);
  const { latest, history, findings, isLoading, isEvaluating, error, evaluate, refetch } =
    useNoon(activeImo);

  const handleLookup = () => {
    const trimmed = imoInput.trim();
    if (IMO_PATTERN.test(trimmed)) {
      setActiveImo(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  return (
    <div>
      <PageHeader
        title="Noon Reports"
        description="Deterministic noon-report intelligence: consumption, engine performance, weather and voyage deviations."
        actions={
          activeImo && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[10px]"
              onClick={evaluate}
              disabled={isEvaluating}
            >
              {isEvaluating ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Evaluating…
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Run Evaluation
                </>
              )}
            </Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Input
          value={imoInput}
          onChange={(e) => setImoInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter 7-digit IMO number…"
          className="w-48 font-mono-technical tabular-nums text-xs"
          maxLength={7}
        />
        <Button
          variant="default"
          size="sm"
          onClick={handleLookup}
          disabled={!IMO_PATTERN.test(imoInput.trim())}
        >
          <Search className="h-3.5 w-3.5" />
          Lookup
        </Button>
        {activeImo && (
          <Badge variant="outline" className="text-[10px] font-mono-technical">
            IMO {activeImo}
          </Badge>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error.message} code={error.code} onRetry={refetch} />
        </div>
      )}

      {!activeImo ? (
        <EmptyState
          icon={<Waves className="h-8 w-8" />}
          title="Select a vessel"
          description="Enter a 7-digit IMO number above to view noon-report intelligence."
        />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : latest ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <LatestCard latest={latest} findings={findings} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
                History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No prior reports.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {history.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between text-[11px] py-0.5"
                    >
                      <span className="font-mono-technical text-muted-foreground">
                        {formatTs(row.report_date)}
                      </span>
                      <span className="font-mono-technical tabular-nums">
                        {row.fuel_consumption_tonnes != null
                          ? `${row.fuel_consumption_tonnes} t`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<Waves className="h-8 w-8" />}
          title="No noon reports"
          description={`No noon reports on file for IMO ${activeImo}. Run an evaluation or ingest a report to seed the console.`}
        />
      )}
    </div>
  );
}
