import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createAssistantConversationRepository,
  createAssistantMessageRepository,
  createAssistantToolCallRepository,
} from "@/lib/supabase";
import { apiSuccess, apiCreated, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";

import { createMockLlmProvider } from "@/lib/assistant/llm-provider";
import { createMockKnowledgeBase } from "@/lib/assistant/mock-knowledge";
import { createRegulatorySearchService } from "@/lib/assistant/regulatory-search";
import { createCitationService } from "@/lib/assistant/citations";
import { createMockStructuredToolService } from "@/lib/assistant/structured-tools";
import { createToolGateway } from "@/lib/assistant/tool-gateway";
import { createSafetyLayer } from "@/lib/assistant/safety";
import { createRouter } from "@/lib/assistant/router";
import { createAssistantService } from "@/lib/assistant/assistant-service";
import { createConversationService } from "@/lib/assistant/conversation-service";

const SendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
});

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
    const { messageRepo } = await getRepos();

    const messages = await messageRepo.listByConversation(id);
    return apiSuccess({ messages });
  } catch (err) {
    return mapErrorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid message data", 400, zodIssuesToDetails(parsed.error.issues));
    }

    const { conversationRepo, messageRepo, toolCallRepo } = await getRepos();

    const conversation = await conversationRepo.findById(id);
    if (!conversation) {
      return apiError("NOT_FOUND", "Conversation not found", 404);
    }

    const userId = conversation.user_id;

    // Build mock-by-default assistant services
    const mockKnowledgeBase = createMockKnowledgeBase();
    const llmProvider = createMockLlmProvider();
    const regulatorySearch = createRegulatorySearchService({ mockKnowledgeBase });
    const citationService = createCitationService();
    const mockToolService = createMockStructuredToolService();
    const toolGateway = createToolGateway({ toolService: mockToolService });
    const safetyLayer = createSafetyLayer();
    const router = createRouter({ useMock: true });
    const conversationService = createConversationService({ conversationRepo, messageRepo, toolCallRepo });

    const assistantService = createAssistantService({
      router,
      safetyLayer,
      toolGateway,
      conversationService,
      llmProvider,
      regulatorySearch,
      citationService,
    });

    const response = await assistantService.processQuery(id, userId, parsed.data.content);

    // The service already saves user and assistant messages; fetch the last two messages
    const messages = await messageRepo.listByConversation(id);
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const userMessage = sorted[sorted.length - 2] ?? null;
    const assistantMessage = sorted[sorted.length - 1] ?? null;

    return apiCreated({ response, userMessage, assistantMessage });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
