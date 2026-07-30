import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 mb-4",
        className,
      )}
    >
      <div>
        <h1 className="font-serif text-lg font-light tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
