/**
 * documents.service.ts — document query/status service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Server-side orchestration for document reads, status transitions, and
 * download URL generation. Consumes repositories + storage client. Separated
 * from the upload service to keep each file focused on one responsibility.
 *
 * HOW IT FITS
 * The API routes call DocumentService methods. The service never touches
 * HTTP — it returns domain types and throws domain errors.
 */

import type {
  DocumentRepository,
  DocumentVersionRepository,
  ProcessingJobRepository,
  OcrResultRepository,
  DocumentEntityRepository,
  ProcessingLogRepository,
  AiExtractionRepository,
} from "@/lib/supabase";
import type {
  DocumentRow,
  DocumentVersionRow,
  ProcessingJobRow,
  OcrResultRow,
  DocumentEntityRow,
  ProcessingLogRow,
  AiExtractionRow,
} from "@/lib/supabase/types";
import type { StorageClient } from "@/lib/storage/types";

// ── Options ──────────────────────────────────────────────────────────────────

export interface DocumentServiceOptions {
  readonly documentRepo: DocumentRepository;
  readonly versionRepo: DocumentVersionRepository;
  readonly jobRepo: ProcessingJobRepository;
  readonly ocrResultRepo: OcrResultRepository;
  readonly entityRepo: DocumentEntityRepository;
  readonly logRepo: ProcessingLogRepository;
  readonly extractionRepo: AiExtractionRepository;
  readonly storageClient: StorageClient;
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface DocumentService {
  /** Get a document by ID. */
  getDocument(id: string): Promise<DocumentRow | null>;
  /** List documents, optionally filtered by vessel or type. */
  listDocuments(opts?: {
    vesselId?: string;
    documentType?: string;
  }): Promise<DocumentRow[]>;
  /** Get the full processing status for a document. */
  getDocumentStatus(id: string): Promise<DocumentStatusDetail | null>;
  /** Generate a signed download URL for the latest version of a document. */
  getDownloadUrl(id: string): Promise<{ url: string; expiresAt: string }>;
  /** Get all versions of a document. */
  getVersions(documentId: string): Promise<DocumentVersionRow[]>;
  /** Get all processing jobs for a document. */
  getJobs(documentId: string): Promise<ProcessingJobRow[]>;
  /** Get all OCR results for a document. */
  getOcrResults(documentId: string): Promise<OcrResultRow[]>;
  /** Get all extracted entities for a document. */
  getEntities(documentId: string): Promise<DocumentEntityRow[]>;
  /** Get all processing logs for a document. */
  getLogs(documentId: string): Promise<ProcessingLogRow[]>;
}

/** Comprehensive status detail for a document. */
export interface DocumentStatusDetail {
  readonly document: DocumentRow;
  readonly versions: DocumentVersionRow[];
  readonly jobs: ProcessingJobRow[];
  readonly ocrResults: OcrResultRow[];
  readonly latestJob: ProcessingJobRow | null;
  readonly aiExtractions: AiExtractionRow[];
  readonly latestAiExtraction: AiExtractionRow | null;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createDocumentService(
  opts: DocumentServiceOptions,
): DocumentService {
  const {
    documentRepo,
    versionRepo,
    jobRepo,
    ocrResultRepo,
    entityRepo,
    logRepo,
    extractionRepo,
    storageClient,
  } = opts;

  return {
    async getDocument(id: string): Promise<DocumentRow | null> {
      return documentRepo.findById(id);
    },

    async listDocuments(filter?: {
      vesselId?: string;
      documentType?: string;
    }): Promise<DocumentRow[]> {
      if (filter?.vesselId) {
        return documentRepo.listByVesselId(filter.vesselId);
      }
      if (filter?.documentType) {
        return documentRepo.listByType(filter.documentType as DocumentRow["document_type"]);
      }
      return documentRepo.listAll();
    },

    async getDocumentStatus(id: string): Promise<DocumentStatusDetail | null> {
      const doc = await documentRepo.findById(id);
      if (!doc) return null;

      const [versions, jobs, ocrResults, aiExtractions] = await Promise.all([
        versionRepo.listByDocumentId(id),
        jobRepo.listByDocumentId(id),
        ocrResultRepo.listByDocumentId(id),
        extractionRepo.listByDocumentId(id),
      ]);

      const latestJob = jobs.length > 0 ? jobs[0]! : null;
      const latestAiExtraction = aiExtractions.length > 0 ? aiExtractions[0]! : null;

      return {
        document: doc,
        versions,
        jobs,
        ocrResults,
        latestJob,
        aiExtractions,
        latestAiExtraction,
      };
    },

    async getDownloadUrl(
      id: string,
    ): Promise<{ url: string; expiresAt: string }> {
      const doc = await documentRepo.findById(id);
      if (!doc) {
        throw new Error(`Document not found: ${id}`);
      }

      const version = await versionRepo.findLatestByDocumentId(id);
      const path = version?.storage_path ?? doc.storage_path;
      const bucket = path.split("/")[0] ?? "documents";
      const key = path.split("/").slice(1).join("/");

      const result = await storageClient.createSignedUrl(bucket, key);
      return { url: result.url, expiresAt: result.expiresAt };
    },

    async getVersions(documentId: string): Promise<DocumentVersionRow[]> {
      return versionRepo.listByDocumentId(documentId);
    },

    async getJobs(documentId: string): Promise<ProcessingJobRow[]> {
      return jobRepo.listByDocumentId(documentId);
    },

    async getOcrResults(documentId: string): Promise<OcrResultRow[]> {
      return ocrResultRepo.listByDocumentId(documentId);
    },

    async getEntities(documentId: string): Promise<DocumentEntityRow[]> {
      return entityRepo.listByDocumentId(documentId);
    },

    async getLogs(documentId: string): Promise<ProcessingLogRow[]> {
      // Processing logs are per-job. We need to get all job IDs first,
      // then fetch logs for each. For simplicity, we'll fetch jobs first.
      const jobs = await jobRepo.listByDocumentId(documentId);
      const allLogs: ProcessingLogRow[] = [];
      for (const job of jobs) {
        const logs = await logRepo.listByJobId(job.id);
        allLogs.push(...logs);
      }
      return allLogs;
    },
  };
}
