import type { LlmRequest, LlmResponse, ModelProviderType } from "./types";

export interface LlmProvider {
  readonly type: ModelProviderType;
  generate(request: LlmRequest): Promise<LlmResponse>;
  isAvailable(): boolean;
}

export interface MockLlmProviderOptions {
  readonly simulatedDelayMs?: number;
  readonly mockResponses?: Record<string, string>;
}

export function createMockLlmProvider(opts: MockLlmProviderOptions = {}): LlmProvider {
  const delay = opts.simulatedDelayMs ?? 100;
  const responses = opts.mockResponses ?? {};

  function findMockResponse(messages: ReadonlyArray<{ role: string; content: string }>): string | null {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return null;

    const content = lastUserMsg.content.toLowerCase();

    if (responses) {
      for (const [keyword, response] of Object.entries(responses)) {
        if (content.includes(keyword.toLowerCase())) {
          return response;
        }
      }
    }

    if (content.includes("compliance") || content.includes("regulation") || content.includes("ets") || content.includes("fuel eu")) {
      return "Based on the available compliance data from the Poseidon Ledger deterministic engine, the vessel appears to be in compliance with applicable regulations. Please use the available tools to verify specific compliance figures.";
    }

    if (content.includes("hello") || content.includes("hi")) {
      return "Hello! I am the Poseidon Ledger AI Assistant. I can help you with regulatory compliance, voyage information, document management, and more. How can I assist you today?";
    }

    return "I understand your query. Based on the information available through the Poseidon Ledger system, I can help analyze this further using the available compliance tools and knowledge base.";
  }

  return {
    type: "mock" as ModelProviderType,

    async generate(request: LlmRequest): Promise<LlmResponse> {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, delay));

      const mockResponse = findMockResponse(request.messages);
      return {
        content: mockResponse ?? "I cannot process this request in mock mode.",
        model: "mock-model-v1",
        provider: "mock" as ModelProviderType,
        latencyMs: Date.now() - start,
        tokenCount: 0,
      };
    },

    isAvailable(): boolean {
      return true;
    },
  };
}

export type RealProviderConfig = {
  readonly type: "openai" | "anthropic" | "custom";
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
};

export function createRealLlmProvider(config: RealProviderConfig): LlmProvider {
  if (!config.apiKey) {
    throw new Error("Not implemented: real LLM provider requires API key configuration");
  }

  const baseUrl = config.baseUrl ?? (config.type === "openai"
    ? "https://api.openai.com/v1"
    : config.type === "anthropic"
      ? "https://api.anthropic.com/v1"
      : "");

  return {
    type: config.type,

    async generate(request: LlmRequest): Promise<LlmResponse> {
      const start = Date.now();

      const body: Record<string, unknown> = {
        model: config.model ?? (config.type === "openai" ? "gpt-4" : "claude-3-opus-20240229"),
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API error ${response.status}: ${errorText}`);
        }

        const json: any = await response.json();
        const content = json.choices?.[0]?.message?.content ?? "";

        return {
          content,
          model: json.model ?? body.model as string,
          provider: config.type,
          latencyMs: Date.now() - start,
          tokenCount: json.usage?.total_tokens,
        };
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof DOMException && e.name === "AbortError") {
          throw new Error("LLM request timed out after 60s");
        }
        throw e;
      }
    },

    isAvailable(): boolean {
      return !!config.apiKey;
    },
  };
}

export interface LlmProviderRegistry {
  getProvider(type?: ModelProviderType): LlmProvider;
  registerProvider(type: ModelProviderType, provider: LlmProvider): void;
}

export function createLlmProviderRegistry(mockProvider?: LlmProvider): LlmProviderRegistry {
  const providers = new Map<ModelProviderType, LlmProvider>();
  providers.set("mock", mockProvider ?? createMockLlmProvider());

  return {
    getProvider(type: ModelProviderType = "mock"): LlmProvider {
      const p = providers.get(type);
      if (!p) throw new Error(`No LLM provider registered for type: ${type}`);
      return p;
    },
    registerProvider(type: ModelProviderType, provider: LlmProvider): void {
      providers.set(type, provider);
    },
  };
}
