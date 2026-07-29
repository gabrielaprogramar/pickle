"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

export interface ColumnDef<T> {
  readonly key: string;
  readonly header: string;
  readonly render?: (row: T) => React.ReactNode;
  readonly headerClassName?: string;
  readonly className?: string;
  readonly sortable?: boolean;
}

export interface DataTableProps<T> {
  readonly columns: readonly ColumnDef<T>[];
  readonly rows: readonly T[];
  readonly sortKey?: string;
  readonly sortDir?: "asc" | "desc";
  readonly onSort?: (key: string) => void;
  readonly onRowClick?: (row: T) => void;
  readonly rowKey: keyof T;
  readonly emptyMessage?: string;
}

function SortIndicator({
  columnKey,
  sortKey,
  sortDir,
}: {
  readonly columnKey: string;
  readonly sortKey?: string;
  readonly sortDir?: "asc" | "desc";
}) {
  if (columnKey !== sortKey) return null;
  return (
    <span className="ml-1 text-primary text-[10px]">
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  rowKey,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                col.headerClassName,
                col.sortable && onSort && "cursor-pointer select-none hover:text-foreground",
              )}
              onClick={() => col.sortable && onSort?.(col.key)}
            >
              <span className="flex items-center">
                {col.header}
                {col.sortable && (
                  <SortIndicator
                    columnKey={col.key}
                    sortKey={sortKey}
                    sortDir={sortDir}
                  />
                )}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={String(row[rowKey])}
            className={cn(onRowClick && "cursor-pointer")}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className={col.className}>
                {col.render
                  ? col.render(row)
                  : (String(row[col.key] ?? ""))}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
