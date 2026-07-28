/**
 * ai-extraction.service.ts — orchestrates AI extraction for documents
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Bridges the AI provider with the persistence layer. Takes OCR output,
 * feeds it through the AI provider, and stores the structured result.
 * Handles the full lifecycle: pending → completed/failed, with audit logging.
 *
 * HOW IT FITS
 * The extract API route calls this service. The service never touches HTTP —
 * it returns domain types and throws domain errors.
 */

import type { AiProvider, AiExtractionResult } from "@/lib/ai/types";
import type {
  AiExtractionRepository,
  OcrResultRepository,
  DocumentRepository,
  ProcessingLogRepository,
} from "@/lib/supabase";
import type {
  AiExtractionRow,
  AiExtractionInsert,
  OcrResultRow,
} from "@/lib/supabase/types";

// ── Options ──────────────────────────────────────────────────────────────────

export interface AiExtractionServiceOptions {
  readonly aiProvider: AiProvider;
  readonly extractionRepo: AiExtractionRepository;
  readonly ocrResultRepo: OcrResultRepository;
  readonly documentRepo: DocumentRepository;
  readonly logRepo: ProcessingLogRepository;
}

// ── Result ───────────────────────────────────────────────────────────────────

export interface AiExtractionOutput {
  /** The created extraction record. */
  readonly extraction: AiExtractionRow;
  /** The AI extraction result (fields, summary, etc.). */
  readonly result: AiExtractionResult;
  /** Whether the extraction completed successfully. */
  readonly success: boolean;
  /** Provider metadata. */
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface AiExtractionService {
  /**
   * Run AI extraction on a document's OCR results.
   * @param documentId - The document to extract from.
   * @param ocrResultId - Optional specific OCR result to use. If omitted,
   *                       uses the latest OCR result for the document.
   * @returns The extraction output.
   */
  extract(
    documentId: string,
    ocrResultId?: string,
  ): Promise<AiExtractionOutput>;

  /**
   * Get the latest AI extraction for a document.
   */
  getLatestExtraction(
    documentId: string,
  ): Promise<AiExtractionRow | null>;

  /**
   * Get all AI extractions for a document.
   */
  listExtractions(documentId: string): Promise<AiExtractionRow[]>;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createAiExtractionService(
  opts: AiExtractionServiceOptions,
): AiExtractionService {
  const {
    aiProvider,
    extractionRepo,
    ocrResultRepo,
    documentRepo,
    logRepo,
  } = opts;

  return {
    async extract(
      documentId: string,
      ocrResultId?: string,
    ): Promise<AiExtractionOutput> {
      const startTime = Date.now();

      // 1. Find the document.
      const doc = await documentRepo.findById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // 2. Find the OCR result to use.
      let ocrResult: OcrResultRow | null = null;
      if (ocrResultId) {
        ocrResult = await ocrResultRepo.findById(ocrResultId);
      } else {
        // Use the latest OCR result for this document.
        const results = await ocrResultRepo.listByDocumentId(documentId);
        ocrResult = results.length > 0 ? results[0]! : null;
      }

      if (!ocrResult) {
        throw new Error(
          `No OCR result found for document ${documentId}. Run OCR first.`,
        );
      }

      // 3. Create pending extraction record.
      const extraction = await extractionRepo.insert({
        document_id: documentId,
        ocr_result_id: ocrResult.id,
        status: "pending",
        document_type: doc.document_type,
        provider: "pending",
        model: "pending",
      });

      // 4. Write processing log.
      await logRepo.insert({
        processing_job_id: "00000000-0000-0000-0000-000000000000",
        level: "info",
        message: `AI extraction started for document ${documentId}`,
        details: {
          extractionId: extraction.id,
          documentType: doc.document_type,
          ocrConfidence: ocrResult.confidence,
        },
      });

      // 5. Run AI extraction.
      try {
        const aiResult = await aiProvider.extract({
          rawText: ocrResult.raw_text,
          ocrConfidence: ocrResult.confidence ?? 0,
          documentType: doc.document_type,
          title: doc.title,
        });

        const latencyMs = Date.now() - startTime;

        // 6. Update the extraction record with results.
        const updated = await extractionRepo.update(extraction.id, {
          status: "completed",
          confidence: aiResult.confidence,
          summary: aiResult.summary,
          fields: aiResult.fields,
          warnings: aiResult.warnings,
          missing_fields: aiResult.missingFields,
          provider: "openai",
          model: "gpt-4o",
          prompt_tokens: aiResult.usage?.promptTokens ?? null,
          completion_tokens: aiResult.usage?.completionTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          latency_ms: latencyMs,
        });

        // 7. Write success log.
        await logRepo.insert({
          processing_job_id: "00000000-0000-0000-0000-000000000000",
          level: "info",
          message: `AI extraction completed: confidence ${aiResult.confidence.toFixed(2)}, ${Object.keys(aiResult.fields).length} fields extracted`,
          details: {
            extractionId: updated.id,
            confidence: aiResult.confidence,
            fieldCount: Object.keys(aiResult.fields).length,
            warnings: aiResult.warnings,
            latencyMs,
          },
        });

        return {
          extraction: updated,
          result: aiResult,
          success: true,
          provider: "openai",
          model: "gpt-4o",
          latencyMs,
        };
      } catch (aiError) {
        const latencyMs = Date.now() - startTime;
        const errorMessage =
          aiError instanceof Error ? aiError.message : String(aiError);

        // Mark extraction as failed.
        await extractionRepo.updateStatus(extraction.id, "failed", {
          error_message: errorMessage,
        });

        // Write error log.
        await logRepo.insert({
          processing_job_id: "00000000-0000-0000-0000-000000000000",
          level: "error",
          message: `AI extraction failed: ${errorMessage}`,
          details: {
            extractionId: extraction.id,
            error: errorMessage,
            latencyMs,
          },
        });

        return {
          extraction: await extractionRepo.findById(extraction.id) ?? extraction,
          result: {
            confidence: 0,
            summary: `AI extraction failed: ${errorMessage}`,
            documentType: doc.document_type,
            fields: {},
            warnings: [errorMessage],
            missingFields: [],
            usage: null,
          },
          success: false,
          provider: "openai",
          model: "gpt-4o",
          latencyMs,
        };
      }
    },

    async getLatestExtraction(
      documentId: string,
    ): Promise<AiExtractionRow | null> {
      return extractionRepo.findLatestCompletedByDocumentId(documentId);
    },

    async listExtractions(documentId: string): Promise<AiExtractionRow[]> {
      return extractionRepo.listByDocumentId(documentId);
    },
  };
}
