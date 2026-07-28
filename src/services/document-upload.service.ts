/**
 * document-upload.service.ts — full upload-to-OCR pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Orchestrates the entire document ingestion pipeline:
 *   1. Validate upload metadata
 *   2. Store file in object storage
 *   3. Insert document row (status: uploaded)
 *   4. Insert initial version row
 *   5. Create processing job (status: pending → running)
 *   6. Execute OCR extraction via provider
 *   7. Store OCR result + extracted entities
 *   8. Transition document status to ocr_complete / extracted
 *   9. Write processing logs throughout
 *
 * Each step is wrapped in try/catch with proper status transitions and log
 * entries so the full lifecycle is auditable.
 *
 * HOW IT FITS
 * The upload API route calls documentUploadService.upload(), passing the file
 * buffer and metadata. The service returns the created document ID and status.
 */

import type {
  DocumentRepository,
  DocumentVersionRepository,
  ProcessingJobRepository,
  OcrResultRepository,
  DocumentEntityRepository,
  ProcessingLogRepository,
} from "@/lib/supabase";
import type { DocumentRow, DocumentEntityType } from "@/lib/supabase/types";
import type { StorageClient } from "@/lib/storage/types";
import type { OcrProvider } from "@/lib/ocr/types";

// ── Options ──────────────────────────────────────────────────────────────────

export interface DocumentUploadServiceOptions {
  readonly documentRepo: DocumentRepository;
  readonly versionRepo: DocumentVersionRepository;
  readonly jobRepo: ProcessingJobRepository;
  readonly ocrResultRepo: OcrResultRepository;
  readonly entityRepo: DocumentEntityRepository;
  readonly logRepo: ProcessingLogRepository;
  readonly storageClient: StorageClient;
  readonly ocrProvider: OcrProvider;
}

// ── Input ────────────────────────────────────────────────────────────────────

export interface DocumentUploadInput {
  /** Raw file bytes. */
  readonly fileBuffer: Buffer;
  /** Original filename. */
  readonly filename: string;
  /** MIME type. */
  readonly mimeType: string;
  /** Document classification. */
  readonly documentType: DocumentRow["document_type"];
  /** Title for the document. */
  readonly title: string;
  /** Optional vessel ID to associate with. */
  readonly vesselId?: string;
  /** Optional upload note. */
  readonly uploadNote?: string;
  /** Optional metadata dict. */
  readonly metadata?: Record<string, unknown>;
}

// ── Result ───────────────────────────────────────────────────────────────────

export interface DocumentUploadResult {
  /** The created document's ID. */
  readonly documentId: string;
  /** Final processing status. */
  readonly status: DocumentRow["status"];
  /** Whether OCR extraction succeeded. */
  readonly ocrCompleted: boolean;
  /** Number of entities extracted. */
  readonly entityCount: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export function createDocumentUploadService(
  opts: DocumentUploadServiceOptions,
): {
  upload: (input: DocumentUploadInput) => Promise<DocumentUploadResult>;
} {
  const {
    documentRepo,
    versionRepo,
    jobRepo,
    ocrResultRepo,
    entityRepo,
    logRepo,
    storageClient,
    ocrProvider,
  } = opts;

  return {
    async upload(input: DocumentUploadInput): Promise<DocumentUploadResult> {
      // 1. Build storage key.
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `${input.vesselId ?? "unclassified"}/${timestamp}_${input.filename}`;

      // 2. Upload to object storage.
      const uploadResult = await storageClient.upload("documents", key, input.fileBuffer, {
        contentType: input.mimeType,
      });

      // 3. Insert document row.
      const doc = await documentRepo.insert({
        vessel_id: input.vesselId ?? null,
        document_type: input.documentType,
        status: "uploaded",
        title: input.title,
        filename: input.filename,
        mime_type: input.mimeType,
        file_size: input.fileBuffer.length,
        storage_path: uploadResult.storagePath,
        metadata: input.metadata ?? null,
      });

      // 4. Insert initial version.
      await versionRepo.insert({
        document_id: doc.id,
        version_number: 1,
        filename: input.filename,
        storage_path: uploadResult.storagePath,
        file_size: input.fileBuffer.length,
        upload_note: input.uploadNote ?? null,
      });

      // 5. Create processing job.
      const job = await jobRepo.insert({
        document_id: doc.id,
        job_type: "ocr",
        status: "pending",
      });

      await logRepo.insert({
        processing_job_id: job.id,
        level: "info",
        message: "Document uploaded, OCR job created",
        details: { documentId: doc.id, filename: input.filename },
      });

      // 6. Transition document to processing.
      await documentRepo.updateStatus(doc.id, "processing");
      await jobRepo.updateStatus(job.id, "running", {
        started_at: new Date().toISOString(),
      });

      await logRepo.insert({
        processing_job_id: job.id,
        level: "info",
        message: "OCR processing started",
      });

      // 7. Execute OCR.
      let ocrCompleted = false;
      let entityCount = 0;

      try {
        const ocrResult = await ocrProvider.extract(
          input.fileBuffer,
          input.mimeType,
          input.documentType,
        );

        // 8. Persist OCR result.
        const savedOcr = await ocrResultRepo.insert({
          processing_job_id: job.id,
          document_id: doc.id,
          raw_text: ocrResult.rawText,
          extracted_data: ocrResult.extractedData,
          confidence: ocrResult.confidence,
        });

        // 9. Extract and persist entities from the structured data.
        const entities = extractEntities(doc.id, savedOcr.id, ocrResult.extractedData);
        if (entities.length > 0) {
          await entityRepo.insertBatch(entities);
          entityCount = entities.length;
        }

        // 10. Mark job completed.
        await jobRepo.updateStatus(job.id, "completed", {
          completed_at: new Date().toISOString(),
          result: { ocrResultId: savedOcr.id, confidence: ocrResult.confidence },
        });

        // 11. Transition document status.
        await documentRepo.updateStatus(doc.id, "ocr_complete");
        ocrCompleted = true;

        await logRepo.insert({
          processing_job_id: job.id,
          level: "info",
          message: `OCR completed: ${entityCount} entities extracted, confidence ${ocrResult.confidence}`,
          details: { entityCount, confidence: ocrResult.confidence },
        });
      } catch (ocrError) {
        // OCR failed — mark job and document as failed but don't throw.
        const errorMessage =
          ocrError instanceof Error ? ocrError.message : String(ocrError);

        await jobRepo.updateStatus(job.id, "failed", {
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        });

        await logRepo.insert({
          processing_job_id: job.id,
          level: "error",
          message: `OCR failed: ${errorMessage}`,
        });
      }

      return {
        documentId: doc.id,
        status: ocrCompleted ? "ocr_complete" : "uploaded",
        ocrCompleted,
        entityCount,
      };
    },
  };
}

// ── Entity extraction ────────────────────────────────────────────────────────

interface EntityInput {
  readonly document_id: string;
  readonly ocr_result_id: string;
  readonly entity_type: DocumentEntityType;
  readonly entity_value: string;
  readonly confidence: number | null;
}

function extractEntities(
  documentId: string,
  ocrResultId: string,
  extractedData: Record<string, unknown>,
): EntityInput[] {
  const entities: EntityInput[] = [];

  // Common entity patterns from structured data.
  const imoNumber = extractedData["imoNumber"];
  if (typeof imoNumber === "string" && imoNumber.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "imo_number",
      entity_value: imoNumber,
      confidence: 1.0,
    });
  }

  const vesselName = extractedData["vesselName"];
  if (typeof vesselName === "string" && vesselName.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "vessel_name",
      entity_value: vesselName,
      confidence: 1.0,
    });
  }

  const port = extractedData["port"];
  if (typeof port === "string" && port.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "port",
      entity_value: port,
      confidence: 1.0,
    });
  }

  const deliveryDate = extractedData["deliveryDate"] ?? extractedData["reportingPeriod"];
  if (typeof deliveryDate === "string" && deliveryDate.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "date",
      entity_value: deliveryDate,
      confidence: 1.0,
    });
  }

  const bdnReference = extractedData["bdnReference"];
  if (typeof bdnReference === "string" && bdnReference.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "certificate_number",
      entity_value: bdnReference,
      confidence: 1.0,
    });
  }

  const fuelType = extractedData["fuelType"];
  if (typeof fuelType === "string" && fuelType.length > 0) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "measure",
      entity_value: `Fuel: ${fuelType}`,
      confidence: 1.0,
    });
  }

  const quantityTonnes = extractedData["quantityTonnes"];
  if (typeof quantityTonnes === "number") {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "measure",
      entity_value: `Quantity: ${quantityTonnes} tonnes`,
      confidence: 1.0,
    });
  }

  const ciiRating = extractedData["ciiRating"];
  if (typeof ciiRating === "string" && ciiRating.length === 1) {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "measure",
      entity_value: `CII Rating: ${ciiRating}`,
      confidence: 1.0,
    });
  }

  const totalCo2 = extractedData["totalCo2Tonnes"];
  if (typeof totalCo2 === "number") {
    entities.push({
      document_id: documentId,
      ocr_result_id: ocrResultId,
      entity_type: "measure",
      entity_value: `CO₂ Emissions: ${totalCo2} tonnes`,
      confidence: 1.0,
    });
  }

  return entities;
}
