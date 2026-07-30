import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockLlmProvider, createLlmProviderRegistry } from "../llm-provider";

describe("MockLlmProvider", () => {
  it("returns a response", async () => {
    const provider = createMockLlmProvider({ simulatedDelayMs: 10 });
    const response = await provider.generate({
      messages: [{ role: "user", content: "What is EU ETS?" }],
    });
    expect(response.content).toBeTruthy();
    expect(response.provider).toBe("mock");
    expect(response.latencyMs).toBeGreaterThan(-1);
  });

  it("uses custom mock responses when available", async () => {
    const provider = createMockLlmProvider({ simulatedDelayMs: 10, mockResponses: { "EU ETS": "This is a mock response about EU ETS." } });
    const response = await provider.generate({
      messages: [{ role: "user", content: "Tell me about EU ETS" }],
    });
    expect(response.content).toContainString("EU ETS");
  });

  it("isAvailable returns true", async () => {
    const provider = createMockLlmProvider();
    expect(provider.isAvailable()).toBe(true);
  });

  it("respects simulated delay", async () => {
    const provider = createMockLlmProvider({ simulatedDelayMs: 50 });
    const start = Date.now();
    await provider.generate({ messages: [{ role: "user", content: "test" }] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(44);
  });

  it("handles system messages", async () => {
    const provider = createMockLlmProvider({ simulatedDelayMs: 10 });
    const response = await provider.generate({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ],
    });
    expect(response.content).toBeTruthy();
  });

  it("provider type is mock", async () => {
    const provider = createMockLlmProvider();
    expect(provider.type).toBe("mock");
  });
});

describe("LlmProviderRegistry", () => {
  it("returns mock provider by default", async () => {
    const registry = createLlmProviderRegistry();
    const provider = registry.getProvider("mock");
    expect(provider.type).toBe("mock");
  });

  it("allows registering custom providers", async () => {
    const custom = createMockLlmProvider();
    const registry = createLlmProviderRegistry();
    registry.registerProvider("custom", custom);
    const provider = registry.getProvider("custom");
    expect(provider).toBe(custom);
  });
});

run();
