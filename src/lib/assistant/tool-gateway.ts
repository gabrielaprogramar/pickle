import type { ToolDefinition, ToolCallRequest, ToolCallResult, ToolCallRecord, ToolPermission } from "./types";
import type { AssistantToolCallRepository } from "@/lib/supabase";
import type { StructuredToolService } from "./structured-tools";

export interface ToolGatewayOptions {
  readonly toolService: StructuredToolService;
  readonly toolCallRepo?: AssistantToolCallRepository;
  readonly requireConfirmationForWrite?: boolean;
}

export interface ToolGateway {
  getAvailableTools(): ReadonlyArray<ToolDefinition>;
  getTool(name: string): ToolDefinition | undefined;
  execute(request: ToolCallRequest, userId: string): Promise<ToolCallResult>;
  getHistory(conversationId: string): Promise<ReadonlyArray<ToolCallRecord>>;
}

export function createToolGateway(opts: ToolGatewayOptions): ToolGateway {
  return {
    getAvailableTools(): ReadonlyArray<ToolDefinition> {
      return opts.toolService.getToolDefinitions();
    },

    getTool(name: string): ToolDefinition | undefined {
      return opts.toolService.getToolDefinitions().find((t) => t.name === name);
    },

    async execute(request: ToolCallRequest, userId: string): Promise<ToolCallResult> {
      const def = opts.toolService.getToolDefinitions().find((t) => t.name === request.toolName);
      if (!def) {
        return { success: false, data: null, error: `Unknown tool: ${request.toolName}`, latencyMs: 0 };
      }

      if (def.permission === "write" && opts.requireConfirmationForWrite) {
        return {
          success: false,
          data: null,
          error: "Tool requires confirmation before execution",
          latencyMs: 0,
        };
      }

      const result = await opts.toolService.execute(request);

      if (opts.toolCallRepo && result.success) {
        try {
          await opts.toolCallRepo.insert({
            conversation_id: request.conversationId,
            tool_name: request.toolName,
            tool_input: request.input,
            tool_output: result.data as Record<string, unknown> ?? null,
            success: result.success,
            error_message: result.error ?? null,
            latency_ms: result.latencyMs,
            permission_granted: true,
          });
        } catch {
          // Audit logging failure must not block the response
        }
      }

      return result;
    },

    async getHistory(conversationId: string): Promise<ReadonlyArray<ToolCallRecord>> {
      if (!opts.toolCallRepo) return [];
      const rows = await opts.toolCallRepo.listByConversation(conversationId);
      return rows.map((r) => ({
        id: r.id,
        toolName: r.tool_name,
        input: r.tool_input,
        output: r.tool_output,
        success: r.success,
        error: r.error_message,
        latencyMs: r.latency_ms ?? 0,
        timestamp: r.created_at,
      }));
    },
  };
}
