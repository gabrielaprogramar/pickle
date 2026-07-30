import type { RegulatoryCitation, CitationGroup } from "./types";
import type { KnowledgeChunkRow, KnowledgeDocumentRow } from "@/lib/supabase";

export interface CitationService {
  buildCitation(chunk: KnowledgeChunkRow, document: KnowledgeDocumentRow, relevanceScore: number): RegulatoryCitation;
  buildCitationGroup(regulation: string, citations: ReadonlyArray<RegulatoryCitation>): CitationGroup;
  formatCitationsAsText(citations: ReadonlyArray<RegulatoryCitation>): string;
  formatCitationsAsMarkdown(citations: ReadonlyArray<RegulatoryCitation>): string;
}

export function createCitationService(): CitationService {
  function buildCitation(
    chunk: KnowledgeChunkRow,
    document: KnowledgeDocumentRow,
    relevanceScore: number,
  ): RegulatoryCitation {
    return {
      source: document.title,
      regulation: document.regulation,
      article_section: chunk.article_section,
      version: document.version,
      chunk_id: chunk.id,
      document_id: document.id,
      relevance_score: relevanceScore,
      excerpt: chunk.content,
    };
  }

  function buildCitationGroup(
    regulation: string,
    citations: ReadonlyArray<RegulatoryCitation>,
  ): CitationGroup {
    return { regulation, citations };
  }

  function formatCitationsAsText(citations: ReadonlyArray<RegulatoryCitation>): string {
    if (citations.length === 0) return "";
    const parts: string[] = ["Sources:"];
    for (const c of citations) {
      const article = c.article_section ? `, ${c.article_section}` : "";
      parts.push(`- ${c.source}${article} (${c.version}): "${c.excerpt.slice(0, 120)}..."`);
    }
    return parts.join("\n");
  }

  function formatCitationsAsMarkdown(citations: ReadonlyArray<RegulatoryCitation>): string {
    if (citations.length === 0) return "";
    const parts: string[] = ["## Sources\n"];
    for (const c of citations) {
      const article = c.article_section ? `, *${c.article_section}*` : "";
      parts.push(`- **${c.source}**${article} (_${c.version}_)`);
      parts.push(`  > ${c.excerpt.slice(0, 200)}...`);
      parts.push("");
    }
    return parts.join("\n");
  }

  return {
    buildCitation,
    buildCitationGroup,
    formatCitationsAsText,
    formatCitationsAsMarkdown,
  };
}
