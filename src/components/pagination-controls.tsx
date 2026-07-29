"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PaginationControlsProps {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly isLoading?: boolean;
  readonly className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isLoading,
  className,
}: PaginationControlsProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border px-3 py-2",
        className,
      )}
    >
      <p className="text-[11px] text-muted-foreground">
        {total === 0
          ? "0 results"
          : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="h-7 px-2 text-xs"
        >
          <ChevronLeft className="h-3 w-3" />
          Prev
        </Button>
        <span className="px-2 text-[11px] text-muted-foreground tabular-nums">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="h-7 px-2 text-xs"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
