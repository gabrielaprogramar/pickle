import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createCitationService } from "../citations";
import { createMockKnowledgeBase } from "../mock-knowledge";

describe("CitationService", () => {
  it("builds a citation from a chunk and document", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createCitationService();
    const doc = kb.documents[0]!;
    const chunk = kb.chunks[0]!;
    const citation = svc.buildCitation(chunk, doc, 0.95);
    expect(citation.source).toBe(doc.title);
    expect(citation.regulation).toBe(doc.regulation);
    expect(citation.version).toBe(doc.version);
    expect(citation.chunk_id).toBe(chunk.id);
    expect(citation.relevance_score).toBe(0.95);
  });

  it("formats citations as text with source list", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createCitationService();
    const doc = kb.documents[0]!;
    const chunk = kb.chunks[0]!;
    const citation = svc.buildCitation(chunk, doc, 0.85);
    const text = svc.formatCitationsAsText([citation]);
    expect(text).toContainString("Sources:");
    expect(text).toContainString(doc.title);
    expect(text).toContainString(doc.version);
  });

  it("formats citations as markdown", async () => {
    const kb = createMockKnowledgeBase();
    const svc = createCitationService();
    const doc = kb.documents[0]!;
    const chunk = kb.chunks[0]!;
    const citation = svc.buildCitation(chunk, doc, 0.85);
    const md = svc.formatCitationsAsMarkdown([citation]);
    expect(md).toContainString("## Sources");
  });

  it("builds citation groups by regulation", async () => {
    const svc = createCitationService();
    const group = svc.buildCitationGroup("EU_ETS", []);
    expect(group.regulation).toBe("EU_ETS");
    expect(group.citations.length).toBe(0);
  });

  it("formatCitationsAsText returns empty string for empty citations", async () => {
    const svc = createCitationService();
    expect(svc.formatCitationsAsText([])).toBe("");
  });

  it("formatCitationsAsMarkdown returns empty string for empty citations", async () => {
    const svc = createCitationService();
    expect(svc.formatCitationsAsMarkdown([])).toBe("");
  });
});

run();
