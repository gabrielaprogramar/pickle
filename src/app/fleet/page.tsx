"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Ship, LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { LoadingTable } from "@/components/loading-table";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { PaginationControls } from "@/components/pagination-controls";
import { useVessels } from "@/hooks/use-vessels";
import { useDebounce } from "@/hooks/use-debounce";
import { useSettingsAppearance } from "@/components/settings/settings-provider";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/constants/routes";
import type { VesselRow } from "@/lib/supabase/types";

const COLUMNS: readonly ColumnDef<VesselRow & Record<string, unknown>>[] = [
  {
    key: "imo",
    header: "IMO",
    sortable: true,
    className: "font-mono-technical tabular-nums w-24",
  },
  {
    key: "name",
    header: "Name",
    sortable: true,
    className: "font-medium",
  },
  {
    key: "mmsi",
    header: "MMSI",
    className: "font-mono-technical tabular-nums text-muted-foreground w-28",
  },
  {
    key: "ship_id",
    header: "Ship ID",
    className: "font-mono-technical tabular-nums text-muted-foreground w-20",
  },
  {
    key: "updated_at",
    header: "Updated",
    sortable: true,
    className: "text-muted-foreground w-32 tabular-nums",
    render: (row) =>
      row.updated_at
        ? new Date(String(row.updated_at)).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
  },
];

export default function FleetPage() {
  const router = useRouter();
  const { appearance } = useSettingsAppearance();
  const {
    vessels,
    total,
    totalPages,
    isLoading,
    error,
    page,
    setPage,
    refetch,
  } = useVessels(20);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortKey, setSortKey] = useState<string>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [localView, setLocalView] = useState<"grid" | "list" | null>(null);
  const view: "grid" | "list" = localView ?? appearance?.gridView ?? "list";

  const filteredVessels = useMemo(() => {
    if (!debouncedSearch) return vessels;
    const q = debouncedSearch.toLowerCase();
    return vessels.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.imo.toLowerCase().includes(q) ||
        (v.mmsi && v.mmsi.toLowerCase().includes(q)),
    );
  }, [vessels, debouncedSearch]);

  const sortedVessels = useMemo(() => {
    const sorted = [...filteredVessels];
    sorted.sort((a, b) => {
      const aVal = String(a[sortKey as keyof VesselRow] ?? "");
      const bVal = String(b[sortKey as keyof VesselRow] ?? "");
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredVessels, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleRowClick = (row: VesselRow & Record<string, unknown>) => {
    router.push(ROUTES.vesselDetail(String(row.imo)));
  };

  return (
    <div>
      <PageHeader
        label="Fleet Registry"
        title="Fleet"
        description={`${total} vessel${total !== 1 ? "s" : ""} registered`}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error.message}
            code={error.code}
            onRetry={refetch}
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Search by name, IMO, or MMSI…"
          className="w-72"
          isLoading={isLoading}
        />
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setLocalView("list")}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors duration-200",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setLocalView("grid")}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors duration-200",
              view === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        {isLoading ? (
          <LoadingTable columns={COLUMNS.length} rows={8} />
        ) : sortedVessels.length === 0 ? (
          <EmptyState
            icon={<Ship className="h-8 w-8" />}
            title="No vessels found"
            description={
              debouncedSearch
                ? `No vessels match "${debouncedSearch}". Try a different search term.`
                : "No vessels have been registered yet. Ingest vessel data via the API."
            }
          />
        ) : view === "grid" ? (
          <VesselGrid rows={sortedVessels} onOpen={handleRowClick} />
        ) : (
          <DataTable<VesselRow & Record<string, unknown>>
            columns={COLUMNS}
            rows={sortedVessels}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={handleRowClick}
            rowKey="id"
            emptyMessage="No vessels match your criteria."
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
    </div>
  );
}

function formatUpdated(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VesselGrid({
  rows,
  onOpen,
}: {
  readonly rows: readonly VesselRow[];
  readonly onOpen: (row: VesselRow & Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((vessel) => (
        <div
          key={vessel.id}
          onClick={() => onOpen(vessel as VesselRow & Record<string, unknown>)}
          className="interactive cursor-pointer rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium">{vessel.name}</h3>
            <span className="shrink-0 font-mono-technical text-[10px] text-muted-foreground tabular-nums">
              {vessel.imo}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
            <dt className="uppercase tracking-[0.1em] text-muted-foreground">MMSI</dt>
            <dd className="text-right tabular-nums">{vessel.mmsi ?? "—"}</dd>
            <dt className="uppercase tracking-[0.1em] text-muted-foreground">Ship ID</dt>
            <dd className="text-right tabular-nums">{vessel.ship_id ?? "—"}</dd>
            <dt className="uppercase tracking-[0.1em] text-muted-foreground">Updated</dt>
            <dd className="text-right tabular-nums">{formatUpdated(vessel.updated_at)}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
