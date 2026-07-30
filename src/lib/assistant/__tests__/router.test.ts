import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createRouter } from "../router";

describe("Router", () => {
  it("classifies regulatory queries as REGULATORY", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "What does the EU ETS directive say about monitoring?" });
    expect(result.intent).toBe("REGULATORY");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies compliance queries as COMPLIANCE", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "What is my vessel's compliance score for this year?" });
    expect(result.intent).toBe("COMPLIANCE");
  });

  it("classifies voyage queries as VOYAGE", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "Show me the voyage route for my last trip" });
    expect(result.intent).toBe("VOYAGE");
  });

  it("classifies document queries as DOCUMENT", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "Upload a BDN document for me" });
    expect(result.intent).toBe("DOCUMENT");
  });

  it("classifies search queries as SEARCH", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "Search how to look up information about regulatory documents" });
    expect(result.intent).toBe("SEARCH");
  });

  it("classifies captain queries as CAPTAIN", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "What certificates does my captain need?" });
    expect(result.intent).toBe("CAPTAIN");
  });

  it("classifies unknown queries as UNKNOWN", async () => {
    const router = createRouter({ useMock: true });
    const result = await router.classify({ query: "I like to bake bread on weekends" });
    expect(result.intent).toBe("UNKNOWN");
  });

  it("returns all supported intents", async () => {
    const router = createRouter({ useMock: true });
    const intents = router.getSupportedIntents();
    expect(intents.includes("REGULATORY")).toBe(true);
    expect(intents.includes("COMPLIANCE")).toBe(true);
    expect(intents.includes("VOYAGE")).toBe(true);
    expect(intents.includes("DOCUMENT")).toBe(true);
    expect(intents.includes("SEARCH")).toBe(true);
    expect(intents.includes("CAPTAIN")).toBe(true);
    expect(intents.includes("UNKNOWN")).toBe(true);
  });
});

run();
