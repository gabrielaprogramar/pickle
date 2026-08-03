"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { LoadingTable } from "@/components/loading-table";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { PaginationControls } from "@/components/pagination-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoyages } from "@/hooks/use-voyages";
import { ROUTES } from "@/constants/routes";
import type { VoyageRow } from "@/lib/supabase/types";

const IMO_PATTERN = /^\d{7}$/;

const COLUMNS: readonly ColumnDef<VoyageRow & Record<string, unknown>>[] = [
  {
    key: "departure_port_name",
    header: "Departure",
    sortable: true,
    className: "font-medium",
    render: (row) => (
      <span>
        {String(row.departure_port_name)}
        {row.departure_time && (
          <span className="block text-[10px] text-muted-foreground font-mono-technical">
            {new Date(String(row.departure_time)).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "arrival_port_name",
    header: "Arrival",
    sortable: true,
    className: "font-medium",
    render: (row) => (
      <span>
        {String(row.arrival_port_name)}
        {row.arrival_time && (
          <span className="block text-[10px] text-muted-foreground font-mono-technical">
            {new Date(String(row.arrival_time)).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "distance_nm",
    header: "Distance",
    sortable: true,
    className: "font-mono-technical tabular-nums w-20 text-right",
    render: (row) =>
      row.distance_nm != null ? `${row.distance_nm} nm` : "—",
  },
  {
    key: "source_is_mock",
    header: "Source",
    className: "w-16 text-center",
    render: (row) => (
      <Badge
        variant={row.source_is_mock ? "warning" : "success"}
        className="text-[9px]"
      >
        {row.source_is_mock ? "Mock" : "Live"}
      </Badge>
    ),
  },
  {
    key: "source_fetched_at",
    header: "Fetched",
    sortable: true,
    className: "text-muted-foreground w-28 tabular-nums",
    render: (row) =>
      new Date(String(row.source_fetched_at)).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
];

export default function VoyagesPage() {
  const router = useRouter();
  const [imoInput, setImoInput] = useState("");
  const [activeImo, setActiveImo] = useState<string | null>(null);

  const {
    voyages,
    total,
    totalPages,
    isLoading,
    error,
    page,
    setPage,
    refetch,
  } = useVoyages(activeImo, 20);

  const handleLookup = () => {
    const trimmed = imoInput.trim();
    if (IMO_PATTERN.test(trimmed)) {
      setActiveImo(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  const handleRowClick = (row: VoyageRow & Record<string, unknown>) => {
    router.push(ROUTES.voyageDetail(String(row.id)));
  };

  return (
    <div>
      <PageHeader
        label="Voyage History"
        title="Voyages"
        description="Voyage history by vessel IMO number"
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
          icon={<Navigation className="h-8 w-8" />}
          title="Select a vessel"
          description="Enter a 7-digit IMO number above to view voyage history."
        />
      ) : (
        <div className="rounded-lg border border-border">
          {isLoading ? (
            <LoadingTable columns={COLUMNS.length} rows={8} />
          ) : voyages.length === 0 ? (
            <EmptyState
              icon={<Navigation className="h-8 w-8" />}
              title="No voyages found"
              description={`No voyage history for IMO ${activeImo}.`}
            />
          ) : (
            <DataTable<VoyageRow & Record<string, unknown>>
              columns={COLUMNS}
              rows={voyages}
              onRowClick={handleRowClick}
              rowKey="id"
              emptyMessage="No voyages recorded."
            />
          )}
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={20}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
