import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { createAssistantConversationRepository, createAssistantMessageRepository, createAssistantToolCallRepository } from "@/lib/supabase";
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
import { createEvaluationHarness } from "@/lib/assistant/evaluation";

const EvaluateSchema = z.object({
  test_name: z.string().min(1),
  assistant_type: z.string().optional(),
  query: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    const parsed = EvaluateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid evaluation input", 400, zodIssuesToDetails(parsed.error.issues));
    }

    const client = getSupabaseClient();
    const conversationRepo = createAssistantConversationRepository({ client });
    const messageRepo = createAssistantMessageRepository({ client });
    const toolCallRepo = createAssistantToolCallRepository({ client });

    const mockKnowledgeBase = createMockKnowledgeBase();
    const llmProvider = createMockLlmProvider();
    const regulatorySearch = createRegulatorySearchService({ mockKnowledgeBase });
    const citationService = createCitationService();
    const mockToolService = createMockStructuredToolService();
    const toolGateway = createToolGateway({ toolService: mockToolService });
    const safetyLayer = createSafetyLayer();
    const router = createRouter({ useMock: true });
    const conversationService = createConversationService({ conversationRepo, messageRepo, toolCallRepo });
    const evaluationHarness = createEvaluationHarness();

    const assistantService = createAssistantService({
      router,
      safetyLayer,
      toolGateway,
      conversationService,
      llmProvider,
      regulatorySearch,
      citationService,
      evaluationHarness,
    });

    // Create a temporary conversation for the evaluation
    const conversation = await conversationRepo.insert({
      user_id: "eval-user",
      title: `Evaluation: ${parsed.data.test_name}`,
    });

    const response = await assistantService.processQuery(conversation.id, "eval-user", parsed.data.query);

    const evaluationResult = await evaluationHarness.runEvaluation(
      parsed.data.test_name,
      parsed.data.assistant_type ?? "assistant",
      parsed.data.query,
      response.content,
      response.citations,
      response.toolCalls,
      0,
    );

    // Clean up the temporary conversation
    await conversationRepo.archive(conversation.id).catch(() => {});

    return apiCreated({ evaluation: evaluationResult });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
