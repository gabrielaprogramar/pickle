import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createNotificationRepository } from "@/lib/supabase/repositories/notifications";
import { apiSuccess, apiError, mapErrorResponse } from "@/app/api/_lib/http";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = createNotificationRepository({ client: getSupabaseClient() });

    const existing = await repo.findById(id);
    if (!existing) {
      return apiError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
    }

    const updated = await repo.markRead(id);
    return apiSuccess({ notification: updated });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
