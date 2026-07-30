"use client";

import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Navigation,
  Anchor,
  MapPin,
  Route,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { ROUTES } from "@/constants/routes";
import Link from "next/link";

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

export default function VoyageDetailPage() {
  const params = useParams();
  const voyageId = params.id as string;

  return (
    <div>
      <PageHeader
        title="Voyage Detail"
        description={`Voyage ID: ${voyageId}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.voyages}>
              <ArrowLeft className="h-3 w-3" />
              Back to Voyages
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Voyage Information
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-mono-technical">
              {voyageId.slice(0, 8)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              <div className="text-center">
                <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Detailed voyage view</p>
                <p className="mt-1 text-[10px]">
                  A dedicated voyage endpoint (GET /api/voyages/[id]) will enable
                  this page to display full voyage data. Currently, voyage
                  information is visible in the Voyages list and Vessel Detail pages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
