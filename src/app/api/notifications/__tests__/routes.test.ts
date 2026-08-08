/**
 * routes.test.ts — Notifications API routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises GET /api/notifications, GET /api/notifications/unread-count,
 * PATCH /api/notifications/[id]/read and POST /api/notifications/mark-all-read
 * against the in-memory fake Supabase client. The routes read the cached
 * singleton via getSupabaseClient(), so the test injects a fake through
 * _setSupabaseClientForTest(). Each mutation test targets its own recipient so
 * the concurrently-run async tests never step on one another.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { _setSupabaseClientForTest } from "@/lib/supabase/client";
import { GET as getNotifications } from "../route";
import { GET as getUnreadCount } from "../unread-count/route";
import { POST as postMarkAllRead } from "../mark-all-read/route";
import { PATCH as patchRead } from "../[id]/read/route";

const DEFAULT = "default";
const READ_RECIPIENT = "recip-read";
const CLEAR_RECIPIENT = "recip-clear";

function makeRow(recipient: string, i: number): Record<string, unknown> {
  return {
    id: `${recipient}-ntf-${i}`,
    recipient_id: recipient,
    notification_type: i % 2 === 0 ? "certificate_expiring" : "review_task_created",
    severity: "INFO",
    vessel_id: null,
    organization_id: "org-poseidon",
    title: `Notification ${i}`,
    message: "Seeded test notification.",
    payload: null,
    is_read: i % 3 === 0,
    read_at: i % 3 === 0 ? "2026-08-01T00:00:00.000Z" : null,
    source_event: null,
    source_id: null,
    created_at: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
  };
}

function useClient() {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => makeRow(DEFAULT, i)),
    ...Array.from({ length: 5 }, (_, i) => makeRow(READ_RECIPIENT, i)),
    ...Array.from({ length: 5 }, (_, i) => makeRow(CLEAR_RECIPIENT, i)),
  ];
  const fake = createFakeSupabaseClient({ tables: { notifications: rows } });
  _setSupabaseClientForTest(fake as never);
}

function listUrl(recipient: string, extra = ""): NextRequest {
  return new NextRequest(`https://example.com/api/notifications?recipient_id=${recipient}${extra}`, {
    method: "GET",
  });
}

async function unreadCount(recipient: string): Promise<number> {
  const response = await getUnreadCount(
    new NextRequest(`https://example.com/api/notifications/unread-count?recipient_id=${recipient}`, {
      method: "GET",
    }),
  );
  const body = await response.json();
  return body.data.unread_count;
}

describe("GET /api/notifications", () => {
  it("lists notifications newest-first with the total unread count", async () => {
    useClient();
    const response = await getNotifications(listUrl(DEFAULT));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const notifications = body.data.notifications;
    expect(notifications.length).toBe(5);
    expect(body.data.unread_count).toBe(3);
    const newest = new Date(notifications[0].created_at).getTime();
    const oldest = new Date(notifications[notifications.length - 1].created_at).getTime();
    expect(newest >= oldest).toBe(true);
  });

  it("returns 400 when recipient_id is missing", async () => {
    useClient();
    const response = await getNotifications(
      new NextRequest("https://example.com/api/notifications", { method: "GET" }),
    );
    expect(response.status).toBe(400);
  });

  it("filters by notification type", async () => {
    useClient();
    const response = await getNotifications(listUrl(DEFAULT, "&type=certificate_expiring"));
    const body = await response.json();
    const notifications = body.data.notifications;
    expect(notifications.length).toBe(3);
    expect(
      notifications.every((n: { notification_type: string }) => n.notification_type === "certificate_expiring"),
    ).toBe(true);
  });

  it("filters to unread notifications only", async () => {
    useClient();
    const response = await getNotifications(listUrl(DEFAULT, "&unread_only=true"));
    const body = await response.json();
    const notifications = body.data.notifications;
    expect(notifications.length).toBe(3);
    expect(notifications.every((n: { is_read: boolean }) => !n.is_read)).toBe(true);
  });

  it("honors the limit query parameter", async () => {
    useClient();
    const response = await getNotifications(listUrl(DEFAULT, "&limit=2"));
    const body = await response.json();
    expect(body.data.notifications.length).toBe(2);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("returns the seeded unread total", async () => {
    useClient();
    expect(await unreadCount(DEFAULT)).toBe(3);
  });
});

describe("PATCH /api/notifications/[id]/read", () => {
  it("marks a notification read and decrements the unread count", async () => {
    useClient();
    const response = await patchRead(
      new NextRequest(`https://example.com/api/notifications/${READ_RECIPIENT}-ntf-2/read`, { method: "PATCH" }),
      { params: Promise.resolve({ id: `${READ_RECIPIENT}-ntf-2` }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.notification.is_read).toBe(true);
    expect(await unreadCount(READ_RECIPIENT)).toBe(2);
  });

  it("returns 404 for an unknown notification", async () => {
    useClient();
    const response = await patchRead(
      new NextRequest("https://example.com/api/notifications/ntf-missing/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "ntf-missing" }) },
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOTIFICATION_NOT_FOUND");
  });
});

describe("POST /api/notifications/mark-all-read", () => {
  it("clears the unread count for the recipient", async () => {
    useClient();
    const response = await postMarkAllRead(
      new NextRequest("https://example.com/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: CLEAR_RECIPIENT }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.marked_read).toBe(3);
    expect(await unreadCount(CLEAR_RECIPIENT)).toBe(0);
  });

  it("returns 400 when recipient_id is missing", async () => {
    useClient();
    const response = await postMarkAllRead(
      new NextRequest("https://example.com/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(400);
  });
});

run();
