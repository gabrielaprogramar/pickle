import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createAssistantToolCallRepository } from "@/lib/supabase";
import { apiSuccess, apiError, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const client = getSupabaseClient();
    const toolCallRepo = createAssistantToolCallRepository({ client });

    const toolCalls = await toolCallRepo.listByConversation(id);
    return apiSuccess({ toolCalls });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
