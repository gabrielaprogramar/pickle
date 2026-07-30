import type { Router } from "./router";
import type { SafetyLayer } from "./safety";
import type { ToolGateway } from "./tool-gateway";
import type { ConversationService } from "./conversation-service";
import type { LlmProvider } from "./llm-provider";
import type { RegulatorySearchService } from "./regulatory-search";
import type { CitationService } from "./citations";
import type { EvaluationHarness } from "./evaluation";
import type { AssistantResponse, IntentClassification, ToolCallRecord } from "./types";
import type { AssistantMessageInsert } from "@/lib/supabase";

export interface AssistantServiceOptions {
  readonly router: Router;
  readonly safetyLayer: SafetyLayer;
  readonly toolGateway: ToolGateway;
  readonly conversationService: ConversationService;
  readonly llmProvider: LlmProvider;
  readonly regulatorySearch: RegulatorySearchService;
  readonly citationService: CitationService;
  readonly evaluationHarness?: EvaluationHarness;
}

export interface AssistantService {
  processQuery(conversationId: string, userId: string, query: string): Promise<AssistantResponse>;
  classifyIntent(query: string): Promise<IntentClassification>;
}

export function createAssistantService(opts: AssistantServiceOptions): AssistantService {
  async function processQuery(conversationId: string, userId: string, query: string): Promise<AssistantResponse> {
    const start = Date.now();

    const routerOutput = await opts.router.classify({ query });
    const conversationContext = await opts.conversationService.getConversationContext(conversationId);

    await opts.conversationService.addMessage(conversationId, {
      conversation_id: conversationId,
      role: "user",
      content: query,
      metadata: { intent: routerOutput.intent },
    });

    let responseContent: string;
    const toolCalls: ToolCallRecord[] = [];
    const usedTools: Array<{ name: string; result: unknown }> = [];

    if (routerOutput.intent === "REGULATORY") {
      const searchResults = await opts.regulatorySearch.search({ question: query });
      const citations = searchResults.chunks.map((c) =>
        opts.citationService.buildCitation(
          {
            id: c.id,
            document_id: c.document_id,
            chunk_index: 0,
            content: c.content,
            article_section: c.article_section,
            heading: c.heading,
            embedding: null,
            token_count: null,
            metadata: {},
            created_at: "",
          },
          {
            id: c.document_id,
            source: "other" as any,
            regulation: c.regulation as any,
            title: c.source_title,
            article_section: c.article_section,
            effective_date: null,
            version: c.version,
            content: c.content,
            metadata: {},
            created_at: "",
            updated_at: "",
          },
          c.relevance_score,
        ),
      );

      const citationText = opts.citationService.formatCitationsAsText(citations);
      const llmResponse = await opts.llmProvider.generate({
        messages: [
          { role: "system", content: "You are a regulatory compliance assistant. Answer based on the provided regulatory excerpts." },
          { role: "user", content: query },
          { role: "assistant", content: `Relevant regulatory information:\n${citationText}` },
        ],
      });
      responseContent = llmResponse.content;
    } else {
      const toolDefs = opts.toolGateway.getAvailableTools();
      for (const def of toolDefs) {
        const toolResult = await opts.toolGateway.execute(
          { toolName: def.name, input: { vesselId: "", year: new Date().getFullYear() }, conversationId },
          userId,
        );
        if (toolResult.success && toolResult.data) {
          toolCalls.push({
            id: `inline-${start}-${def.name}`,
            toolName: def.name,
            input: {},
            output: toolResult.data,
            success: true,
            error: null,
            latencyMs: toolResult.latencyMs,
            timestamp: new Date().toISOString(),
          });
          usedTools.push({ name: def.name, result: toolResult.data });
        }
      }

      const llmResponse = await opts.llmProvider.generate({
        messages: [
          { role: "system", content: "You are a maritime compliance assistant." },
          { role: "user", content: query },
        ],
      });
      responseContent = llmResponse.content;
    }

    const safetyCheck = opts.safetyLayer.validateContent(responseContent);
    const finalResponse = opts.safetyLayer.buildFinalResponse(responseContent, [], toolCalls);

    await opts.conversationService.addMessage(conversationId, {
      conversation_id: conversationId,
      role: "assistant",
      content: finalResponse.content,
      citations: finalResponse.citations.map((c) => ({ ...c })),
      metadata: { safetyCheck: { ...safetyCheck } },
    });

    for (const tc of toolCalls) {
      await opts.conversationService.recordToolCall({
        conversation_id: conversationId,
        tool_name: tc.toolName,
        tool_input: tc.input,
        tool_output: tc.output as Record<string, unknown> ?? null,
        success: tc.success,
        error_message: tc.error,
        latency_ms: tc.latencyMs,
      });
    }

    if (opts.evaluationHarness) {
      const latency = Date.now() - start;
      await opts.evaluationHarness.runEvaluation(
        "process-query",
        "assistant",
        query,
        responseContent,
        finalResponse.citations,
        toolCalls,
        latency,
      );
    }

    return finalResponse;
  }

  async function classifyIntent(query: string): Promise<IntentClassification> {
    const output = await opts.router.classify({ query });
    return {
      intent: output.intent,
      confidence: output.confidence,
      subcategories: [],
    };
  }

  return {
    processQuery,
    classifyIntent,
  };
}
