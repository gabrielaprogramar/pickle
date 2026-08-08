"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCheck, ChevronRight } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface NotificationItem {
  readonly id: string;
  readonly notification_type: string;
  readonly severity: string;
  readonly title: string;
  readonly message: string;
  readonly is_read: boolean;
  readonly created_at: string;
  readonly vessel_id: string | null;
  readonly payload?: Record<string, unknown> | null;
}

interface NotificationPanelProps {
  readonly recipientId?: string;
  readonly onClose?: () => void;
  readonly onChanged?: () => void;
}

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "outline" | "secondary"> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "outline",
  INFO: "secondary",
};

const SEVERITY_ACCENT: Record<string, string> = {
  CRITICAL: "border-destructive",
  HIGH: "border-warning",
  MEDIUM: "border-border",
  INFO: "border-primary",
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function notificationHref(n: NotificationItem): string | null {
  const type = n.notification_type;
  const imo = typeof n.payload?.imo === "string" ? n.payload.imo : null;
  const vesselLink = imo ? ROUTES.vesselDetail(imo) : null;

  if (type.startsWith("sox_") || type.startsWith("certificate_")) return vesselLink ?? ROUTES.compliance;
  if (type === "review_task_created") return ROUTES.review;
  if (
    type.startsWith("fueleu_") ||
    type.startsWith("ets_") ||
    type.startsWith("mrv_") ||
    type === "iscc_certificate_missing"
  ) {
    return ROUTES.compliance;
  }
  if (type.startsWith("bdn_") || type === "fuel_delivery") return ROUTES.documents;
  if (type.startsWith("noon_")) return ROUTES.noon;
  if (type === "zone_entry") return ROUTES.ais;
  return null;
}

export function NotificationPanel({ recipientId = "default", onClose, onChanged }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<ReadonlyArray<NotificationItem>>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = () => {
    setLoading(true);
    fetch(`/api/notifications?recipient_id=${encodeURIComponent(recipientId)}&limit=50`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.notifications) {
          setNotifications(json.data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, [recipientId]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    onChanged?.();
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: recipientId }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    onChanged?.();
  };

  const unread = notifications.filter((n) => !n.is_read).length;
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Notifications
          </h3>
          {unread > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-px font-mono text-[10px] font-semibold text-primary-foreground">
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[min(22rem,60vh)] overflow-y-auto">
        {loading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Alerts will appear here.</p>
          </div>
        )}
        {!loading &&
          sorted.map((n) => {
            const href = notificationHref(n);
            const accent = SEVERITY_ACCENT[n.severity] ?? "border-border";
            const content = (
              <>
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full self-center",
                    n.is_read ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        n.is_read ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {n.message}
                  </p>
                  <div className="mt-1.5">
                    <Badge variant={SEVERITY_VARIANT[n.severity] ?? "outline"} className="px-1.5 py-0 text-[9px] font-medium">
                      {n.severity}
                    </Badge>
                  </div>
                </div>
              </>
            );

            if (!href) {
              return (
                <div key={n.id} className={cn("flex items-start gap-2 border-b border-l-2 border-border/40 px-3 py-2.5", accent)}>
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={n.id}
                href={href}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id);
                  onClose?.();
                }}
                className={cn(
                  "flex items-start gap-2 border-b border-l-2 border-border/40 px-3 py-2.5 transition-colors hover:bg-accent/60",
                  accent,
                )}
              >
                {content}
              </Link>
            );
          })}
      </div>

      <div className="border-t border-border px-3 py-2">
        <Link
          href={ROUTES.settingsNotifications}
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Manage notification settings
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
