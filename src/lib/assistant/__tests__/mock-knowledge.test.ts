import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockKnowledgeBase } from "../mock-knowledge";

describe("MockKnowledgeBase", () => {
  it("loads documents for all expected regulations", async () => {
    const kb = createMockKnowledgeBase();
    expect(kb.documents.length).toBeGreaterThan(3);
    const regulations = kb.listRegulations();
    expect(regulations.includes("EU_ETS")).toBe(true);
    expect(regulations.includes("FuelEU")).toBe(true);
    expect(regulations.includes("THETIS_MRV")).toBe(true);
    expect(regulations.includes("MARPOL")).toBe(true);
  });

  it("chunks are linked to valid document IDs", async () => {
    const kb = createMockKnowledgeBase();
    for (const chunk of kb.chunks) {
      const doc = kb.getDocument(chunk.document_id);
      expect(doc).toBeTruthy();
    }
  });

  it("searchByKeyword returns relevant chunks", async () => {
    const kb = createMockKnowledgeBase();
    const results = kb.searchByKeyword("GHG intensity");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.toLowerCase().includes("ghg") || r.content.toLowerCase().includes("intensity"))).toBe(true);
  });

  it("searchByKeyword returns empty for unrelated terms", async () => {
    const kb = createMockKnowledgeBase();
    const results = kb.searchByKeyword("xyznonexistent12345");
    expect(results.length).toBe(0);
  });

  it("searchByKeyword results include source_title and regulation", async () => {
    const kb = createMockKnowledgeBase();
    const results = kb.searchByKeyword("emission");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.source_title).toBeTruthy();
    expect(results[0]!.regulation).toBeTruthy();
  });

  it("getDocument returns null for unknown ID", async () => {
    const kb = createMockKnowledgeBase();
    expect(kb.getDocument("nonexistent")).toBeNull();
  });

  it("getDocument returns document with chunks array", async () => {
    const kb = createMockKnowledgeBase();
    const doc = kb.getDocument(kb.documents[0]!.id);
    expect(doc).toBeTruthy();
    expect(doc!.chunks.length).toBeGreaterThan(0);
  });
});

run();
