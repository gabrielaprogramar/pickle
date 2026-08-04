"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  Loader2,
  RotateCw,
  Fuel,
  Leaf,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/services/analytics.service";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils/cn";

const W = 560;
const H = 220;
const PAD = { top: 18, right: 12, bottom: 26, left: 46 };

function GroupedBarChart({
  series,
  targetLabel,
}: {
  series: ReadonlyArray<{
    readonly label: string;
    readonly bars: ReadonlyArray<{ readonly label: string; readonly value: number; readonly color: string }>;
  }>;
  targetLabel: string;
}) {
  const max = Math.max(...series.flatMap((s) => s.bars.map((b) => b.value)), 100);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const groupW = innerW / Math.max(series.length, 1);
  const barW = Math.min(18, (groupW * 0.22) / Math.max(series[0]?.bars.length ?? 1, 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = PAD.top + innerH - innerH * t;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {series.map((group, gi) => {
        const groupX = PAD.left + groupW * gi + groupW / 2;
        const startX = groupX - (group.bars.length * barW) / 2;
        return (
          <g key={group.label}>
            {group.bars.map((bar, bi) => {
              const h = (bar.value / max) * innerH;
              const x = startX + bi * barW;
              const y = PAD.top + innerH - h;
              return (
                <g key={bi}>
                  <rect x={x} y={y} width={barW - 2} height={h} rx={1} className={bar.color} />
                  <text
                    x={x + (barW - 2) / 2}
                    y={y - 3}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[8px] tabular-nums"
                  >
                    {bar.value.toFixed(1)}
                  </text>
                </g>
              );
            })}
            <text
              x={groupX}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[9px] uppercase"
            >
              {group.label}
            </text>
          </g>
        );
      })}
      <text x={PAD.left + innerW - 8} y={PAD.top + 8} textAnchor="end" className="fill-primary font-mono text-[9px]">
        {targetLabel}
      </text>
    </svg>
  );
}

function HorizontalBalanceChart({
  items,
}: {
  items: ReadonlyArray<{
    readonly vesselName: string;
    readonly balance: number;
    readonly surplusOrDeficit: string;
  }>;
}) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.balance)), 1);
  const innerW = W - PAD.left - PAD.right;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line
        x1={PAD.left + innerW / 2}
        y1={PAD.top}
        x2={PAD.left + innerW / 2}
        y2={PAD.top + innerH(H)}
        stroke="currentColor"
        strokeOpacity={0.15}
      />
      {items.map((item, i) => {
        const barW = (Math.abs(item.balance) / maxAbs) * (innerW / 2 - 12);
        const isSurplus = item.surplusOrDeficit === "SURPLUS";
        const y = PAD.top + (innerH(H) / items.length) * i + innerH(H) / items.length / 2 - 6;
        const centerX = PAD.left + innerW / 2;
        const x = isSurplus ? centerX : centerX - barW;
        return (
          <g key={`${item.vesselName}-${i}`}>
            <text
              x={centerX - 8}
              y={y + 10}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[9px] uppercase"
            >
              {item.vesselName}
            </text>
            <rect
              x={x}
              y={y}
              width={barW}
              height={12}
              rx={1.5}
              className={isSurplus ? "fill-success/70" : "fill-destructive/70"}
            />
            <text
              x={isSurplus ? x + barW + 4 : x - 4}
              y={y + 10}
              textAnchor={isSurplus ? "start" : "end"}
              className={cn("font-mono text-[9px] tabular-nums", isSurplus ? "fill-success" : "fill-destructive")}
            >
              {item.balance.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function innerH(h: number): number {
  return h - PAD.top - PAD.bottom;
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await getAnalyticsSummary());
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
    fetchData();
  }, [fetchData]);

  const compliant2026 =
    data?.ghg.filter((g) => g.y2026.surplusOrDeficit !== "DEFICIT").length ?? 0;
  const avgIntensity =
    data && data.ghg.length > 0
      ? data.ghg.reduce((acc, g) => acc + g.y2026.ghgIntensity, 0) / data.ghg.length
      : null;

  const ghgSeries = (data?.ghg ?? []).map((g) => ({
    label: g.vesselName,
    bars: [
      { label: "2025", value: g.y2025.ghgIntensity, color: "fill-muted" },
      { label: "2026", value: g.y2026.ghgIntensity, color: "fill-primary" },
    ],
  }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <span className="block h-px w-7 bg-primary" aria-hidden="true" />
            Fleet Analytics
          </p>
          <h1 className="font-serif text-lg font-light tracking-tight text-foreground">
            Performance &amp; Emissions Analytics
          </h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            FuelEU intensity, compliance balance and fuel activity
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="h-8">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} code={error.code} onRetry={fetchData} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Avg GHG Intensity 2026"
          value={avgIntensity === null ? "—" : avgIntensity.toFixed(1)}
          icon={<Leaf className="h-4 w-4" />}
          hint="gCO2e / MJ"
        />
        <StatTile
          label="Vessels Compliant"
          value={isLoading ? "—" : `${compliant2026} / ${data?.ghg.length ?? 0}`}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="FuelEU 2026 target"
        />
        <StatTile
          label="Fuel Delivered"
          value={isLoading ? "—" : data?.fleet.fuelDeliveries ?? 0}
          icon={<Fuel className="h-4 w-4" />}
          hint="BDNs in demo period"
        />
        <StatTile
          label="Pending Deliveries"
          value={isLoading ? "—" : data?.fleet.fuelDeliveriesPending ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="awaiting reconciliation"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              GHG Intensity vs FuelEU Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <GroupedBarChart series={ghgSeries} targetLabel="2026 target: 89.9 g/MJ" />
            )}
            <div className="mt-1 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-muted" /> 2025
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-primary" /> 2026
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Compliance Balance 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <HorizontalBalanceChart
                items={(data?.ghg ?? []).map((g) => ({
                  vesselName: g.vesselName,
                  balance: g.y2026.balance,
                  surplusOrDeficit: g.y2026.surplusOrDeficit,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Fuel Delivered by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-2">
                {(data?.byFuelType ?? []).map((f) => {
                  const total = (data?.byFuelType ?? []).reduce((acc, x) => acc + x.quantityMt, 0) || 1;
                  return (
                    <div key={f.fuelType} className="flex items-center gap-3">
                      <span className="w-16 font-mono text-[10px] uppercase text-muted-foreground">
                        {f.fuelType}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${(f.quantityMt / total) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-[11px] tabular-nums">
                        {f.quantityMt.toFixed(0)} t
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Fleet FuelEU Balance Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vessel</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Year</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.balance ?? []).map((b) => (
                    <tr key={`${b.vesselId}-${b.year}`} className="border-b border-border/50">
                      <td className="px-3 py-1.5 font-medium">{b.vesselName}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">{b.year}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {b.balance >= 0 ? "+" : ""}
                        {b.balance.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Badge variant={b.surplusOrDeficit === "SURPLUS" ? "success" : "destructive"}>
                          {b.surplusOrDeficit}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
