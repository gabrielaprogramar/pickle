"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCw, Gauge, Coins, Scale, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import { PageHeader } from "@/components/page-header";
import { StatValue } from "@/components/ui/stat-value";
import { getEtsSummary, type EtsSummary } from "@/services/eu-ets.service";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils/cn";

function formatTonnes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `€${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

function StatusBadge({ status }: { readonly status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const s = status.toUpperCase();
  let variant: "success" | "warning" | "destructive" | "outline" | "muted" = "muted";
  if (s === "ON_TRACK" || s === "OK" || s === "SUBMITTED" || s === "COMPLIANT" || s === "CLEAR") variant = "success";
  else if (s === "REVIEW" || s === "WARNING" || s === "APPROACHING" || s === "PENDING") variant = "warning";
  else if (s === "OVERDUE" || s === "URGENT" || s === "FAILED" || s === "NON_COMPLIANT") variant = "destructive";
  else variant = "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function BalanceBadge({ balance }: { readonly balance: number | null }) {
  if (balance === null || balance === undefined) return <span className="text-muted-foreground">—</span>;
  const surplus = balance >= 0;
  return (
    <Badge variant={surplus ? "success" : "destructive"} className="tabular-nums">
      {surplus ? "Surplus" : "Shortfall"} {Math.abs(balance).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  icon,
  hint,
  tone,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly icon: React.ReactNode;
  readonly hint?: string;
  readonly tone?: "default" | "teal" | "gold" | "red" | "muted";
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
        <StatValue size="md" tone={tone}>{value}</StatValue>
        {hint && (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EuEtsPage() {
  const [data, setData] = useState<EtsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await getEtsSummary());
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const noHeld = data?.vessels.some((v) => v.allowancesHeld !== null) === false;

  return (
    <div>
      <PageHeader
        label="EU ETS"
        title="EU ETS Compliance"
        description="Fleet emissions, EUA obligation and surrenders for the EU Emissions Trading System (maritime)."
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" />
              Surrender 30 Sep · MRV 31 Mar
            </span>
            {data?.fleet.euaPriceEur !== null && data?.fleet.euaPriceEur !== undefined && (
              <span className="flex items-center gap-1.5">
                <Coins className="h-3 w-3" />
                EUA {data.fleet.euaPriceEur.toFixed(2)} €/t
              </span>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="h-8">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error.message} code={error.code} onRetry={fetchData} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Covered CO₂ · Fleet"
          value={isLoading ? "—" : formatTonnes(data?.fleet.totalCoveredCo2Tonnes)}
          icon={<Gauge className="h-4 w-4" />}
          hint="tonnes CO₂ in scope"
        />
        <StatTile
          label="EUA Obligation"
          value={isLoading ? "—" : formatTonnes(data?.fleet.totalEuaObligationTonnes)}
          icon={<Scale className="h-4 w-4" />}
          hint="allowances required"
        />
        <StatTile
          label="Estimated Cost"
          value={isLoading ? "—" : formatCost(data?.fleet.totalEstimatedCostEur)}
          icon={<Coins className="h-4 w-4" />}
          hint="at current EUA price"
        />
        <StatTile
          label="Vessels in Scope"
          value={isLoading ? "—" : data?.fleet.totalVesselsWithRecords ?? 0}
          icon={<Gauge className="h-4 w-4" />}
          hint="with ETS records"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              <span className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5" />
                Allowance Position
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : noHeld || data === null ? (
              <p className="text-xs text-muted-foreground">
                No allowance holdings are recorded for the current reporting period. Allowance
                holdings are surfaced here when captured on each EU ETS record.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Obligation</div>
                    <div className="font-mono text-sm tabular-nums">{formatTonnes(data.fleet.totalEuaObligationTonnes)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Held</div>
                    <div className="font-mono text-sm tabular-nums">{formatTonnes(data.fleet.totalAllowancesHeld)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Balance</div>
                    <div className={cn(
                      "font-mono text-sm tabular-nums",
                      (data.fleet.fleetAllowanceBalance ?? 0) >= 0 ? "text-success" : "text-destructive",
                    )}>
                      {formatTonnes(data.fleet.fleetAllowanceBalance)}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Position shown as allowances held versus the annual surrender obligation. A positive
                  balance indicates a surplus available for surrender at the 30 September deadline.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              <span className="flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5" />
                Reporting Timeline
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {data?.fleet.surrenderDeadlines.map((d) => (
                  <div key={d.type} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="text-xs font-medium">{d.label}</div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">{d.month}/{d.day}</div>
                    </div>
                    <div className="font-mono text-xs tabular-nums">
                      {`${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  EU ETS phase-in: 40% (2024) → 70% (2025) → 100% (2026). Intra-EU voyages are covered
                  100%; EU↔third-country voyages 50%.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Vessel EU ETS Position
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : data === null || data.vessels.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">
                No EU ETS records available. Records appear here once a compliance calculation has
                been run for a reporting year.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vessel</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">IMO</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">CO₂ (t)</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Obligation</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Held</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Coverage</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Surrender</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vessels.map((v) => (
                      <tr key={`${v.vesselId}-${v.reportingYear}`} className="border-b border-border/50">
                        <td className="px-3 py-2 font-medium">{v.vesselName}</td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">{v.imo}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatTonnes(v.coveredCo2Tonnes)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatTonnes(v.euaObligationTonnes)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatTonnes(v.allowancesHeld)}</td>
                        <td className="px-3 py-2 text-right">
                          <BalanceBadge balance={v.allowanceBalance} />
                        </td>
                        <td className="px-3 py-2 text-center font-mono tabular-nums">{formatRate(v.coverageRate)}</td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={v.surrenderStatus} />
                        </td>
                        <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">{v.reportingYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
        Calculation v1.0.0 · parameter version from each record · emissions distributed across voyages
      </p>
    </div>
  );
}
