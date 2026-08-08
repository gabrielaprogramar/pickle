"use client";

import { FileCheck, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useCertificates } from "@/hooks/use-certificates";
import { certificateTypeLabel } from "@/lib/certificates";
import { cn } from "@/lib/utils/cn";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  VALID: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "destructive",
  INVALID: "destructive",
  MISSING: "muted",
  UNKNOWN: "muted",
  PENDING_REVIEW: "warning",
};

function statusVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  return STATUS_VARIANT[status] ?? "muted";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className={`text-xs ${mono ? "font-mono-technical tabular-nums" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function CertificatesCard({ imo }: { readonly imo: string }) {
  const { data, isLoading, error, refetch } = useCertificates(imo, { mock: true });

  const certificates = data?.certificates ?? [];
  const summary = data?.summary ?? {};
  const expiring = summary["EXPIRING_SOON"] ?? 0;
  const expired = summary["EXPIRED"] ?? 0;

  return (
    <Card id="certificates">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
          <FileCheck className="h-3.5 w-3.5 text-primary" />
          Certificate Registry
          {data?.mock === true && (
            <Badge variant="warning" className="text-[9px]">
              Mock
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {(expiring > 0 || expired > 0) && (
            <Badge variant="outline" className="text-[9px] font-mono">
              {expiring} expiring · {expired} expired
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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>{error.message}</span>
          </div>
        ) : certificates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No certificate records for this vessel yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {certificates.map((view) => {
              const { record, status, blocking, reasonCode, reviewRequired, daysUntilExpiry } = view;
              const title = certificateTypeLabel(record.certificate_type);
              return (
                <div key={record.id} className="rounded-md border border-border/60 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{title}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {record.certificate_number ?? record.certificate_type}
                        {record.version > 1 ? ` · v${record.version}` : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant(status)} className="text-[9px]">
                      {status}
                    </Badge>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="grid grid-cols-2 gap-x-4">
                    <InfoRow label="Expiry" value={formatDate(record.expiry_date)} mono />
                    <InfoRow
                      label="Days Left"
                      value={daysUntilExpiry != null ? `${daysUntilExpiry}d` : "—"}
                      mono
                    />
                  </div>
                  {(blocking || reviewRequired) && (
                    <p className="mt-1 text-[10px] text-destructive/80">
                      {blocking ? "Blocking" : ""}
                      {blocking && reviewRequired ? " · " : ""}
                      {reviewRequired ? `Review: ${(reasonCode ?? "PENDING_REVIEW").replaceAll("_", " ").toLowerCase()}` : ""}
                    </p>
                  )}
                  {record.document_id && (
                    <Link
                      href={`/documents/${record.document_id}`}
                      className="mt-1 inline-block text-[10px] text-primary underline-offset-2 hover:underline"
                    >
                      View source document →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
