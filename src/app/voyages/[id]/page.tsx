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
import { useVoyageDetail } from "@/hooks/use-voyage-detail";
import { useVesselTrack } from "@/hooks/use-vessel-track";
import { useEnvironmentalZones } from "@/hooks/use-environmental-zones";
import { useZoneEvents } from "@/hooks/use-zone-events";
import { VesselMapView } from "@/components/map/vessel-map-view";
import { MAJOR_MED_PORTS } from "@/lib/geo/constants";

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

  const {
    voyage,
    isLoading: voyageLoading,
    error: voyageError,
    refetch,
  } = useVoyageDetail(voyageId);

  const voyageData = voyage as Record<string, unknown> | null;
  const imo = (voyageData?.vessel_imo as string | undefined) ?? null;
  const { track } = useVesselTrack(imo);
  const { zones } = useEnvironmentalZones();
  const { alerts: zoneAlerts } = useZoneEvents(imo);

  const depCoords = voyage ? (MAJOR_MED_PORTS[voyage.departure_port_name] ?? null) : null;
  const arrCoords = voyage ? (MAJOR_MED_PORTS[voyage.arrival_port_name] ?? null) : null;
  const depPort: { lat: number; lng: number; name: string } | null = depCoords ? { lat: depCoords.lat, lng: depCoords.lng, name: voyage!.departure_port_name } : null;
  const arrPort: { lat: number; lng: number; name: string } | null = arrCoords ? { lat: arrCoords.lat, lng: arrCoords.lng, name: voyage!.arrival_port_name } : null;

  return (
    <div>
      <PageHeader
        title={voyageLoading ? "Loading…" : voyage ? `${voyage.departure_port_name} → ${voyage.arrival_port_name}` : "Voyage Detail"}
        description={voyage ? `Voyage ${voyageId.slice(0, 8)}${voyageData?.vessel_name ? ` · ${String(voyageData.vessel_name)}` : ""}` : `Voyage ID: ${voyageId}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.voyages}>
              <ArrowLeft className="h-3 w-3" />
              Back to Voyages
            </Link>
          </Button>
        }
      />

      {voyageError && (
        <div className="mb-4">
          <ErrorBanner
            message={voyageError.message}
            code={"API_ERROR"}
            onRetry={refetch}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
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
            {voyageLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : voyage ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Anchor className="h-3.5 w-3.5 text-success" />
                    <div className="w-px h-6 bg-border" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{voyage.departure_port_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono-technical">
                      {formatTs(voyage.departure_time ?? null)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 mt-1">
                  <div className="flex flex-col items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{voyage.arrival_port_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono-technical">
                      {formatTs(voyage.arrival_time ?? null)}
                    </p>
                  </div>
                </div>
                <Separator className="my-2" />
                <InfoRow label="Distance" value={voyage.distance_nm != null ? `${voyage.distance_nm} nm` : "—"} mono />
                <InfoRow label="IMO" value={voyageData?.vessel_imo != null ? String(voyageData.vessel_imo) : "—"} mono />
                <InfoRow label="Vessel" value={voyageData?.vessel_name != null ? String(voyageData.vessel_name) : "—"} />
                <InfoRow label="Fetched" value={formatTs(voyage.source_fetched_at)} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <div className="text-center">
                  <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p>Voyage not found</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Route Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <VesselMapView
              trackPoints={track?.points}
              departurePort={depPort}
              arrivalPort={arrPort}
              zones={zones.map((z) => ({ id: z.id, name: z.name, category: z.category, geometryCoordinates: z.geometry_coordinates, description: z.description }))}
              zoneAlerts={zoneAlerts}
              height="h-64"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
