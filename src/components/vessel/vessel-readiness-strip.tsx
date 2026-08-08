"use client";

import { useEffect, useState } from "react";
import { FileCheck2, Waves, Radio, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LivePulse, type LiveTone } from "@/components/ui/live-pulse";
import { StatValue } from "@/components/ui/stat-value";
import { useCertificates } from "@/hooks/use-certificates";
import { useSoxWatch } from "@/hooks/use-sox-watch";
import type { AisPositionRow, VoyageRow } from "@/lib/supabase/types";

interface VesselReadinessStripProps {
  readonly imo: string;
  readonly position?: AisPositionRow | null;
  readonly voyage?: VoyageRow | null;
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusCell({
  icon,
  label,
  value,
  sub,
  tone,
  loading = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: React.ReactNode;
  readonly sub?: string;
  readonly tone: LiveTone;
  readonly loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 first:pl-0 sm:border-l sm:border-border/60 sm:first:border-l-0">
      <span className="flex items-center gap-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <StatValue size="md" tone={tone === "muted" ? "muted" : tone}>
          {value}
        </StatValue>
      )}
      <span className="flex items-center gap-1.5">
        <LivePulse tone={tone} label={loading ? "Syncing" : sub ?? "Idle"} />
      </span>
    </div>
  );
}

/**
 * VesselReadinessStrip — a single-glance operational readout for a
 * vessel: certificate validity, SOx watch, AIS freshness and voyage
 * state. Uses the shared StatValue/LivePulse primitives so the tone
 * ladder (teal → gold → red) stays consistent app-wide.
 */
export function VesselReadinessStrip({
  imo,
  position,
  voyage,
}: VesselReadinessStripProps) {
  const certificates = useCertificates(imo, { mock: true });
  const sox = useSoxWatch(imo);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const certs = certificates.data?.certificates ?? [];
  const blocking = certs.filter((c) => c.blocking).length;
  const expired = certs.filter((c) => c.status === "EXPIRED" || c.status === "INVALID").length;
  const expiringSoon = certs.filter(
    (c) => c.status === "EXPIRING_SOON" || (c.daysUntilExpiry != null && c.daysUntilExpiry <= 90),
  ).length;
  const certTone: LiveTone = blocking + expired > 0 ? "red" : expiringSoon > 0 ? "gold" : "teal";
  const certSub = blocking + expired > 0
    ? `${blocking + expired} blocking`
    : expiringSoon > 0
      ? `${expiringSoon} expiring`
      : "all valid";

  const watchStatus = sox.data?.watch?.status ?? null;
  const soxTone: LiveTone =
    watchStatus === "NON_CONFORMING"
      ? "red"
      : watchStatus === "WARNING" || watchStatus === "NO_EVIDENCE"
        ? "gold"
        : watchStatus === "CLEAR"
          ? "teal"
          : "muted";
  const soxSub = watchStatus ? watchStatus.replaceAll("_", " ").toLowerCase() : "not evaluated";

  const ts = position?.ts ?? null;
  const minutesAgo = ts ? Math.floor((now.getTime() - new Date(ts).getTime()) / 60_000) : null;
  const aisTone: LiveTone = minutesAgo == null ? "muted" : minutesAgo > 30 ? "gold" : "teal";
  const aisValue = ts ? formatClock(ts) : "—";
  const aisSub = minutesAgo == null ? "no signal" : `${minutesAgo}m ago`;

  const voyageTone: LiveTone = voyage ? "teal" : "muted";
  const voyageValue = voyage?.arrival_port_name ?? "—";
  const voyageSub = voyage
    ? `${voyage.departure_port_name} → ${voyage.arrival_port_name}`
    : "no active voyage";

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-4 p-0 sm:flex-row sm:gap-0">
        <StatusCell
          icon={<FileCheck2 className="h-3 w-3 text-primary" />}
          label="Certificates"
          value={certs.length}
          sub={certSub}
          tone={certTone}
          loading={certificates.isLoading}
        />
        <StatusCell
          icon={<Waves className="h-3 w-3 text-primary" />}
          label="Sox Watch"
          value={watchStatus ?? "—"}
          sub={soxSub}
          tone={soxTone}
          loading={sox.isLoading}
        />
        <StatusCell
          icon={<Radio className="h-3 w-3 text-primary" />}
          label="AIS"
          value={aisValue}
          sub={aisSub}
          tone={aisTone}
        />
        <StatusCell
          icon={<Navigation className="h-3 w-3 text-primary" />}
          label="Voyage"
          value={voyageValue}
          sub={voyageSub}
          tone={voyageTone}
        />
      </CardContent>
    </Card>
  );
}
