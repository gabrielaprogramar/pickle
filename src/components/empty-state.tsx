import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  readonly icon?: React.ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly kicker?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  kicker,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
    >
      {kicker && (
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="block h-px w-5 bg-muted-foreground/30" aria-hidden="true" />
          {kicker}
          <span className="block h-px w-5 bg-muted-foreground/30" aria-hidden="true" />
        </p>
      )}
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground/50 [background-image:linear-gradient(hsl(var(--primary)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.05)_1px,transparent_1px)] [background-size:8px_8px]">
          {icon}
        </div>
      )}
      <p className="font-serif text-base font-light tracking-tight text-foreground/90">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
