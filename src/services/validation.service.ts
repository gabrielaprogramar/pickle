import type { ValidationProvider, ValidationReport, ValidationInput } from "@/lib/validation/types";
import type {
  ValidationReportRepository,
  AiExtractionRepository,
  DocumentRepository,
} from "@/lib/supabase";
import type { ValidationReportRow } from "@/lib/supabase/types";
import type { AiExtractionRow } from "@/lib/supabase/types";

export interface ValidationServiceOptions {
  readonly validationProvider: ValidationProvider;
  readonly reportRepo: ValidationReportRepository;
  readonly extractionRepo: AiExtractionRepository;
  readonly documentRepo: DocumentRepository;
}

export interface ValidationOutput {
  readonly report: ValidationReport;
  readonly persisted: ValidationReportRow;
  readonly latencyMs: number;
}

export interface ValidationService {
  validate(documentId: string): Promise<ValidationOutput>;
  getLatestValidation(documentId: string): Promise<ValidationReportRow | null>;
  listValidations(documentId: string): Promise<ValidationReportRow[]>;
}

export function createValidationService(
  opts: ValidationServiceOptions,
): ValidationService {
  const { validationProvider, reportRepo, extractionRepo, documentRepo } = opts;

  return {
    async validate(documentId: string): Promise<ValidationOutput> {
      const startTime = Date.now();

      const doc = await documentRepo.findById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const latestExtraction = await extractionRepo.findLatestCompletedByDocumentId(documentId);
      if (!latestExtraction) {
        throw new Error(`No completed AI extraction found for document ${documentId}. Run extraction first.`);
      }

      const validationInput: ValidationInput = {
        extractionConfidence: latestExtraction.confidence ?? 0,
        extractionFields: latestExtraction.fields ?? {},
        extractionSummary: latestExtraction.summary ?? "",
        extractionWarnings: latestExtraction.warnings ?? [],
        extractionMissingFields: latestExtraction.missing_fields ?? [],
        documentType: latestExtraction.document_type,
        ocrConfidence: 0,
      };

      const report = await validationProvider.validate(validationInput);

      const latencyMs = Date.now() - startTime;

      const persisted = await reportRepo.insert({
        document_id: documentId,
        extraction_id: latestExtraction.id,
        status: report.status,
        score: report.score,
        rule_results: report.ruleResults as unknown as unknown[],
        passed_count: report.passedCount,
        failed_count: report.failedCount,
        error_count: report.errorCount,
        warning_count: report.warningCount,
        blocking_issues: report.blockingIssues,
        recommended_review: report.recommendedReview,
        ready_for_review: report.readyForReview,
        validator_version: "1.0.0",
        latency_ms: latencyMs,
      });

      return { report, persisted, latencyMs };
    },

    async getLatestValidation(documentId: string): Promise<ValidationReportRow | null> {
      return reportRepo.findLatestByDocumentId(documentId);
    },

    async listValidations(documentId: string): Promise<ValidationReportRow[]> {
      return reportRepo.listByDocumentId(documentId);
    },
  };
}
