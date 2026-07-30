import { NextRequest } from "next/server";
import { getSupabaseClient, AssistantConversationInsertSchema } from "@/lib/supabase";
import {
  createAssistantConversationRepository,
  createAssistantMessageRepository,
  createAssistantToolCallRepository,
} from "@/lib/supabase";
import { apiSuccess, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";

async function getRepos() {
  const client = getSupabaseClient();
  return {
    conversationRepo: createAssistantConversationRepository({ client }),
    messageRepo: createAssistantMessageRepository({ client }),
    toolCallRepo: createAssistantToolCallRepository({ client }),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { conversationRepo, messageRepo } = await getRepos();

    const conversation = await conversationRepo.findById(id);
    if (!conversation) {
      return apiError("NOT_FOUND", "Conversation not found", 404);
    }

    const messages = await messageRepo.listByConversation(id);
    return apiSuccess({ conversation, messages });
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    const { conversationRepo } = await getRepos();

    const existing = await conversationRepo.findById(id);
    if (!existing) {
      return apiError("NOT_FOUND", "Conversation not found", 404);
    }

    const changes: Record<string, unknown> = {};
    if (body.title !== undefined) changes.title = body.title;
    if (body.status !== undefined) changes.status = body.status;

    const conversation = await conversationRepo.update(id, changes);
    return apiSuccess({ conversation });
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { conversationRepo } = await getRepos();

    const existing = await conversationRepo.findById(id);
    if (!existing) {
      return apiError("NOT_FOUND", "Conversation not found", 404);
    }

    const conversation = await conversationRepo.archive(id);
    return apiSuccess({ conversation });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
