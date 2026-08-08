"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationPanel } from "@/components/notifications/notification-panel";

interface NotificationBellProps {
  readonly recipientId?: string;
  readonly onOpen?: () => void;
}

export function NotificationBell({ recipientId = "default", onOpen }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const refreshCount = useCallback(() => {
    fetch(`/api/notifications/unread-count?recipient_id=${encodeURIComponent(recipientId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && typeof json.data?.unread_count === "number") {
          setUnreadCount(json.data.unread_count);
        }
      })
      .catch(() => {});
  }, [recipientId]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      onOpen?.();
      refreshCount();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 py-px font-mono text-[9px] font-semibold leading-none text-primary-foreground ring-2 ring-card">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <NotificationPanel recipientId={recipientId} onClose={() => setIsOpen(false)} onChanged={refreshCount} />
      )}
    </div>
  );
}
