import type {
  OcrAnswer,
  OcrContext,
  OcrDocumentInput,
  OcrRequest,
  OcrRepairSuggestion,
  OcrReviewSuggestionRecord,
  OcrQualityRecord,
  ReviewPriority,
  SimilarDocumentMatch,
} from "./types";
import { OCR_REVIEW_REQUIRED } from "./types";
import type { OcrToolContext, OcrToolRegistry } from "./ocr-tools";
import { OcrNoDocumentError } from "./ocr-tools";
import type { OcrMockState } from "./mock-data";
import { OCR_MOCK_NOW, toOcrDocumentInput } from "./mock-data";
import type { OcrHandoffDetector } from "./handoff";
import type { OcrSafetyGuard } from "./safety";
import type { OcrMemory } from "./memory";

export interface OcrServiceOptions {
  readonly state: OcrMockState;
  readonly registry: OcrToolRegistry;
  readonly handoffDetector: OcrHandoffDetector;
  readonly safetyGuard: OcrSafetyGuard;
  readonly memory: OcrMemory;
  readonly context: OcrContext;
}

export interface OcrService {
  answer(req: OcrRequest): OcrAnswer;
  classify(req: OcrRequest): OcrAnswer;
  quality(req: OcrRequest): OcrAnswer;
  suggestions(req: OcrRequest): OcrAnswer;
  similar(req: OcrRequest): OcrAnswer;
  dictionary(req: OcrRequest): OcrAnswer;
  explain(req: OcrRequest): OcrAnswer;
  summarize(req: OcrRequest): OcrAnswer;
  recall(req: OcrRequest): OcrAnswer;
  review(req: OcrRequest): OcrAnswer;
}

function toToolContext(req: OcrRequest, state: OcrMockState, context: OcrContext): OcrToolContext {
  return { context: req.context ?? context, state };
}

export function createOcrService(opts: OcrServiceOptions): OcrService {
  const state = opts.state;

  function remember(req: OcrRequest, key: string, value: string): void {
    const vesselId = req.context?.vesselImo ?? opts.context.vesselImo;
    if (vesselId) {
      opts.memory.remember(vesselId, key, value);
    }
  }

  function qualityRecord(
    req: OcrRequest,
    documentId: string,
    quality: ReturnType<OcrToolRegistry["detectQuality"]>["data"],
    now: string,
  ): OcrQualityRecord {
    return {
      id: `ocr-quality-${documentId}`,
      ocrResultId: documentId,
      documentId,
      detectedFamily: quality.classification.family,
      overallQualityScore: quality.quality.overallQualityScore,
      level: quality.quality.level,
      pageQuality: quality.quality.pageQuality,
      textCoverage: quality.quality.textCoverage,
      fieldCoverage: quality.quality.fieldCoverage,
      confidenceScore: quality.quality.confidenceScore,
      confidenceDistribution: quality.quality.confidenceDistribution,
      issues: quality.quality.issues,
      missingMandatoryFields: quality.quality.missingMandatoryFields,
      createdAt: now,
    };
  }

  function suggestionRecords(
    req: OcrRequest,
    documentId: string,
    suggestions: ReadonlyArray<OcrRepairSuggestion>,
    priority: ReviewPriority,
    now: string,
  ): ReadonlyArray<OcrReviewSuggestionRecord> {
    return suggestions.map((s, i) => ({
      id: `ocr-suggestion-${documentId}-${i}`,
      ocrResultId: documentId,
      documentId,
      fieldKey: s.fieldKey,
      kind: s.kind,
      originalValue: s.original,
      suggestedValue: s.suggested,
      confidence: s.confidence,
      reason: s.reason,
      priority,
      status: "open" as const,
      createdAt: now,
    }));
  }

  function classify(req: OcrRequest): OcrAnswer {
    const result = opts.registry.classifyDocument(toToolContext(req, state, opts.context));
    return {
      text: `Classified as ${result.data.family.toLowerCase()} (confidence ${result.data.confidence.toFixed(2)}): ${result.data.reason}`,
      classification: result.data,
    };
  }

  function quality(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to assess. Which document should I review?" };
    }
    const result = opts.registry.detectQuality(ctx, { documentId });
    const now = ctx.context.now ?? state.now;
    const record = qualityRecord(req, documentId, result.data, now);
    const text = [
      `QUALITY — ${documentId}`,
      `Family: ${result.data.classification.family.toLowerCase()}`,
      `Score: ${result.data.quality.overallQualityScore.toFixed(2)} / level ${result.data.quality.level.toLowerCase()}`,
      `Text coverage ${(result.data.quality.textCoverage * 100).toFixed(0)}% · field coverage ${(result.data.quality.fieldCoverage * 100).toFixed(0)}%`,
    ].join("\n");
    remember(req, "last-quality", `${documentId}=${result.data.quality.level}`);
    return {
      text,
      classification: result.data.classification,
      quality: result.data.quality,
      priority: result.data.priority,
      records: [record],
    };
  }

  function suggestions(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to suggest corrections for. Which document should I review?" };
    }
    const now = ctx.context.now ?? state.now;
    const suggestionsResult = opts.registry.suggestCorrections(ctx, { documentId });
    const qualityResult = opts.registry.detectQuality(ctx, { documentId });
    const records = suggestionRecords(req, documentId, suggestionsResult.data, qualityResult.data.priority.priority, now);
    const text =
      suggestionsResult.data.length === 0
        ? `No corrections needed for ${documentId}.`
        : `SUGGESTED CORRECTIONS — ${documentId}\n${suggestionsResult.data
            .map(
              (s) =>
                `- [${s.kind.toLowerCase().replaceAll("_", " ")}] ${s.original} -> ${s.suggested} (${s.reason}, confidence ${s.confidence.toFixed(2)})`,
            )
            .join("\n")}`;
    return {
      text,
      suggestions: suggestionsResult.data,
      priority: qualityResult.data.priority,
      records,
    };
  }

  function similar(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to find similar ones. Which document should I compare?" };
    }
    const result = opts.registry.findSimilarDocuments(ctx, { documentId });
    const text =
      result.data.length === 0
        ? `No similar documents found for ${documentId}.`
        : `SIMILAR DOCUMENTS — ${documentId}\n${result.data
            .map((m) => `- ${m.title} (${m.documentId}) · ${m.family.toLowerCase()} · ${(m.similarity * 100).toFixed(0)}% match`)
            .join("\n")}`;
    return { text, similar: result.data };
  }

  function dictionary(req: OcrRequest): OcrAnswer {
    const match = req.query.match(/^(?:look up|what is|what does|find)\s+(?:the\s+)?(.+)/i);
    const query = match?.[1] ?? req.query.trim();
    const result = opts.registry.lookupDictionaryEntry(toToolContext(req, state, opts.context), { query });
    const text =
      result.data.length === 0
        ? `No dictionary entry found for "${query}".`
        : result.data
            .map((e) => `- ${e.canonical}${e.kind ? ` [${e.kind}]` : ""}: ${e.description ?? ""}`.trim())
            .join("\n");
    return { text };
  }

  function explain(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to explain. Which document should I review?" };
    }
    const result = opts.registry.explainReviewReason(ctx, { documentId });
    const data = opts.registry.detectQuality(ctx, { documentId });
    return { text: result.data, priority: data.data.priority, classification: data.data.classification };
  }

  function summarize(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to summarize. Which document should I review?" };
    }
    const result = opts.registry.summarizeQuality(ctx, { documentId });
    return { text: result.data };
  }

  function recall(req: OcrRequest): OcrAnswer {
    const vesselId = req.context?.vesselImo ?? opts.context.vesselImo;
    if (!vesselId) {
      return { text: "I have no vessel context to recall from.", records: [] };
    }
    const entries = opts.memory.list(vesselId);
    if (entries.length === 0) {
      return {
        text: "I have no remembered context for this vessel yet. My memory is context only and never overrides the deterministic data.",
      };
    }
    const lines = entries.map((e) => `- ${e.key}: ${e.value} (recorded ${e.updatedAt.slice(0, 10)})`);
    return {
      text: `Remembered context for ${vesselId}:\n${lines.join("\n")}\n(This is context, not authority.)`,
    };
  }

  function review(req: OcrRequest): OcrAnswer {
    const ctx = toToolContext(req, state, opts.context);
    const documentId = ctx.context.documentId ?? req.context?.documentId;
    if (!documentId) {
      return { text: "I need a document to review. Which document should I review?" };
    }
    const now = ctx.context.now ?? state.now;
    const qualityResult = opts.registry.detectQuality(ctx, { documentId });
    const suggestionsResult = opts.registry.suggestCorrections(ctx, { documentId });
    const records: ReadonlyArray<OcrReviewSuggestionRecord | OcrQualityRecord> = [
      qualityRecord(req, documentId, qualityResult.data, now),
      ...suggestionRecords(req, documentId, suggestionsResult.data, qualityResult.data.priority.priority, now),
    ];
    const priority = qualityResult.data.priority.priority;
    const reviewLabel = priority === "LOW" ? "clear for capture" : `sent for review (reason code ${OCR_REVIEW_REQUIRED})`;
    const text = [
      `REVIEW — ${documentId}`,
      `Priority: ${priority} · quality ${qualityResult.data.quality.level.toLowerCase()} (${qualityResult.data.quality.overallQualityScore.toFixed(2)})`,
      `Family: ${qualityResult.data.classification.family.toLowerCase()}`,
      ...qualityResult.data.priority.reasons.map((r) => `- ${r}`),
      suggestionsResult.data.length > 0 ? `Corrections proposed: ${suggestionsResult.data.length}` : "No corrections proposed.",
      `Result: ${reviewLabel}`,
    ].join("\n");
    remember(req, "last-review", `${documentId}=${priority}`);
    return {
      text,
      classification: qualityResult.data.classification,
      quality: qualityResult.data.quality,
      suggestions: suggestionsResult.data,
      priority: qualityResult.data.priority,
      records,
    };
  }

  function answer(req: OcrRequest): OcrAnswer {
    const query = (req.query ?? "").trim();
    const safety = opts.safetyGuard.check(query);
    if (!safety.safe) {
      return { text: safety.reason ?? "Request blocked by safety guard." };
    }

    const handoff = opts.handoffDetector.detect(query);
    if (handoff.handoff) {
      return {
        text: `This looks like a task for the ${handoff.target.charAt(0).toUpperCase() + handoff.target.slice(1)} Assistant. ${handoff.reason}`,
        handoff: { target: handoff.target, confidence: handoff.confidence, reason: handoff.reason },
      };
    }

    const lower = query.toLowerCase();

    if (/memory|remember|recall|what did you (t|not)ell/i.test(lower)) {
      return recall(req);
    }
    if (/why|explain|reason|blocking|escalat/i.test(lower)) {
      return explain(req);
    }
    if (/look up|what is|what does|define|dictionary/i.test(lower)) {
      return dictionary(req);
    }
    if (/similar|compare|other documents like/i.test(lower)) {
      return similar(req);
    }
    if (/suggest|correction|fix|typo|repair|spell/i.test(lower)) {
      return suggestions(req);
    }
    if (/quality|score|how good|readable|issues/i.test(lower)) {
      return quality(req);
    }
    if (/review|route|needs review/i.test(lower)) {
      return review(req);
    }
    if (/classif|what type|what document/i.test(lower)) {
      return classify(req);
    }
    if (/summar/i.test(lower)) {
      return summarize(req);
    }

    return {
      text: "I can classify a scanned document, score its OCR quality, suggest deterministic corrections and explain review priority. Try \"what quality is document ocr-doc-blurred-certificate?\"",
    };
  }

  return { answer, classify, quality, suggestions, similar, dictionary, explain, summarize, recall, review };
}

export { OCR_MOCK_NOW, toOcrDocumentInput };
export type { OcrDocumentInput, OcrRepairSuggestion, OcrReviewSuggestionRecord, OcrQualityRecord };
