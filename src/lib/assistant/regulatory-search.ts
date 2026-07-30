import type { RegulatorySearchInput, RegulatorySearchResult } from "./types";
import type { KnowledgeDocumentRepository, KnowledgeChunkRepository } from "@/lib/supabase";
import type { MockKnowledgeBase } from "./mock-knowledge";

export interface RegulatorySearchServiceOptions {
  readonly docRepo?: KnowledgeDocumentRepository;
  readonly chunkRepo?: KnowledgeChunkRepository;
  readonly mockKnowledgeBase?: MockKnowledgeBase;
}

export interface RegulatorySearchService {
  search(input: RegulatorySearchInput): Promise<RegulatorySearchResult>;
}

export function createRegulatorySearchService(opts: RegulatorySearchServiceOptions = {}): RegulatorySearchService {
  async function search(input: RegulatorySearchInput): Promise<RegulatorySearchResult> {
    const maxResults = input.max_results ?? 10;

    if (opts.mockKnowledgeBase) {
      const results = opts.mockKnowledgeBase.searchByKeyword(input.question);
      let filtered = results;

      if (input.regulation) {
        const regLower = input.regulation.toLowerCase();
        filtered = filtered.filter((r) => r.regulation.toLowerCase() === regLower);
      }

      const mapped = filtered.slice(0, maxResults).map((r) => ({
        id: r.id,
        document_id: r.document_id,
        content: r.content,
        article_section: r.article_section,
        heading: r.heading,
        source_title: r.source_title,
        regulation: r.regulation,
        version: "",
        relevance_score: r.token_count ?? 0,
      }));

      return { chunks: mapped, total: mapped.length };
    }

    if (!opts.chunkRepo) {
      return { chunks: [], total: 0 };
    }

    const rawChunks = await opts.chunkRepo.searchByKeyword(input.question);
    const docMap = new Map<string, { title: string; regulation: string; version: string; effective_date: string | null }>();

    if (opts.docRepo) {
      const allDocs = await opts.docRepo.list();
      for (const d of allDocs) {
        docMap.set(d.id, { title: d.title, regulation: d.regulation, version: d.version, effective_date: d.effective_date });
      }
    }

    let filtered = rawChunks.filter((c) => docMap.has(c.document_id));

    if (input.regulation) {
      const regLower = input.regulation.toLowerCase();
      filtered = filtered.filter((c) => {
        const doc = docMap.get(c.document_id);
        return doc && doc.regulation.toLowerCase() === regLower;
      });
    }

    if (input.effective_date) {
      const cutoff = new Date(input.effective_date).getTime();
      filtered = filtered.filter((c) => {
        const doc = docMap.get(c.document_id);
        if (!doc || !doc.effective_date) return true;
        return new Date(doc.effective_date).getTime() <= cutoff;
      });
    }

    const mapped = filtered.slice(0, maxResults).map((r) => {
      const doc = docMap.get(r.document_id);
      const relevance_score = 0;
      return {
        id: r.id,
        document_id: r.document_id,
        content: r.content,
        article_section: r.article_section,
        heading: r.heading,
        source_title: doc?.title ?? "Unknown",
        regulation: doc?.regulation ?? "Unknown",
        version: doc?.version ?? "",
        relevance_score,
      };
    });

    return { chunks: mapped, total: mapped.length };
  }

  return { search };
}
