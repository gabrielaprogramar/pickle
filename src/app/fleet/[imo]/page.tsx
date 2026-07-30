"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ship,
  Navigation,
  Radio,
  Clock,
  MapPin,
  Gauge,
  Compass,
  Anchor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/error-banner";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { useVessel } from "@/hooks/use-vessel";
import { useLatestVoyage } from "@/hooks/use-latest-voyage";
import { useLatestAisPosition } from "@/hooks/use-latest-ais-position";
import { useVesselTrack } from "@/hooks/use-vessel-track";
import { useEnvironmentalZones } from "@/hooks/use-environmental-zones";
import { VesselMapView } from "@/components/map/vessel-map-view";
import { MAJOR_MED_PORTS } from "@/lib/geo/constants";
import { ROUTES } from "@/constants/routes";

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

export default function VesselDetailPage() {
  const params = useParams();
  const imo = params.imo as string;

  const {
    vessel,
    isLoading: vesselLoading,
    error: vesselError,
    refetch: refetchVessel,
  } = useVessel(imo);

  const {
    voyage: latestVoyage,
    isLoading: voyageLoading,
    error: voyageError,
  } = useLatestVoyage(vessel ? imo : null);

  const {
    position: latestPosition,
    isLoading: positionLoading,
    error: positionError,
  } = useLatestAisPosition(vessel?.id ?? null);

  const { track } = useVesselTrack(imo);
  const { zones } = useEnvironmentalZones();

  const depPort = latestVoyage ? MAJOR_MED_PORTS[latestVoyage.departure_port_name] ?? null : null;
  const arrPort = latestVoyage ? MAJOR_MED_PORTS[latestVoyage.arrival_port_name] ?? null : null;

  return (
    <div>
      <PageHeader
        title={vesselLoading ? "Loading…" : vessel?.name ?? `IMO ${imo}`}
        description={vesselLoading ? "" : vessel?.name ? `IMO ${imo}` : `Vessel ${imo}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.fleet}>
              <ArrowLeft className="h-3 w-3" />
              Back to Fleet
            </Link>
          </Button>
        }
      />

      {vesselError && (
        <div className="mb-4">
          <ErrorBanner
            message={vesselError.message}
            code={vesselError.code}
            onRetry={refetchVessel}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Ship className="h-3.5 w-3.5 text-primary" />
              Vessel Information
            </CardTitle>
            <Badge variant="outline" className="text-[9px]">
              {vesselLoading ? "—" : vessel?.id ? "Active" : "Unknown"}
            </Badge>
          </CardHeader>
          <CardContent>
            {vesselLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <div>
                <InfoRow label="IMO" value={imo} mono />
                <InfoRow label="Name" value={vessel?.name} />
                <InfoRow label="MMSI" value={vessel?.mmsi} mono />
                <InfoRow label="Ship ID" value={vessel?.ship_id} mono />
                <InfoRow label="Registered" value={formatTs(vessel?.created_at ?? null)} />
                <Separator className="my-1" />
                <InfoRow label="Last Updated" value={formatTs(vessel?.updated_at ?? null)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Latest Voyage
            </CardTitle>
            {latestVoyage && (
              <Badge
                variant={latestVoyage.source_is_mock ? "warning" : "success"}
                className="text-[9px]"
              >
                {latestVoyage.source_is_mock ? "Mock" : "Live"}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {voyageLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : voyageError ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>No voyage data available</span>
              </div>
            ) : latestVoyage ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Anchor className="h-3.5 w-3.5 text-success" />
                    <div className="w-px h-6 bg-border" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">
                      {latestVoyage.departure_port_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono-technical">
                      {formatTs(latestVoyage.departure_time ?? null)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 mt-1">
                  <div className="flex flex-col items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">
                      {latestVoyage.arrival_port_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono-technical">
                      {formatTs(latestVoyage.arrival_time ?? null)}
                    </p>
                  </div>
                </div>
                <Separator className="my-2" />
                <InfoRow
                  label="Distance"
                  value={
                    latestVoyage.distance_nm != null
                      ? `${latestVoyage.distance_nm} nm`
                      : "—"
                  }
                  mono
                />
                <InfoRow
                  label="Fetched"
                  value={formatTs(latestVoyage.source_fetched_at)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                No voyages recorded for this vessel
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-primary" />
              Latest AIS Position
            </CardTitle>
            {latestPosition && (
              <Badge variant="success" className="text-[9px]">Latest</Badge>
            )}
          </CardHeader>
          <CardContent>
            {positionLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : positionError || !latestPosition ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                No AIS positions available for this vessel
              </div>
            ) : (
              <div>
                <InfoRow
                  label="Timestamp"
                  value={formatTs(latestPosition.ts)}
                />
                <Separator className="my-1" />
                <InfoRow
                  label="Latitude"
                  value={latestPosition.latitude.toFixed(4)}
                  mono
                />
                <InfoRow
                  label="Longitude"
                  value={latestPosition.longitude.toFixed(4)}
                  mono
                />
                <Separator className="my-1" />
                <div className="grid grid-cols-2 gap-x-4">
                  <InfoRow
                    label="SOG"
                    value={
                      latestPosition.sog != null
                        ? `${latestPosition.sog} kn`
                        : "—"
                    }
                    mono
                  />
                  <InfoRow
                    label="COG"
                    value={
                      latestPosition.cog != null
                        ? `${latestPosition.cog.toFixed(1)}°`
                        : "—"
                    }
                    mono
                  />
                  <InfoRow
                    label="Heading"
                    value={
                      latestPosition.heading != null
                        ? `${latestPosition.heading.toFixed(1)}°`
                        : "—"
                    }
                    mono
                  />
                  <InfoRow
                    label="Nav Status"
                    value={latestPosition.nav_status ?? "—"}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start text-muted-foreground"
                disabled
              >
                <Gauge className="h-3.5 w-3.5 mr-2" />
                Request AIS Ingestion
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start text-muted-foreground"
                disabled
              >
                <Compass className="h-3.5 w-3.5 mr-2" />
                Ingest from MarineTraffic
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Voyage Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <VesselMapView
              trackPoints={track?.points}
              vesselPosition={latestPosition ? { lat: latestPosition.latitude, lng: latestPosition.longitude } : null}
              vesselLabel={vessel?.name}
              departurePort={depPort ? { lat: depPort.lat, lng: depPort.lng, name: latestVoyage!.departure_port_name } : null}
              arrivalPort={arrPort ? { lat: arrPort.lat, lng: arrPort.lng, name: latestVoyage!.arrival_port_name } : null}
              zones={zones.map((z) => ({ id: z.id, name: z.name, category: z.category, geometryCoordinates: z.geometry_coordinates, description: z.description }))}
              height="h-80"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
