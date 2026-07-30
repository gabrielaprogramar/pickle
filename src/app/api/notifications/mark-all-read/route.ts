import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createNotificationRepository } from "@/lib/supabase/repositories/notifications";
import { apiSuccess, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<{ recipient_id: string }>(request);

    if (!body || !body.recipient_id) {
      return apiError("VALIDATION_ERROR", "recipient_id is required", 400);
    }

    const repo = createNotificationRepository({ client: getSupabaseClient() });
    const count = await repo.markAllRead(body.recipient_id);

    return apiSuccess({ marked_read: count });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
