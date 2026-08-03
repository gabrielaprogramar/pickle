"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Ship,
  Navigation,
  Radio,
  FileText,
  ClipboardCheck,
  ScanEye,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import { getVessels } from "@/services/vessels.service";
import { ApiError } from "@/services/api-client";
import { ROUTES } from "@/constants/routes";
import type { VesselRow } from "@/lib/supabase/types";

interface DashboardStats {
  readonly totalVessels: number;
  readonly latestUpdate: string | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
}

interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly icon: React.ReactNode;
  readonly href?: string;
  readonly badge?: string;
  readonly isLoading?: boolean;
  readonly mono?: boolean;
}

function StatCard({
  label,
  value,
  icon,
  href,
  badge,
  isLoading,
  mono,
}: StatCardProps) {
  const card = (
    <Card className="interactive">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground/60">{icon}</div>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <>
            <span
              className={`text-lg font-semibold tabular-nums ${
                mono ? "font-mono-technical" : ""
              }`}
            >
              {value}
            </span>
            {badge && (
              <Badge variant="muted" className="text-[9px]">
                {badge}
              </Badge>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{card}</Link>;
  }
  return card;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVessels: 0,
    latestUpdate: null,
    isLoading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    setStats((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await getVessels({ limit: 1 });
      const totalVessels = result.total;
      const latestVessel = result.rows[0] as VesselRow | undefined;
      const latestUpdate = latestVessel?.updated_at ?? null;

      setStats({
        totalVessels,
        latestUpdate,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setStats({
        totalVessels: 0,
        latestUpdate: null,
        isLoading: false,
        error:
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", String(err), 0),
      });
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div>
      <div className="mb-6">
        <p className="mb-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
          <span className="block h-px w-7 bg-primary" aria-hidden="true" />
          Fleet Overview
        </p>
        <h1 className="font-serif text-lg font-light tracking-tight text-foreground">
          Operational Dashboard
        </h1>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Fleet overview and system status
        </p>
      </div>

      {stats.error && (
        <div className="mb-6">
          <ErrorBanner
            message={stats.error.message}
            code={stats.error.code}
            onRetry={fetchStats}
          />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard
          label="Total Vessels"
          value={stats.totalVessels}
          icon={<Ship className="h-4 w-4" />}
          href={ROUTES.fleet}
          isLoading={stats.isLoading}
        />
        <StatCard
          label="Active Voyages"
          value="—"
          icon={<Navigation className="h-4 w-4" />}
          href={ROUTES.voyages}
          badge="Soon"
        />
        <StatCard
          label="Latest AIS Update"
          value={formatTimestamp(stats.latestUpdate)}
          icon={<Radio className="h-4 w-4" />}
          href={ROUTES.ais}
          isLoading={stats.isLoading}
        />
        <StatCard
          label="Documents"
          value="—"
          icon={<FileText className="h-4 w-4" />}
          href={ROUTES.documents}
        />
        <StatCard
          label="Review"
          value="—"
          icon={<ClipboardCheck className="h-4 w-4" />}
          href={ROUTES.review}
        />
        <StatCard
          label="OCR Queue"
          value="—"
          icon={<ScanEye className="h-4 w-4" />}
          badge="Phase 2"
        />
        <StatCard
          label="Compliance Alerts"
          value="—"
          icon={<ShieldCheck className="h-4 w-4" />}
          badge="Phase 2"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
              <Link href={ROUTES.fleet}>
                <span className="flex items-center gap-2">
                  <Ship className="h-3.5 w-3.5" />
                  View Fleet
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
              <Link href={ROUTES.voyages}>
                <span className="flex items-center gap-2">
                  <Navigation className="h-3.5 w-3.5" />
                  Track Voyages
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
              <Link href={ROUTES.ais}>
                <span className="flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5" />
                  AIS Positions
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
              <Link href={ROUTES.documents}>
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Documents
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-between h-8 text-xs" asChild>
              <Link href={ROUTES.review}>
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Review Queue
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.06em]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">API</span>
                <Badge variant="success" className="text-[9px]">Operational</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">MarineTraffic</span>
                <Badge variant="muted" className="text-[9px]">Connected</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">OCR Engine</span>
                <Badge variant="outline" className="text-[9px]">Pending</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Compliance</span>
                <Badge variant="outline" className="text-[9px]">Pending</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
