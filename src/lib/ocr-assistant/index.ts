export type {
  OcrAnswer,
  OcrClassification,
  OcrConfidenceBand,
  OcrContext,
  OcrDocumentFamily,
  OcrDocumentInput,
  OcrHandoff,
  OcrMemoryEntry,
  OcrMockDocument,
  OcrPageSignal,
  OcrQualityIssue,
  OcrQualityIssueType,
  OcrQualityLevel,
  OcrQualityRecord,
  OcrQualityScore,
  OcrRepairKind,
  OcrRepairSuggestion,
  OcrRequest,
  OcrReviewSuggestionRecord,
  OcrReviewSuggestionStatus,
  ReviewPriority,
  ReviewPriorityDecision,
  SimilarDocumentMatch,
} from "./types";

export {
  OCR_ASSISTANT_VERSION,
  OCR_DOCUMENT_FAMILIES,
  OCR_REVIEW_REQUIRED,
  OCR_SYSTEM_PROMPT_VERSION,
} from "./types";

export type { OcrMockState } from "./mock-data";
export {
  createOcrMockState,
  OCR_MOCK_DOCUMENTS,
  OCR_MOCK_NOW,
  pageSignal,
  toOcrDocumentInput,
} from "./mock-data";

export type {
  OcrToolContext,
  OcrToolRegistry,
  OcrToolResult,
  OcrQualityToolData,
} from "./ocr-tools";
export {
  createOcrToolRegistry,
  findMockDocument,
  OCR_TOOL_DEFINITIONS,
  OCR_TOOL_NAMES,
  OcrDocumentNotFoundError,
  OcrNoDocumentError,
  validateOcrToolInput,
  TOOL_CLASSIFY_DOCUMENT,
  TOOL_DETECT_QUALITY,
  TOOL_SUGGEST_CORRECTIONS,
  TOOL_LOOKUP_DICTIONARY,
  TOOL_FIND_SIMILAR_DOCUMENTS,
  TOOL_EXPLAIN_REVIEW_REASON,
  TOOL_SUMMARIZE_QUALITY,
} from "./ocr-tools";

export type { OcrService, OcrServiceOptions } from "./service";
export { createOcrService } from "./service";

export type { OcrSystemPromptInput } from "./system-prompt";
export { buildOcrSystemPrompt, describeReviewPriorityTaxonomy } from "./system-prompt";

export type { OcrHandoffDecision, OcrHandoffDetector, OcrReadinessItem, ComplianceOcrExplanationInput } from "./handoff";
export {
  captainOcrReadinessSummary,
  complianceOcrExplanation,
  createOcrHandoffDetector,
  searchOcrPhrases,
} from "./handoff";

export type { OcrSafetyCheck, OcrSafetyGuard } from "./safety";
export { createOcrSafetyGuard } from "./safety";

export type { OcrMemory } from "./memory";
export { createOcrMemory } from "./memory";
