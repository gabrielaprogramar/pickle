import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createNotificationRepository } from "@/lib/supabase/repositories/notifications";
import { apiSuccess, parseQueryNumber, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseQueryNumber(searchParams, "limit") ?? 50;
    const offset = parseQueryNumber(searchParams, "offset") ?? 0;
    const recipientId = searchParams.get("recipient_id");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const type = searchParams.get("type");

    if (!recipientId) {
      return new Response(JSON.stringify({ error: "recipient_id query parameter is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repo = createNotificationRepository({ client: getSupabaseClient() });

    let notifications;
    if (unreadOnly) {
      notifications = await repo.listUnread(recipientId, limit, offset);
    } else if (type) {
      notifications = await repo.listByType(recipientId, type, limit, offset);
    } else {
      notifications = await repo.listByRecipient(recipientId, limit, offset);
    }

    const unreadCount = await repo.unreadCount(recipientId);

    return apiSuccess({ notifications, unread_count: unreadCount });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
