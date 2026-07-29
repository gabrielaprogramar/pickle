import { Skeleton } from "@/components/ui/skeleton";

interface LoadingTableProps {
  readonly columns?: number;
  readonly rows?: number;
}

export function LoadingTable({ columns = 5, rows = 8 }: LoadingTableProps) {
  return (
    <div className="space-y-0">
      <div className="flex gap-3 px-3 py-2 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 w-16 flex-shrink-0" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={`r-${ri}`}
          className="flex gap-3 px-3 py-3 border-b border-border/50"
        >
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton
              key={`c-${ri}-${ci}`}
              className="h-3 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
