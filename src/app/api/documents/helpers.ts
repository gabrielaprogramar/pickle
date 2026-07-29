/**
 * api/documents/helpers.ts — shared service wiring for document API routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Every document API route needs the same set of repositories + services
 * injected. This helper creates them from the real Supabase client + storage +
 * OCR providers, or from injected fakes in tests.
 */

import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createDocumentRepository,
  createDocumentVersionRepository,
  createProcessingJobRepository,
  createOcrResultRepository,
  createDocumentEntityRepository,
  createProcessingLogRepository,
  createAiExtractionRepository,
  createValidationReportRepository,
} from "@/lib/supabase";
import { getStorageClient } from "@/lib/storage/client";
import { getOcrProvider } from "@/lib/ocr/provider";
import { getAiProvider } from "@/lib/ai/provider";
import { getValidationProvider } from "@/lib/validation/provider";
import {
  createDocumentService,
  createDocumentUploadService,
  createAiExtractionService,
  createValidationService,
} from "@/services";
import type { DocumentService } from "@/services/documents.service";
import type { AiExtractionService } from "@/services/ai-extraction.service";

/** Build a DocumentService from real providers (API route hot path). */
export function buildDocumentService(): DocumentService {
  const client = getSupabaseClient();
  const storageClient = getStorageClient();

  return createDocumentService({
    documentRepo: createDocumentRepository({ client }),
    versionRepo: createDocumentVersionRepository({ client }),
    jobRepo: createProcessingJobRepository({ client }),
    ocrResultRepo: createOcrResultRepository({ client }),
    entityRepo: createDocumentEntityRepository({ client }),
    logRepo: createProcessingLogRepository({ client }),
    extractionRepo: createAiExtractionRepository({ client }),
    storageClient,
  });
}

/** Build a DocumentUploadService from real providers (API route hot path). */
export function buildDocumentUploadService() {
  const client = getSupabaseClient();
  const storageClient = getStorageClient();
  const ocrProvider = getOcrProvider();

  return createDocumentUploadService({
    documentRepo: createDocumentRepository({ client }),
    versionRepo: createDocumentVersionRepository({ client }),
    jobRepo: createProcessingJobRepository({ client }),
    ocrResultRepo: createOcrResultRepository({ client }),
    entityRepo: createDocumentEntityRepository({ client }),
    logRepo: createProcessingLogRepository({ client }),
    storageClient,
    ocrProvider,
  });
}

/** Build an AiExtractionService from real providers (API route hot path). */
export function buildAiExtractionService(): AiExtractionService {
  const client = getSupabaseClient();
  const aiProvider = getAiProvider();

  return createAiExtractionService({
    aiProvider,
    extractionRepo: createAiExtractionRepository({ client }),
    ocrResultRepo: createOcrResultRepository({ client }),
    documentRepo: createDocumentRepository({ client }),
    logRepo: createProcessingLogRepository({ client }),
  });
}

/** Build a ValidationService from real providers (API route hot path). */
export function buildValidationService() {
  const client = getSupabaseClient();
  const validationProvider = getValidationProvider();

  return createValidationService({
    validationProvider,
    reportRepo: createValidationReportRepository({ client }),
    extractionRepo: createAiExtractionRepository({ client }),
    documentRepo: createDocumentRepository({ client }),
  });
}
