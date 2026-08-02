/**
 * index.ts — public barrel export for the Services layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One clean import path:
 *
 *   import { createDocumentService, createDocumentUploadService, createAiExtractionService } from "@/services";
 */

export { createDocumentService } from "./documents.service";
export type { DocumentService, DocumentServiceOptions, DocumentStatusDetail } from "./documents.service";

export { createDocumentUploadService } from "./document-upload.service";
export type {
  DocumentUploadServiceOptions,
  DocumentUploadInput,
  DocumentUploadResult,
} from "./document-upload.service";

export { createAiExtractionService } from "./ai-extraction.service";
export type {
  AiExtractionServiceOptions,
  AiExtractionOutput,
  AiExtractionService,
} from "./ai-extraction.service";

export { createValidationService } from "./validation.service";
export type {
  ValidationServiceOptions,
  ValidationOutput,
  ValidationService,
} from "./validation.service";

export { createReviewService } from "./review.service";
export type {
  ReviewServiceOptions,
  ReviewTaskFilter,
  ReviewService,
} from "./review.service";

export {
  getNoonLatest,
  getNoonHistory,
  createNoonReport,
  evaluateNoonReport,
} from "./noon.service";
export type {
  NoonLatestResponse,
  NoonHistoryResponse,
  NoonCreateResponse,
  NoonEvaluateResponse,
} from "./noon.service";
