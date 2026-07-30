"use client";

import { useEffect, useState } from "react";

interface NotificationItem {
  readonly id: string;
  readonly notification_type: string;
  readonly severity: string;
  readonly title: string;
  readonly message: string;
  readonly is_read: boolean;
  readonly created_at: string;
  readonly vessel_id: string | null;
}

interface NotificationPanelProps {
  readonly recipientId?: string;
  readonly onClose?: () => void;
}

export function NotificationPanel({ recipientId = "default", onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<ReadonlyArray<NotificationItem>>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = () => {
    setLoading(true);
    fetch(`/api/notifications?recipient_id=${encodeURIComponent(recipientId)}&limit=20`)
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
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const severityColor = (s: string): string => {
    switch (s) {
      case "CRITICAL": return "border-l-red-500 bg-red-50";
      case "HIGH": return "border-l-orange-500 bg-orange-50";
      case "MEDIUM": return "border-l-yellow-500 bg-yellow-50";
      default: return "border-l-blue-500 bg-blue-50";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto w-80">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">Notifications</h3>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-blue-500 hover:underline"
        >
          Mark all read
        </button>
      </div>

      {loading && (
        <div className="p-4 text-sm text-gray-500">Loading…</div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="p-4 text-sm text-gray-500">No notifications</div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="divide-y divide-gray-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 border-l-4 ${severityColor(n.severity)} ${n.is_read ? "opacity-70" : ""}`}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                {!n.is_read && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
                <span className={`text-xs font-medium ${
                  n.severity === "CRITICAL" ? "text-red-600" :
                  n.severity === "HIGH" ? "text-orange-600" :
                  n.severity === "MEDIUM" ? "text-yellow-600" :
                  "text-blue-600"
                }`}>
                  {n.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
