/**
 * ocr-tools.ts — read-only tool registry for the OCR assistant
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Exposes the deterministic OCR engines as tools: classify_document,
 * detect_quality, suggest_corrections, lookup_dictionary,
 * find_similar_documents, explain_review_reason and summarize_quality. Every
 * tool is read-only and resolved against the mock state or ad-hoc text.
 *
 * HOW IT FITS
 * The service dispatches intents to these tools. ToolDefinitions mirror the
 * maintenance-assistant contract so the assistant gateway can quote them.
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/assistant/types";
import { classifyDocument, familyLabel } from "./classification";
import { computeQualityScore } from "./quality";
import { generateRepairSuggestions } from "./suggestions";
import { evaluateReviewPriority } from "./priority";
import { lookupDictionary, getDictionaryEntries } from "./dictionary";
import type { DictionaryEntry, DictionaryDomain } from "./dictionary";
import type {
  OcrClassification,
  OcrContext,
  OcrDocumentFamily,
  OcrDocumentInput,
  OcrMockDocument,
  OcrQualityScore,
  OcrRepairSuggestion,
  ReviewPriorityDecision,
  SimilarDocumentMatch,
} from "./types";
import type { OcrMockState } from "./mock-data";

export const TOOL_CLASSIFY_DOCUMENT = "classify_document" as const;
export const TOOL_DETECT_QUALITY = "detect_quality" as const;
export const TOOL_SUGGEST_CORRECTIONS = "suggest_corrections" as const;
export const TOOL_LOOKUP_DICTIONARY = "lookup_dictionary" as const;
export const TOOL_FIND_SIMILAR_DOCUMENTS = "find_similar_documents" as const;
export const TOOL_EXPLAIN_REVIEW_REASON = "explain_review_reason" as const;
export const TOOL_SUMMARIZE_QUALITY = "summarize_quality" as const;

export const OCR_TOOL_NAMES: ReadonlyArray<string> = [
  TOOL_CLASSIFY_DOCUMENT,
  TOOL_DETECT_QUALITY,
  TOOL_SUGGEST_CORRECTIONS,
  TOOL_LOOKUP_DICTIONARY,
  TOOL_FIND_SIMILAR_DOCUMENTS,
  TOOL_EXPLAIN_REVIEW_REASON,
  TOOL_SUMMARIZE_QUALITY,
];

export class OcrDocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`OCR document not found: ${documentId}`);
    this.name = "OcrDocumentNotFoundError";
  }
}

export class OcrNoDocumentError extends Error {
  constructor() {
    super("No document was specified. Provide a documentId or ask about one of the documents on file.");
    this.name = "OcrNoDocumentError";
  }
}

export interface OcrToolContext {
  readonly context: OcrContext;
  readonly state: OcrMockState;
}

export interface OcrToolResult<T> {
  readonly tool: string;
  readonly data: T;
}

export interface OcrQualityToolData {
  readonly classification: OcrClassification;
  readonly quality: OcrQualityScore;
  readonly priority: ReviewPriorityDecision;
}

export interface OcrToolRegistry {
  classifyDocument(
    ctx: OcrToolContext,
    input?: Readonly<{ documentId?: string; rawText?: string }>,
  ): OcrToolResult<OcrClassification>;
  detectQuality(ctx: OcrToolContext, input: Readonly<{ documentId: string }>): OcrToolResult<OcrQualityToolData>;
  suggestCorrections(
    ctx: OcrToolContext,
    input: Readonly<{ documentId: string }>,
  ): OcrToolResult<ReadonlyArray<OcrRepairSuggestion>>;
  lookupDictionaryEntry(
    ctx: OcrToolContext,
    input: Readonly<{ query: string; domain?: DictionaryDomain }>,
  ): OcrToolResult<ReadonlyArray<DictionaryEntry>>;
  findSimilarDocuments(
    ctx: OcrToolContext,
    input: Readonly<{ documentId: string }>,
  ): OcrToolResult<ReadonlyArray<SimilarDocumentMatch>>;
  explainReviewReason(ctx: OcrToolContext, input: Readonly<{ documentId: string }>): OcrToolResult<string>;
  summarizeQuality(ctx: OcrToolContext, input: Readonly<{ documentId: string }>): OcrToolResult<string>;
}

// ── Document resolution ──────────────────────────────────────────────────────

export function findMockDocument(
  state: OcrMockState,
  context: OcrContext,
  documentId?: string,
): OcrMockDocument | null {
  const wanted = documentId ?? context.documentId;
  if (!wanted) return null;
  return state.documents.find((d) => d.id === wanted) ?? null;
}

function toInput(doc: OcrMockDocument): OcrDocumentInput {
  return {
    documentId: doc.id,
    title: doc.title,
    documentType: doc.declaredType,
    rawText: doc.rawText,
    extractedData: doc.extractedData,
    ocrConfidence: doc.ocrConfidence,
    wordConfidence: doc.wordConfidence,
    pageSignals: doc.pageSignals,
  };
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const classifyInputSchema = z.object({
  documentId: z.string().optional(),
  rawText: z.string().optional(),
});

const documentInputSchema = z.object({
  documentId: z.string().min(1),
});

const lookupInputSchema = z.object({
  query: z.string().min(1),
  domain: z
    .enum(["fuel", "port", "certificate", "class_society", "terminology", "regulation"])
    .optional(),
});

// ── Similarity ───────────────────────────────────────────────────────────────

function computeSimilarity(target: OcrClassification, candidate: OcrClassification): number {
  if (target.matchedSignals.length === 0) return 0;
  const shared = target.matchedSignals.filter((s) => candidate.matchedSignals.includes(s)).length;
  let similarity = shared / target.matchedSignals.length;
  if (candidate.family === target.family) similarity += 0.15;
  return Math.min(similarity, 1);
}

export function createOcrToolRegistry(): OcrToolRegistry {
  return {
    classifyDocument(ctx, input) {
      let doc: OcrMockDocument | null = null;
      if (input?.rawText) {
        const classification = classifyDocument({
          documentId: "ad-hoc",
          documentType: "OTHER",
          rawText: input.rawText,
          extractedData: {},
          ocrConfidence: 1,
        });
        return { tool: TOOL_CLASSIFY_DOCUMENT, data: classification };
      }
      doc = findMockDocument(ctx.state, ctx.context, input?.documentId);
      if (!doc) {
        if (input?.documentId) throw new OcrDocumentNotFoundError(input.documentId);
        throw new OcrNoDocumentError();
      }
      return { tool: TOOL_CLASSIFY_DOCUMENT, data: classifyDocument(toInput(doc)) };
    },

    detectQuality(ctx, input) {
      const doc = findMockDocument(ctx.state, ctx.context, input.documentId);
      if (!doc) throw new OcrDocumentNotFoundError(input.documentId);
      const classification = classifyDocument(toInput(doc));
      const quality = computeQualityScore(toInput(doc), classification);
      const priority = evaluateReviewPriority({ quality, family: classification.family });
      return { tool: TOOL_DETECT_QUALITY, data: { classification, quality, priority } };
    },

    suggestCorrections(ctx, input) {
      const doc = findMockDocument(ctx.state, ctx.context, input.documentId);
      if (!doc) throw new OcrDocumentNotFoundError(input.documentId);
      const inputDoc = toInput(doc);
      const suggestions = generateRepairSuggestions(inputDoc);
      return { tool: TOOL_SUGGEST_CORRECTIONS, data: suggestions };
    },

    lookupDictionaryEntry(ctx, input) {
      const parsed = lookupInputSchema.parse(input);
      const entries =
        parsed.query.trim().toLowerCase() === "list"
          ? getDictionaryEntries(parsed.domain)
          : lookupDictionary(parsed.query, parsed.domain);
      return { tool: TOOL_LOOKUP_DICTIONARY, data: entries };
    },

    findSimilarDocuments(ctx, input) {
      const doc = findMockDocument(ctx.state, ctx.context, input.documentId);
      if (!doc) throw new OcrDocumentNotFoundError(input.documentId);
      const target = classifyDocument(toInput(doc));
      const matches: SimilarDocumentMatch[] = [];
      for (const other of ctx.state.documents) {
        if (other.id === doc.id) continue;
        const otherClass = classifyDocument(toInput(other));
        const similarity = computeSimilarity(target, otherClass);
        if (similarity >= 0.35) {
          matches.push({
            documentId: other.id,
            title: other.title,
            family: otherClass.family,
            similarity: Number(similarity.toFixed(2)),
            sharedSignals: target.matchedSignals.filter((s) => otherClass.matchedSignals.includes(s)),
            reason: `Shares ${target.matchedSignals.filter((s) => otherClass.matchedSignals.includes(s)).length} classification signal(s) with ${doc.title}.`,
          });
        }
      }
      matches.sort((a, b) => b.similarity - a.similarity || a.documentId.localeCompare(b.documentId));
      return { tool: TOOL_FIND_SIMILAR_DOCUMENTS, data: matches };
    },

    explainReviewReason(ctx, input) {
      const doc = findMockDocument(ctx.state, ctx.context, input.documentId);
      if (!doc) throw new OcrDocumentNotFoundError(input.documentId);
      const inputDoc = toInput(doc);
      const classification = classifyDocument(inputDoc);
      const quality = computeQualityScore(inputDoc, classification);
      const priority = evaluateReviewPriority({ quality, family: classification.family });
      const lines = [
        `${doc.title}: priority ${priority.priority} (${quality.level.toLowerCase()} quality).`,
        ...priority.reasons.map((r) => `- ${r}`),
      ];
      return { tool: TOOL_EXPLAIN_REVIEW_REASON, data: lines.join("\n") };
    },

    summarizeQuality(ctx, input) {
      const doc = findMockDocument(ctx.state, ctx.context, input.documentId);
      if (!doc) throw new OcrDocumentNotFoundError(input.documentId);
      const inputDoc = toInput(doc);
      const classification = classifyDocument(inputDoc);
      const quality = computeQualityScore(inputDoc, classification);
      const family = familyLabel(classification.family);
      const missing =
        quality.missingMandatoryFields.length > 0
          ? ` Missing: ${quality.missingMandatoryFields.join(", ")}.`
          : " No mandatory fields are missing.";
      return {
        tool: TOOL_SUMMARIZE_QUALITY,
        data: `${doc.title} reads as a ${family}. OCR quality ${quality.level.toLowerCase()} (${quality.overallQualityScore.toFixed(2)}), text coverage ${(quality.textCoverage * 100).toFixed(0)}%, field coverage ${(quality.fieldCoverage * 100).toFixed(0)}%.${missing}`,
      };
    },
  };
}

// ── Input validation for the gateway ─────────────────────────────────────────

export function validateOcrToolInput(
  toolName: string,
  input: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schemas: Record<string, z.ZodType> = {
    [TOOL_CLASSIFY_DOCUMENT]: classifyInputSchema,
    [TOOL_DETECT_QUALITY]: documentInputSchema,
    [TOOL_SUGGEST_CORRECTIONS]: documentInputSchema,
    [TOOL_LOOKUP_DICTIONARY]: lookupInputSchema,
    [TOOL_FIND_SIMILAR_DOCUMENTS]: documentInputSchema,
    [TOOL_EXPLAIN_REVIEW_REASON]: documentInputSchema,
    [TOOL_SUMMARIZE_QUALITY]: documentInputSchema,
  };
  const schema = schemas[toolName];
  if (!schema) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid input for ${toolName}: ${parsed.error.message}` };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

// ── Tool definitions for the assistant gateway ───────────────────────────────

const READ: "read" = "read";

function defineTool(
  name: string,
  description: string,
  category: "compliance" | "voyage" | "document" | "regulatory" | "fleet" | "notification",
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
): ToolDefinition {
  return { name, description, category, permission: READ, inputSchema, outputSchema, requiresConfirmation: false };
}

export const OCR_TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  defineTool(
    TOOL_CLASSIFY_DOCUMENT,
    "Classify a scanned document into a maritime document family from its content",
    "document",
    { type: "object", properties: { documentId: { type: "string" }, rawText: { type: "string" } } },
    { type: "object", properties: { family: { type: "string" }, confidence: { type: "number" } } },
  ),
  defineTool(
    TOOL_DETECT_QUALITY,
    "Detect OCR quality issues and compute a composite quality score for a document",
    "document",
    { type: "object", properties: { documentId: { type: "string" } } },
    {
      type: "object",
      properties: {
        qualityScore: { type: "number" },
        level: { type: "string" },
        issues: { type: "array", items: { type: "string" } },
      },
    },
  ),
  defineTool(
    TOOL_SUGGEST_CORRECTIONS,
    "Suggest deterministic OCR repair corrections (checksum, date, fuel, port, certificate spacing)",
    "document",
    { type: "object", properties: { documentId: { type: "string" } } },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string" },
          original: { type: "string" },
          suggested: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
  ),
  defineTool(
    TOOL_LOOKUP_DICTIONARY,
    "Look up a fuel, port, certificate, class society, vessel term or regulation in the OCR knowledge base",
    "regulatory",
    { type: "object", properties: { query: { type: "string" }, domain: { type: "string" } } },
    {
      type: "array",
      items: {
        type: "object",
        properties: { canonical: { type: "string" }, description: { type: "string" } },
      },
    },
  ),
  defineTool(
    TOOL_FIND_SIMILAR_DOCUMENTS,
    "Find documents classified with overlapping signals to a given document",
    "document",
    { type: "object", properties: { documentId: { type: "string" } } },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          documentId: { type: "string" },
          family: { type: "string" },
          similarity: { type: "number" },
        },
      },
    },
  ),
  defineTool(
    TOOL_EXPLAIN_REVIEW_REASON,
    "Explain why a document needs human review, with the derived priority reasons",
    "document",
    { type: "object", properties: { documentId: { type: "string" } } },
    { type: "object", properties: { priority: { type: "string" }, reasons: { type: "array", items: { type: "string" } } } },
  ),
  defineTool(
    TOOL_SUMMARIZE_QUALITY,
    "Summarize a document's OCR quality in one paragraph",
    "document",
    { type: "object", properties: { documentId: { type: "string" } } },
    { type: "object", properties: { summary: { type: "string" } } },
  ),
];

export type { OcrDocumentFamily };
