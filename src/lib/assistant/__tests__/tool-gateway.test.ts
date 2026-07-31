import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createToolGateway } from "../tool-gateway";
import { createMockStructuredToolService } from "../structured-tools";

describe("ToolGateway", () => {
  it("returns available tools from the tool service", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const tools = gateway.getAvailableTools();
    expect(tools.length).toBe(15);
  });

  it("getTool returns a specific tool definition", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const tool = gateway.getTool("get_vessel_compliance_score");
    expect(tool).toBeTruthy();
    expect(tool!.name).toBe("get_vessel_compliance_score");
  });

  it("getTool returns undefined for unknown tool", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    expect(gateway.getTool("nonexistent")).toBeFalsy();
  });

  it("execute returns successful result for valid tool", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const result = await gateway.execute(
      { toolName: "get_vessel_compliance_score", input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" },
      "user-1",
    );
    expect(result.success).toBe(true);
  });

  it("execute returns error for unknown tool", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const result = await gateway.execute(
      { toolName: "nonexistent_tool", input: {}, conversationId: "c1" },
      "user-1",
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("records tool call audit when repo is provided", async () => {
    const toolSvc = createMockStructuredToolService();
    const calls: Array<Record<string, unknown>> = [];
    const mockRepo = {
      insert: async (input: any) => {
        calls.push(input);
        return { id: "tc1", ...input };
      },
      findById: async () => null,
      listByConversation: async () => [],
      listByToolName: async () => [],
    };
    const gateway = createToolGateway({ toolService: toolSvc, toolCallRepo: mockRepo as any });
    await gateway.execute(
      { toolName: "get_vessel_compliance_score", input: { vesselId: "vessel-001", year: 2025 }, conversationId: "c1" },
      "user-1",
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it("all tool definitions are read-only", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const tools = gateway.getAvailableTools();
    for (const tool of tools) {
      expect(tool.permission).toBe("read");
    }
  });

  it("getHistory returns empty array when no repo", async () => {
    const toolSvc = createMockStructuredToolService();
    const gateway = createToolGateway({ toolService: toolSvc });
    const history = await gateway.getHistory("c1");
    expect(history.length).toBe(0);
  });
});

run();
