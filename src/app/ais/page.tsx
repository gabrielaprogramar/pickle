"use client";

import { useState } from "react";
import { Radio, Search, Map } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { LoadingTable } from "@/components/loading-table";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { PaginationControls } from "@/components/pagination-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAisPositions } from "@/hooks/use-ais-positions";
import { useEnvironmentalZones } from "@/hooks/use-environmental-zones";
import { VesselMapView } from "@/components/map/vessel-map-view";
import type { AisPositionRow } from "@/lib/supabase/types";

const IMO_PATTERN = /^\d{7}$/;

function navStatusBadge(status: string | null): React.ReactNode {
  if (!status) return <span className="text-muted-foreground">—</span>;

  const lower = status.toLowerCase();
  let variant: "success" | "warning" | "destructive" | "muted" | "outline" = "muted";

  if (lower.includes("under way") || lower.includes("underway") || lower === "0") {
    variant = "success";
  } else if (lower.includes("moored") || lower.includes("at anchor") || lower.includes("anchored")) {
    variant = "warning";
  } else if (lower.includes("not defined") || lower === "15") {
    variant = "muted";
  } else if (lower.includes("aground") || lower.includes("sos")) {
    variant = "destructive";
  }

  return <Badge variant={variant} className="text-[9px]">{status}</Badge>;
}

const COLUMNS: readonly ColumnDef<AisPositionRow & Record<string, unknown>>[] = [
  {
    key: "ts",
    header: "Timestamp",
    sortable: true,
    className: "font-mono-technical tabular-nums w-36",
    render: (row) =>
      new Date(String(row.ts)).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
  },
  {
    key: "latitude",
    header: "Lat",
    sortable: true,
    className: "font-mono-technical tabular-nums w-20 text-right",
    render: (row) => Number(row.latitude).toFixed(4),
  },
  {
    key: "longitude",
    header: "Lon",
    sortable: true,
    className: "font-mono-technical tabular-nums w-20 text-right",
    render: (row) => Number(row.longitude).toFixed(4),
  },
  {
    key: "sog",
    header: "SOG",
    sortable: true,
    className: "font-mono-technical tabular-nums w-16 text-right",
    render: (row) => (row.sog != null ? `${Number(row.sog).toFixed(1)}` : "—"),
  },
  {
    key: "cog",
    header: "COG",
    sortable: true,
    className: "font-mono-technical tabular-nums w-16 text-right",
    render: (row) => (row.cog != null ? `${Number(row.cog).toFixed(1)}°` : "—"),
  },
  {
    key: "heading",
    header: "HDG",
    sortable: true,
    className: "font-mono-technical tabular-nums w-16 text-right",
    render: (row) => (row.heading != null ? `${Number(row.heading).toFixed(0)}°` : "—"),
  },
  {
    key: "nav_status",
    header: "Nav Status",
    className: "w-28",
    render: (row) => navStatusBadge(row.nav_status as string | null),
  },
];

export default function AisPage() {
  const [imoInput, setImoInput] = useState("");
  const [activeImo, setActiveImo] = useState<string | null>(null);

  const {
    positions,
    total,
    totalPages,
    isLoading,
    error,
    page,
    setPage,
    refetch,
  } = useAisPositions(activeImo, 25);

  const { zones } = useEnvironmentalZones();

  const handleLookup = () => {
    const trimmed = imoInput.trim();
    if (IMO_PATTERN.test(trimmed)) {
      setActiveImo(trimmed);
      setPage(1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  const latestPos = positions[0] as AisPositionRow | undefined;

  return (
    <div>
      <PageHeader
        title="AIS Positions"
        description="Real-time vessel tracking data"
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
          <ErrorBanner
            message={error.message}
            code={error.code}
            onRetry={refetch}
          />
        </div>
      )}

      {!activeImo ? (
        <EmptyState
          icon={<Radio className="h-8 w-8" />}
          title="Select a vessel"
          description="Enter a 7-digit IMO number above to view AIS position history."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-lg border border-border">
            {isLoading ? (
              <LoadingTable columns={COLUMNS.length} rows={10} />
            ) : positions.length === 0 ? (
              <EmptyState
                icon={<Radio className="h-8 w-8" />}
                title="No AIS positions found"
                description={`No positions recorded for IMO ${activeImo}.`}
              />
            ) : (
              <DataTable<AisPositionRow & Record<string, unknown>>
                columns={COLUMNS}
                rows={positions}
                rowKey="id"
                emptyMessage="No positions available."
              />
            )}
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={25}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Map className="h-3.5 w-3.5 text-primary" />
                  Position Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <VesselMapView
                  trackPoints={positions.map((p) => ({
                    lat: p.latitude,
                    lng: p.longitude,
                    ts: String(p.ts),
                    sog: p.sog,
                    cog: p.cog,
                    heading: p.heading,
                    navStatus: p.nav_status,
                  }))}
                  vesselPosition={latestPos ? { lat: latestPos.latitude, lng: latestPos.longitude } : null}
                  vesselLabel={`IMO ${activeImo}`}
                  zones={zones.map((z) => ({ id: z.id, name: z.name, category: z.category, geometryCoordinates: z.geometry_coordinates, description: z.description }))}
                  height="h-64"
                />
              </CardContent>
            </Card>

            {latestPos && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
                    Latest Position
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Coordinates</span>
                    <span className="font-mono-technical tabular-nums">
                      {latestPos.latitude.toFixed(4)}, {latestPos.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">SOG</span>
                    <span className="font-mono-technical tabular-nums">
                      {latestPos.sog != null ? `${latestPos.sog.toFixed(1)} kn` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">COG</span>
                    <span className="font-mono-technical tabular-nums">
                      {latestPos.cog != null ? `${latestPos.cog.toFixed(1)}°` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Heading</span>
                    <span className="font-mono-technical tabular-nums">
                      {latestPos.heading != null ? `${latestPos.heading.toFixed(0)}°` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Timestamp</span>
                    <span className="font-mono-technical tabular-nums text-[10px]">
                      {new Date(latestPos.ts).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
