import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  createOcrToolRegistry,
  validateOcrToolInput,
  OCR_TOOL_DEFINITIONS,
  OCR_TOOL_NAMES,
  OcrDocumentNotFoundError,
  OcrNoDocumentError,
  TOOL_CLASSIFY_DOCUMENT,
  TOOL_DETECT_QUALITY,
  TOOL_SUGGEST_CORRECTIONS,
  TOOL_LOOKUP_DICTIONARY,
  TOOL_FIND_SIMILAR_DOCUMENTS,
  TOOL_EXPLAIN_REVIEW_REASON,
  TOOL_SUMMARIZE_QUALITY,
} from "../ocr-tools";
import { createOcrMockState } from "../mock-data";
import type { OcrContext } from "../types";

describe("OCR Assistant — tool registry", () => {
  const registry = createOcrToolRegistry();
  const state = createOcrMockState();
  const context: OcrContext = { documentId: "ocr-doc-perfect-bdn" };

  it("classifies a document by id from content only", () => {
    const result = registry.classifyDocument({ context, state });
    expect(result.tool).toBe(TOOL_CLASSIFY_DOCUMENT);
    expect(result.data.family).toBe("BDN");
    expect(result.data.confidence).toBeGreaterThan(0.5);
  });

  it("classifies ad-hoc text without a stored document", () => {
    const result = registry.classifyDocument(
      { context, state },
      { rawText: "BUNKER DELIVERY NOTE\nFuel Type: VLSFO\nQuantity: 100 MT" },
    );
    expect(result.data.family).toBe("BDN");
  });

  it("resolves the document from the request context when no id is given", () => {
    const result = registry.detectQuality({ context, state }, { documentId: "ocr-doc-perfect-bdn" });
    expect(result.data.classification.family).toBe("BDN");
    expect(result.data.quality.level).toBe("HIGH");
    expect(result.data.priority.priority).toBe("LOW");
  });

  it("throws when no document is available", () => {
    let threw = false;
    let isOcrError = false;
    try {
      registry.classifyDocument({ context: {}, state });
    } catch (err) {
      threw = true;
      isOcrError = err instanceof OcrNoDocumentError;
    }
    expect(threw).toBe(true);
    expect(isOcrError).toBe(true);
  });

  it("throws OcrDocumentNotFoundError for an unknown id", () => {
    let threw = false;
    let isOcrError = false;
    try {
      registry.detectQuality({ context, state }, { documentId: "no-such-doc" });
    } catch (err) {
      threw = true;
      isOcrError = err instanceof OcrDocumentNotFoundError;
    }
    expect(threw).toBe(true);
    expect(isOcrError).toBe(true);
  });

  it("detects quality with classification, score and priority", () => {
    const result = registry.detectQuality({ context, state }, { documentId: "ocr-doc-unreadable-noon-report" });
    expect(result.data.quality.level).toBe("VERY_LOW");
    expect(result.data.priority.priority).toBe("CRITICAL");
    expect(result.data.quality.missingMandatoryFields.length).toBeGreaterThan(0);
  });

  it("suggests deterministic corrections for a defective scan", () => {
    const result = registry.suggestCorrections({ context, state }, { documentId: "ocr-doc-rotated-bdn" });
    expect(result.data.some((s) => s.kind === "IMO_CHECKSUM")).toBe(true);
    expect(result.data.some((s) => s.kind === "DATE_FORMAT")).toBe(true);
    expect(result.data.some((s) => s.kind === "FUEL_SPELLING")).toBe(true);
  });

  it("looks up dictionary entries by query", () => {
    const result = registry.lookupDictionaryEntry({ context, state }, { query: "VLSFO" });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.canonical).toBe("VLSFO");
  });

  it("lists dictionary entries with the 'list' sentinel", () => {
    const result = registry.lookupDictionaryEntry({ context, state }, { query: "list", domain: "fuel" });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((e) => e.kind === "fuel")).toBe(true);
  });

  it("finds similar documents by shared classification signals", () => {
    const result = registry.findSimilarDocuments({ context, state }, { documentId: "ocr-doc-wrong-type" });
    const perfect = result.data.find((m) => m.documentId === "ocr-doc-perfect-bdn");
    expect(perfect).toBeTruthy();
    expect(perfect && perfect.family).toBe("BDN");
    expect(result.data.every((m) => m.similarity > 0.3)).toBe(true);
  });

  it("explains the review reason with priority reasons", () => {
    const result = registry.explainReviewReason({ context, state }, { documentId: "ocr-doc-blurred-certificate" });
    expect(result.data.toLowerCase()).toContainString("priority");
    expect(result.data.toLowerCase()).toContainString("certificate");
  });

  it("summarizes quality in a single paragraph", () => {
    const result = registry.summarizeQuality({ context, state }, { documentId: "ocr-doc-perfect-bdn" });
    expect(result.data.toLowerCase()).toContainString("reads as a bunker delivery note");
    expect(result.data.toLowerCase()).toContainString("high");
  });

  it("validates tool inputs with Zod", () => {
    const good = validateOcrToolInput(TOOL_DETECT_QUALITY, { documentId: "ocr-doc-perfect-bdn" });
    expect(good.ok).toBe(true);
    const bad = validateOcrToolInput(TOOL_DETECT_QUALITY, {});
    expect(bad.ok).toBe(false);
    if (bad.ok === false) {
      expect(bad.error.length).toBeGreaterThan(0);
    }
    const unknown = validateOcrToolInput("not_a_tool", {});
    expect(unknown.ok).toBe(false);
  });

  it("exposes gateway-compatible read-only tool definitions", () => {
    expect(OCR_TOOL_DEFINITIONS.length).toBe(7);
    for (const def of OCR_TOOL_DEFINITIONS) {
      expect(def.permission).toBe("read");
      expect(def.requiresConfirmation).toBe(false);
      expect(def.inputSchema).toBeTruthy();
      expect(def.outputSchema).toBeTruthy();
    }
    for (const name of OCR_TOOL_NAMES) {
      expect(OCR_TOOL_DEFINITIONS.some((d) => d.name === name)).toBe(true);
    }
    expect(OCR_TOOL_NAMES.includes(TOOL_CLASSIFY_DOCUMENT)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_DETECT_QUALITY)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_SUGGEST_CORRECTIONS)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_LOOKUP_DICTIONARY)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_FIND_SIMILAR_DOCUMENTS)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_EXPLAIN_REVIEW_REASON)).toBe(true);
    expect(OCR_TOOL_NAMES.includes(TOOL_SUMMARIZE_QUALITY)).toBe(true);
  });
});

run();
