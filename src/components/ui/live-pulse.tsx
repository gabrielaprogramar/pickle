import { cn } from "@/lib/utils/cn";

export type LiveTone = "teal" | "gold" | "red" | "muted";

const TONE_DOT: Record<LiveTone, string> = {
  teal: "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]",
  gold: "bg-warning shadow-[0_0_6px_hsl(var(--warning)/0.55)]",
  red: "bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.65)] animate-[live-blink_2s_ease-in-out_infinite]",
  muted: "bg-muted-foreground/50",
};

interface LivePulseProps {
  readonly tone?: LiveTone;
  readonly label: string;
  readonly className?: string;
}

export function LivePulse({ tone = "teal", label, className }: LivePulseProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full", TONE_DOT[tone])}
        aria-hidden="true"
      />
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}
