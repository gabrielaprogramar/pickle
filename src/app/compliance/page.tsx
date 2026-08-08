"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  FileCheck2,
  AlertOctagon,
  Radar,
  Loader2,
  RotateCw,
  Waves,
  PackageCheck,
  Download,
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
import {
  getComplianceReports,
  getSoxWatch,
  getVerifierPackages,
  type ComplianceReportSummary,
  type SoxWatchVessel,
} from "@/services/compliance.service";
import { getVessels } from "@/services/vessels.service";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils/cn";
import type { VerifierPackageRow } from "@/lib/supabase/types";
import { StatValue } from "@/components/ui/stat-value";
import { LivePulse } from "@/components/ui/live-pulse";
import { EnforcementCountdown } from "@/components/compliance/enforcement-countdown";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline" | "muted"> = {
  GENERATED: "success",
  READY: "success",
  VERIFIED: "success",
  SUBMITTED: "success",
  DRAFT: "warning",
  FAILED: "destructive",
  REJECTED: "destructive",
};

const SOX_STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  CLEAR: "success",
  WARNING: "warning",
  NON_CONFORMING: "destructive",
  NO_EVIDENCE: "destructive",
  UNKNOWN: "outline",
};

const REPORT_TYPE_LABEL: Record<string, string> = {
  thetis_mrv: "THETIS-MRV",
  fueleu: "FuelEU",
  green_zone: "Green Zone",
  fleet_summary: "Fleet Summary",
  esg_package: "ESG",
};

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
        <StatValue size="sm">{value}</StatValue>
        {hint && (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComplianceWorkspacePage() {
  const [reports, setReports] = useState<ComplianceReportSummary[]>([]);
  const [watch, setWatch] = useState<SoxWatchVessel[]>([]);
  const [packages, setPackages] = useState<VerifierPackageRow[]>([]);
  const [vesselNames, setVesselNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportsRes, watchRes, packagesRes, vesselsRes] = await Promise.all([
        getComplianceReports(),
        getSoxWatch(),
        getVerifierPackages(),
        getVessels({ limit: 50 }),
      ]);
      setReports(reportsRes.reports);
      setWatch(watchRes.watch);
      setPackages(packagesRes.packages);
      setVesselNames(
        Object.fromEntries(vesselsRes.rows.map((v) => [v.id, v.name])),
      );
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
    fetchAll();
  }, [fetchAll]);

  const generated = reports.filter((r) => r.status === "GENERATED" || r.status === "READY" || r.status === "VERIFIED" || r.status === "SUBMITTED").length;
  const failed = reports.filter((r) => r.status === "FAILED" || r.status === "REJECTED").length;
  const soxAtRisk = watch.filter((v) => v.status !== "CLEAR").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <span className="block h-px w-7 bg-primary" aria-hidden="true" />
            Regulatory Compliance
          </p>
          <h1 className="font-serif text-lg font-light tracking-tight text-foreground">
            Compliance Workspace
          </h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Reports, verifier packages and zone monitoring
          </p>
          <div className="mt-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            <LivePulse
              tone={
                watch.some((s) => s.status === "NON_CONFORMING")
                  ? "red"
                  : watch.some((s) => s.status === "WARNING")
                    ? "gold"
                    : "teal"
              }
              label={
                watch.some((s) => s.status === "NON_CONFORMING")
                  ? "Sox Alert"
                  : watch.some((s) => s.status === "WARNING")
                    ? "Sox Warning"
                    : "Sox Clear"
              }
            />
            <span>fleet SOx watch · {watch.length} vessels</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading} className="h-8">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} code={error.code} onRetry={fetchAll} />
        </div>
      )}

      <div className="mb-4">
        <EnforcementCountdown />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Reports Generated"
          value={isLoading ? "—" : generated}
          icon={<FileCheck2 className="h-4 w-4" />}
          hint={`of ${reports.length} total`}
        />
        <StatTile
          label="Attention"
          value={isLoading ? "—" : failed}
          icon={<AlertOctagon className="h-4 w-4" />}
          hint="failed or rejected"
        />
        <StatTile
          label="SOx Watch at Risk"
          value={isLoading ? "—" : soxAtRisk}
          icon={<Radar className="h-4 w-4" />}
          hint="vessels not CLEAR"
        />
        <StatTile
          label="Verifier Packages"
          value={isLoading ? "—" : packages.length}
          icon={<PackageCheck className="h-4 w-4" />}
          hint="2025 reporting year"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              <span className="flex items-center gap-2">
                <Waves className="h-3.5 w-3.5" />
                SOx Emission Control Watch
              </span>
            </CardTitle>
            <Badge variant="outline" className="text-[9px]">Med SOx ECA</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead>Vessel</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>S%</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watch.map((v) => (
                    <TableRow key={v.vesselId}>
                      <TableCell>
                        <div className="font-medium text-foreground">{v.name}</div>
                        <div className="font-mono text-[10px] uppercase text-muted-foreground">
                          {v.imo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.insideEca ? "warning" : "muted"}>
                          {v.zoneState ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] tabular-nums">
                        {v.sulphurContentPct != null
                          ? `${v.sulphurContentPct.toFixed(2)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SOX_STATUS_VARIANT[v.status] ?? "outline"}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.evidenceStatus === "CONFORMING" ? "success" : "warning"} className="text-[9px]">
                          {v.evidenceStatus?.replace(/_/g, " ")}
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
              <span className="flex items-center gap-2">
                <PackageCheck className="h-3.5 w-3.5" />
                Verifier Packages 2025
              </span>
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
              <Table>
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead>Package</TableHead>
                    <TableHead>Vessel</TableHead>
                    <TableHead>Manifest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{p.title}</div>
                        <div className="font-mono text-[10px] uppercase text-muted-foreground">
                          {p.package_version} · {p.file_size ? `${(p.file_size / 1e6).toFixed(1)} MB` : "no artifact"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {p.vessel_id ? (vesselNames[p.vessel_id] ?? p.vessel_id) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {p.manifest
                          ? `BDN ${(p.manifest as { fuelDeliveries?: number }).fuelDeliveries ?? "–"} · NR ${(p.manifest as { noonReports?: number }).noonReports ?? "–"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status] ?? "muted"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.storage_path && (
                          <a
                            href={`/api/verifier-packages/${p.id}/download`}
                            className="text-muted-foreground hover:text-foreground"
                            title="Download package"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-1">
          <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance Reports
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.title}</TableCell>
                    <TableCell>
                      <Badge variant="muted" className="text-[9px]">
                        {REPORT_TYPE_LABEL[r.report_type] ?? r.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums">
                      {r.reporting_year}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[r.status] ?? "muted"}
                        className={cn(r.status === "FAILED" && "animate-pulse")}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.generated_at
                        ? new Date(r.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
