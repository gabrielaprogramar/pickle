import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createNotificationRepository } from "@/lib/supabase/repositories/notifications";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get("recipient_id");

    if (!recipientId) {
      return new Response(JSON.stringify({ error: "recipient_id query parameter is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repo = createNotificationRepository({ client: getSupabaseClient() });
    const count = await repo.unreadCount(recipientId);

    return apiSuccess({ unread_count: count });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
