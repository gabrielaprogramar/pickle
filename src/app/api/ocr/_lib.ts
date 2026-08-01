/**
 * api/ocr/_lib.ts — shared DI + mapping for the OCR Intelligence Assistant routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * The GET /api/ocr/quality, POST /api/ocr/review and POST /api/ocr/suggestions
 * routes all need the same deterministic OCR engine plus the three persistence
 * repositories (quality scores, review suggestions, review tasks). This module
 * wires them together from the real Supabase client, or from the in-memory
 * fake client for `?mock=true` and for route tests.
 */

import {
  createOcrHandoffDetector,
  createOcrMemory,
  createOcrMockState,
  createOcrSafetyGuard,
  createOcrService,
  createOcrToolRegistry,
  OCR_REVIEW_REQUIRED,
} from "@/lib/ocr-assistant";
import type {
  OcrQualityRecord,
  OcrReviewSuggestionRecord,
  OcrService,
  ReviewPriority,
} from "@/lib/ocr-assistant";
import { getSupabaseClient } from "@/lib/supabase";
import { createFakeSupabaseClient } from "@/lib/supabase/fake-client";
import { createOcrQualityScoreRepository } from "@/lib/supabase/repositories/ocr_quality_scores";
import type { OcrQualityScoreRepository } from "@/lib/supabase/repositories/ocr_quality_scores";
import { createOcrReviewSuggestionRepository } from "@/lib/supabase/repositories/ocr_review_suggestions";
import type { OcrReviewSuggestionRepository } from "@/lib/supabase/repositories/ocr_review_suggestions";
import { createReviewTaskRepository } from "@/lib/supabase/repositories/review_tasks";
import type { ReviewTaskRepository } from "@/lib/supabase/repositories/review_tasks";
import type {
  OcrQualityScoreInsert,
  OcrReviewSuggestionInsert,
  ReviewTaskPriority,
} from "@/lib/supabase/types";

export interface OcrApiDeps {
  readonly service: OcrService;
  readonly qualityRepo: OcrQualityScoreRepository;
  readonly suggestionRepo: OcrReviewSuggestionRepository;
  readonly reviewTaskRepo: ReviewTaskRepository;
}

function createEngine(): Pick<OcrApiDeps, "service"> {
  const state = createOcrMockState();
  const registry = createOcrToolRegistry();
  const service = createOcrService({
    state,
    registry,
    handoffDetector: createOcrHandoffDetector(),
    safetyGuard: createOcrSafetyGuard(),
    memory: createOcrMemory(),
    context: {},
  });
  return { service };
}

export function buildOcrApiDepsForClient(
  client: ReturnType<typeof getSupabaseClient>,
): OcrApiDeps {
  return {
    ...createEngine(),
    qualityRepo: createOcrQualityScoreRepository({ client }),
    suggestionRepo: createOcrReviewSuggestionRepository({ client }),
    reviewTaskRepo: createReviewTaskRepository({ client }),
  };
}

export function buildDefaultOcrApiDeps(): OcrApiDeps {
  return buildOcrApiDepsForClient(getSupabaseClient());
}

export function buildMockOcrApiDeps(): OcrApiDeps {
  return buildOcrApiDepsForClient(createFakeSupabaseClient());
}

export function isOcrQualityRecord(
  record: OcrQualityRecord | OcrReviewSuggestionRecord,
): record is OcrQualityRecord {
  return "overallQualityScore" in record;
}

export function isOcrSuggestionRecord(
  record: OcrQualityRecord | OcrReviewSuggestionRecord,
): record is OcrReviewSuggestionRecord {
  return "fieldKey" in record;
}

export function toQualityScoreInsert(record: OcrQualityRecord): OcrQualityScoreInsert {
  return {
    ocr_result_id: record.ocrResultId,
    document_id: record.documentId,
    detected_family: record.detectedFamily,
    overall_quality_score: record.overallQualityScore,
    level: record.level,
    page_quality: record.pageQuality,
    text_coverage: record.textCoverage,
    field_coverage: record.fieldCoverage,
    confidence_score: record.confidenceScore,
    confidence_distribution: { ...record.confidenceDistribution },
    issues: [...record.issues] as unknown[],
    missing_mandatory_fields: [...record.missingMandatoryFields],
  };
}

export function toSuggestionInserts(
  records: ReadonlyArray<OcrReviewSuggestionRecord>,
): OcrReviewSuggestionInsert[] {
  return records.map((r) => ({
    ocr_result_id: r.ocrResultId,
    document_id: r.documentId,
    field_key: r.fieldKey,
    kind: r.kind,
    original_value: r.originalValue,
    suggested_value: r.suggestedValue,
    confidence: r.confidence,
    reason: r.reason,
    priority: r.priority,
    status: r.status,
  }));
}

export function toReviewTaskPriority(priority: ReviewPriority): ReviewTaskPriority {
  switch (priority) {
    case "CRITICAL":
      return "urgent";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "normal";
    default:
      return "low";
  }
}

export { OCR_REVIEW_REQUIRED };
