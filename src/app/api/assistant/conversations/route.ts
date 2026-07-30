import { NextRequest } from "next/server";
import { getSupabaseClient, AssistantConversationInsertSchema } from "@/lib/supabase";
import {
  createAssistantConversationRepository,
  createAssistantMessageRepository,
  createAssistantToolCallRepository,
} from "@/lib/supabase";
import { apiSuccess, apiCreated, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    if (!userId) {
      return apiError("VALIDATION_ERROR", "user_id query parameter is required", 400);
    }

    const client = getSupabaseClient();
    const conversationRepo = createAssistantConversationRepository({ client });

    const conversations = await conversationRepo.listActiveByUser(userId);
    return apiSuccess({ conversations });
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    const parsed = AssistantConversationInsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid conversation data", 400, zodIssuesToDetails(parsed.error.issues));
    }

    const client = getSupabaseClient();
    const conversationRepo = createAssistantConversationRepository({ client });

    const conversation = await conversationRepo.insert(parsed.data);
    return apiCreated({ conversation });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
