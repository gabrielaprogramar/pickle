import { cn } from "@/lib/utils/cn";

type StatTone = "default" | "teal" | "gold" | "red" | "muted";
type StatSize = "sm" | "md" | "lg";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  teal: "text-primary",
  gold: "text-warning",
  red: "text-destructive",
  muted: "text-muted-foreground",
};

const SIZE_TEXT: Record<StatSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[28px] leading-[1.1]",
};

interface StatValueProps {
  readonly children: React.ReactNode;
  readonly tone?: StatTone;
  readonly size?: StatSize;
  readonly className?: string;
}

export function StatValue({
  children,
  tone = "default",
  size = "md",
  className,
}: StatValueProps) {
  return (
    <span
      className={cn(
        "font-serif font-light leading-none tracking-tight tabular-nums",
        SIZE_TEXT[size],
        TONE_TEXT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
