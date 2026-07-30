import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createRegulatorySearchService } from "../regulatory-search";
import { createMockKnowledgeBase } from "../mock-knowledge";

describe("RegulatorySearchService", () => {
  it("returns results from mock knowledge base", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createRegulatorySearchService({ mockKnowledgeBase: kb });
    const result = await svc.search({ question: "GHG intensity limit" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("filters by regulation", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createRegulatorySearchService({ mockKnowledgeBase: kb });
    const result = await svc.search({ question: "emission", regulation: "EU_ETS" });
    for (const chunk of result.chunks) {
      expect(chunk.regulation).toBe("EU_ETS");
    }
  });

  it("returns empty for unrelated query", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createRegulatorySearchService({ mockKnowledgeBase: kb });
    const result = await svc.search({ question: "completely unrelated query xyz" });
    expect(result.total).toBe(0);
  });

  it("respects max_results parameter", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createRegulatorySearchService({ mockKnowledgeBase: kb });
    const result = await svc.search({ question: "emission", max_results: 2 });
    expect(result.chunks.length).toBeLessThanOrEqual(2);
  });

  it("returns chunks with source_title and regulation", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createRegulatorySearchService({ mockKnowledgeBase: kb });
    const result = await svc.search({ question: "fuel" });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]!.source_title).toBeTruthy();
    expect(result.chunks[0]!.regulation).toBeTruthy();
  });

  it("returns empty when no repos provided", async () => {
    const svc = createRegulatorySearchService();
    const result = await svc.search({ question: "anything" });
    expect(result.total).toBe(0);
  });
});

run();
