import type { AssistantService, AssistantServiceOptions } from "@/lib/assistant/assistant-service";
import type { AssistantResponse, IntentClassification, RegulatoryCitation } from "@/lib/assistant/types";
import type { HandoffDetector, HandoffDecision } from "./handoff";
import { isCertificateStatusQuery } from "./handoff";
import type { ComplianceResponseBuilder } from "./response-templates";
import { buildComplianceSystemPrompt, type SystemPromptInput } from "./system-prompt";
import {
  buildMockCertificateRegistry,
  CERT_MOCK_NOW,
  CERT_MOCK_VESSEL,
  complianceCertificateExplanation,
} from "@/lib/certificates";

export interface ComplianceAssistantOptions extends AssistantServiceOptions {
  readonly handoffDetector: HandoffDetector;
  readonly responseBuilder: ComplianceResponseBuilder;
  readonly systemPromptInput?: SystemPromptInput;
}

export interface ComplianceAssistantService {
  processQuery(conversationId: string, userId: string, query: string): Promise<AssistantResponse>;
  classifyIntent(query: string): Promise<IntentClassification>;
  detectHandoff(query: string, intent: IntentClassification): HandoffDecision;
}

export function createComplianceAssistantService(
  baseService: AssistantService,
  opts: ComplianceAssistantOptions,
): ComplianceAssistantService {
  const systemPrompt = buildComplianceSystemPrompt(opts.systemPromptInput);

  async function processQuery(conversationId: string, userId: string, query: string): Promise<AssistantResponse> {
    const intentClassification = await baseService.classifyIntent(query);

    const handoffDecision = opts.handoffDetector.detectHandoff(query, intentClassification.intent);
    if (handoffDecision.target !== "none" && handoffDecision.confidence > 0.5) {
      return {
        content: `I detected that your query relates to **${handoffDecision.target}** matters. ${handoffDecision.reason}\n\nPlease contact the **${handoffDecision.target.charAt(0).toUpperCase() + handoffDecision.target.slice(1)} Assistant** for specialized support.`,
        citations: [],
        toolCalls: [],
        disclaimer: "",
        safetyCheck: { passed: true, warnings: [], violations: [] },
      };
    }

    const response = await baseService.processQuery(conversationId, userId, query);

    const toolSummary = opts.responseBuilder.formatToolResultSummary(response.toolCalls);

    const enhancedContent = [
      response.content,
      `\n\n**Compliance Analysis**`,
      toolSummary ? `\n${toolSummary}` : "",
      `\n\n*Parameter version: ${opts.systemPromptInput?.vesselContext?.id ?? "standard"}*`,
    ].join("");

    return {
      content: enhancedContent,
      citations: response.citations,
      toolCalls: response.toolCalls,
      disclaimer: response.disclaimer,
      safetyCheck: {
        passed: response.safetyCheck.passed && response.citations.length > 0,
        warnings: response.citations.length === 0 ? ["Response contains no citations"] : response.safetyCheck.warnings,
        violations: response.safetyCheck.violations,
      },
    };
  }

  async function classifyIntent(query: string): Promise<IntentClassification> {
    return baseService.classifyIntent(query);
  }

  return {
    processQuery,
    classifyIntent,
    detectHandoff(query: string, intent: IntentClassification): HandoffDecision {
      return opts.handoffDetector.detectHandoff(query, intent.intent);
    },
  };
}

export function createMockComplianceAssistantService(
  baseService: AssistantService,
  opts: ComplianceAssistantOptions,
): ComplianceAssistantService {
  const service = createComplianceAssistantService(baseService, opts);
  const mockResponse: AssistantResponse = {
    content: "Based on the available compliance data from the Poseidon Ledger deterministic engine, I can provide the following analysis:\n\n**Answer** — The vessel is in compliance with applicable FuelEU and EU ETS regulations for the reporting period.\n\n**Evidence** — The FuelEU record shows a GHG intensity of 85.2 gCO2e/MJ against a target of 89.3 gCO2e/MJ, resulting in a compliance surplus.\n\n**Why** — FuelEU Maritime requires vessels to reduce GHG intensity against a year-on-year tightening target. A surplus indicates the vessel outperforms the target.\n\n**Recommended action** — Continue current operational measures. The surplus can be banked for future compliance periods.\n\nPlease use the available tools to verify specific compliance figures.\n\n---\nThis information is provided for informational purposes only and does not constitute legal advice.",
    citations: [],
    toolCalls: [],
    disclaimer: "This information is provided for informational purposes only and does not constitute legal advice.",
    safetyCheck: { passed: true, warnings: [], violations: [] },
  };

  return {
    ...service,
    async processQuery(conversationId: string, userId: string, query: string): Promise<AssistantResponse> {
      const lower = query.toLowerCase();
      if (lower.includes("hello") || lower.includes("hi")) {
        return {
          ...mockResponse,
          content: "Hello! I am the Poseidon Ledger Compliance Assistant. I can help you with FuelEU, EU ETS, MRV, and other maritime compliance matters. How can I assist you today?",
        };
      }
      const classification = await service.classifyIntent(query);
      const handoff = service.detectHandoff(query, classification);
      if (handoff.target !== "none" && handoff.confidence > 0.5) {
        return {
          content: `This query appears to be about **${handoff.target}** matters, which are handled by a different specialist assistant. ${handoff.reason}`,
          citations: [],
          toolCalls: [],
          disclaimer: "",
          safetyCheck: { passed: true, warnings: [], violations: [] },
        };
      }
      if (isCertificateStatusQuery(query)) {
        return buildCertificateRegistryResponse();
      }
      return mockResponse;
    },
  };
}

function buildCertificateRegistryResponse(): AssistantResponse {
  const registry = buildMockCertificateRegistry(CERT_MOCK_NOW);
  const statements = registry.records.map((record) =>
    complianceCertificateExplanation(record, CERT_MOCK_NOW).answer,
  );
  const citations: ReadonlyArray<RegulatoryCitation> = [
    {
      source: "Poseidon Ledger certificate registry",
      regulation: "Statutory certificates (derived)",
      article_section: "REGULATORY_RESEARCH.md",
      version: "1.0",
      chunk_id: "certificate-registry",
      document_id: "certificate-registry",
      relevance_score: 1.0,
      excerpt:
        "Certificate statuses are derived deterministically from evidence on file; no expiry date is ever inferred.",
    },
  ];
  return {
    content: [
      `**Certificate registry — ${CERT_MOCK_VESSEL.name} (IMO ${CERT_MOCK_VESSEL.imo})**`,
      "",
      ...statements,
      "",
      "Each status above is derived deterministically from the certificate registry (dates and applicability on file). No expiry date is ever inferred by the assistant.",
    ].join("\n"),
    citations,
    toolCalls: [],
    disclaimer: "This information is provided for informational purposes only and does not constitute legal advice.",
    safetyCheck: { passed: true, warnings: [], violations: [] },
  };
}
