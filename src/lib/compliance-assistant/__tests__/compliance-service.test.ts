import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createComplianceAssistantService, createMockComplianceAssistantService } from "../compliance-service";
import { createHandoffDetector } from "../handoff";
import { createComplianceResponseBuilder } from "../response-templates";
import type { AssistantService } from "@/lib/assistant/assistant-service";
import type { AssistantResponse, IntentClassification } from "@/lib/assistant/types";

function makeBaseService(overrides?: Partial<AssistantService>): AssistantService {
  const defaultResponse: AssistantResponse = {
    content: "The vessel compliance score is 95.",
    citations: [
      {
        source: "FuelEU Regulation",
        regulation: "FuelEU",
        article_section: "Article 4",
        version: "2023/01",
        chunk_id: "chunk-1",
        document_id: "doc-1",
        relevance_score: 0.95,
        excerpt: "Monitoring requirements excerpt.",
      },
    ],
    toolCalls: [
      {
        id: "tc-1",
        toolName: "get_vessel_compliance_score",
        input: {},
        output: { score: 95 },
        success: true,
        error: null,
        latencyMs: 120,
        timestamp: "2026-01-15T00:00:00.000Z",
      },
    ],
    disclaimer: "This information is provided for informational purposes only.",
    safetyCheck: { passed: true, warnings: [], violations: [] },
  };

  return {
    processQuery: async () => defaultResponse,
    classifyIntent: async (query: string): Promise<IntentClassification> => {
      const lower = query.toLowerCase();
      if (lower.includes("voyage") || lower.includes("sail") || lower.includes("track") || lower.includes("ais")) {
        return { intent: "VOYAGE", confidence: 0.9, subcategories: [] };
      }
      if (lower.includes("captain") || lower.includes("crew")) {
        return { intent: "CAPTAIN", confidence: 0.9, subcategories: [] };
      }
      return { intent: "COMPLIANCE", confidence: 0.9, subcategories: [] };
    },
    ...overrides,
  };
}

describe("ComplianceAssistantService (real)", () => {
  const handoffDetector = createHandoffDetector();
  const responseBuilder = createComplianceResponseBuilder();

  function createService(base?: AssistantService) {
    return createComplianceAssistantService(base ?? makeBaseService(), {
      router: null as any,
      safetyLayer: null as any,
      toolGateway: null as any,
      conversationService: null as any,
      llmProvider: null as any,
      regulatorySearch: null as any,
      citationService: null as any,
      handoffDetector,
      responseBuilder,
      systemPromptInput: { vesselContext: { id: "v-1", name: "Test Vessel", imo: "9876543" } },
    });
  }

  it("enhances response with compliance analysis section", async () => {
    const service = createService();
    const response = await service.processQuery("c1", "u1", "What is my compliance score?");
    expect(response.content).toContainString("**Compliance Analysis**");
    expect(response.content).toContainString("Parameter version: v-1");
  });

  it("includes tool result summary in enhanced response", async () => {
    const baseService = makeBaseService();
    const service = createService(baseService);
    const response = await service.processQuery("c1", "u1", "What is my compliance score?");
    expect(response.content).toContainString("Tools used:");
    expect(response.content).toContainString("get_vessel_compliance_score");
  });

  it("flags missing citations as warnings", async () => {
    const baseNoCitations: AssistantService = {
      ...makeBaseService(),
      processQuery: async () => ({
        content: "Some content without citations.",
        citations: [],
        toolCalls: [],
        disclaimer: "Disclaimer.",
        safetyCheck: { passed: true, warnings: [], violations: [] },
      }),
    };
    const service = createService(baseNoCitations);
    const response = await service.processQuery("c1", "u1", "Tell me about regulations");
    expect(response.safetyCheck.warnings.length).toBeGreaterThan(0);
    expect(response.safetyCheck.passed).toBe(false);
  });

  it("handoff returns early when target is none", async () => {
    const service = createService();
    const response = await service.processQuery("c1", "u1", "What is my FuelEU balance?");
    expect(response.content).toContainString("**Compliance Analysis**");
    expect(response.citations.length).toBeGreaterThan(0);
  });

  it("delegates classifyIntent to base service", async () => {
    const service = createService();
    const classification = await service.classifyIntent("What is my FuelEU balance?");
    expect(classification.intent).toBe("COMPLIANCE");
  });

  it("detectHandoff returns HandoffDecision from detector", () => {
    const service = createService();
    const decision = service.detectHandoff("Where is my vessel sailing?", { intent: "VOYAGE", confidence: 0.9, subcategories: [] });
    expect(decision.target).toBe("voyage");
  });
});

describe("createMockComplianceAssistantService", () => {
  const handoffDetector = createHandoffDetector();
  const responseBuilder = createComplianceResponseBuilder();

  function createMockService() {
    return createMockComplianceAssistantService(makeBaseService(), {
      router: null as any,
      safetyLayer: null as any,
      toolGateway: null as any,
      conversationService: null as any,
      llmProvider: null as any,
      regulatorySearch: null as any,
      citationService: null as any,
      handoffDetector,
      responseBuilder,
    });
  }

  it("returns greeting for hello query", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "Hello!");
    expect(response.content).toContainString("Hello! I am the Poseidon Ledger Compliance Assistant");
  });

  it("returns greeting for hi query", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "Hi there");
    expect(response.content).toContainString("Hello! I am the Poseidon Ledger Compliance Assistant");
  });

  it("returns mock compliance response for compliance queries", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "What is my FuelEU status?");
    expect(response.content).toContainString("Based on the available compliance data");
    expect(response.content).toContainString("**Answer**");
    expect(response.content).toContainString("**Evidence**");
    expect(response.content).toContainString("**Recommended action**");
  });

  it("detects handoff and returns handoff response", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "Where is my vessel sailing?");
    expect(response.content).toContainString("voyage");
    expect(response.content).toContainString("This query appears to be about");
  });

  it("includes disclaimer in mock response", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "What is my FuelEU status?");
    expect(response.disclaimer.length).toBeGreaterThan(0);
  });

  it("answers certificate-status queries from the deterministic certificate registry", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "Are any certificates expired?");
    expect(response.content).toContainString("Certificate registry");
    expect(response.content).toContainString("IMO 9074729");
    expect(response.content).toContainString("LOAD_LINE");
    expect(response.content).toContainString("derived deterministically");
    expect(response.citations.length).toBeGreaterThan(0);
  });

  it("never infers an expiry date in certificate-status answers", async () => {
    const service = createMockService();
    const response = await service.processQuery("c1", "u1", "When does my IAPP certificate expire?");
    expect(response.content).toContainString("No expiry date is ever inferred");
  });

  it("delegates classifyIntent to base service", async () => {
    const service = createMockService();
    const classification = await service.classifyIntent("What is my FuelEU balance?");
    expect(classification.intent).toBe("COMPLIANCE");
  });

  it("detectHandoff returns correct target for voyage queries", async () => {
    const service = createMockService();
    const decision = service.detectHandoff("Show AIS track", { intent: "VOYAGE", confidence: 0.9, subcategories: [] });
    expect(decision.target).toBe("voyage");
  });
});

run();
