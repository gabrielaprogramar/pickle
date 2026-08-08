"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatValue } from "@/components/ui/stat-value";
import { LivePulse } from "@/components/ui/live-pulse";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { computeDeadlines } from "@/lib/eu-ets/deadlines";

interface CountdownTarget {
  readonly label: string;
  readonly date: Date;
}

function buildTargets(now: Date): CountdownTarget[] {
  const targets: CountdownTarget[] = [];
  for (let year = now.getFullYear() - 1; year <= now.getFullYear() + 1; year++) {
    const deadlines = computeDeadlines(year, now);
    for (const info of [deadlines.surrender, deadlines.mrvReporting]) {
      if (!info) continue;
      const date = new Date(`${info.deadline_date}T00:00:00Z`);
      if (date.getTime() > now.getTime()) {
        targets.push({ label: info.label, date });
      }
    }
  }
  return targets.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function windowTone(days: number): "red" | "gold" | "teal" {
  if (days <= 30) return "red";
  if (days <= 90) return "gold";
  return "teal";
}

function windowLabel(days: number): string {
  if (days <= 7) return "Urgent";
  if (days <= 30) return "Imminent";
  if (days <= 90) return "Approaching";
  return "On Track";
}

/**
 * EnforcementCountdown — a countdown to the next upcoming EU ETS /
 * MRV deadline, derived from the shared deadline engine
 * (computeDeadlines). Live-updates every minute; tone follows the
 * urgency ladder (teal → gold → red) without animating the page.
 */
export function EnforcementCountdown({ className }: { readonly className?: string }) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const target = useMemo(() => buildTargets(now)[0], [now]);

  if (!mounted) {
    return (
      <Card className={className}>
        <CardHeader className="pb-1">
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!target) return null;

  const diffMs = target.date.getTime() - now.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const tone = windowTone(days);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <ShieldCheck className={cn("h-3.5 w-3.5", tone === "red" ? "text-destructive" : tone === "gold" ? "text-warning" : "text-primary")} />
          Next Enforcement Window
        </CardTitle>
        <LivePulse tone={tone} label={target.label} />
      </CardHeader>
      <CardContent className="flex flex-wrap items-end justify-between gap-4">
        <div
          className={cn(
            "flex items-baseline gap-4 border-l-2 pl-4",
            tone === "red" ? "border-l-destructive" : "border-l-primary/30",
          )}
        >
          {[
            { n: days, label: "Days" },
            { n: hours, label: "Hours" },
            { n: minutes, label: "Min" },
          ].map((unit, i) => (
            <div key={unit.label}>
              <StatValue
                size="lg"
                tone={i === 0 ? tone : "muted"}
                className={cn(tone === "red" && i === 0 && "text-destructive")}
              >
                {pad(unit.n)}
              </StatValue>
              <p className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                {unit.label}
              </p>
            </div>
          ))}
        </div>
        <div className="text-right">
          <p
            className={cn(
              "font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
              tone === "red" ? "text-destructive" : tone === "gold" ? "text-warning" : "text-primary",
            )}
          >
            {windowLabel(days)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {target.date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
