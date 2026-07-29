"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Ship } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { LoadingTable } from "@/components/loading-table";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { PaginationControls } from "@/components/pagination-controls";
import { useVessels } from "@/hooks/use-vessels";
import { useDebounce } from "@/hooks/use-debounce";
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
