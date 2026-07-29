import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "@/lib/supabase/__tests__/_fakeClient";
import { createMockValidator } from "@/lib/validation/mock-validator";
import { createDocumentRepository } from "@/lib/supabase/repositories/documents";
import { createAiExtractionRepository } from "@/lib/supabase/repositories/ai_extractions";
import { createValidationReportRepository } from "@/lib/supabase/repositories/validation_reports";
import { createValidationService } from "../validation.service";
import type { ValidationProvider, ValidationReport } from "@/lib/validation/types";

const DOC_ID = "doc-uuid-001";
const EXTRACTION_ID = "ext-uuid-001";

function buildService(validatorOverride?: ValidationProvider) {
  const fake = createFakeSupabaseClient({
    tables: {
      documents: [
        {
          id: DOC_ID,
          vessel_id: "vessel-001",
          document_type: "imo_dcs",
          status: "extracted",
          title: "BDN June 2026",
          filename: "bdn.pdf",
          mime_type: "application/pdf",
          file_size: 1024,
          storage_path: "documents/bdn.pdf",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      ai_extractions: [
        {
          id: EXTRACTION_ID,
          document_id: DOC_ID,
          ocr_result_id: null,
          status: "completed",
          confidence: 0.95,
          summary: "BDN extraction complete",
          document_type: "imo_dcs",
          fields: { imoNumber: "9876543", fuelType: "VLSFO" },
          warnings: [],
          missing_fields: [],
          provider: "mock",
          model: "mock",
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          latency_ms: 500,
          error_message: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      validation_reports: [],
    },
  });

  const validator = validatorOverride ?? createMockValidator();

  return {
    service: createValidationService({
      validationProvider: validator,
      reportRepo: createValidationReportRepository({ client: fake }),
      extractionRepo: createAiExtractionRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
    }),
    fake,
  };
}

describe("ValidationService — validate", () => {
  it("completes full validation pipeline", async () => {
    const { service } = buildService();

    const result = await service.validate(DOC_ID);

    expect(result.report).toBeTruthy();
    expect(result.persisted).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThan(-1);
    expect(result.persisted.document_id).toBe(DOC_ID);
  });

  it("persists the validation report with correct score", async () => {
    const { service } = buildService();

    const result = await service.validate(DOC_ID);

    expect(result.persisted.score).toBe(100);
    expect(result.persisted.status).toBe("passed");
    expect(result.persisted.ready_for_review).toBe(true);
  });

  it("handles missing document gracefully", async () => {
    const { service } = buildService();

    await expect(async () =>
      service.validate("nonexistent-doc-id"),
    ).toThrow("Document not found");
  });

  it("handles missing extraction gracefully", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        documents: [
          {
            id: DOC_ID,
            vessel_id: null,
            document_type: "imo_dcs",
            status: "uploaded",
            title: "BDN",
            filename: "bdn.pdf",
            mime_type: "application/pdf",
            file_size: null,
            storage_path: "documents/bdn.pdf",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        ai_extractions: [],
        validation_reports: [],
      },
    });

    const service = createValidationService({
      validationProvider: createMockValidator(),
      reportRepo: createValidationReportRepository({ client: fake }),
      extractionRepo: createAiExtractionRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
    });

    await expect(async () =>
      service.validate(DOC_ID),
    ).toThrow("No completed AI extraction found");
  });

  it("uses real validator when provided", async () => {
    const realValidator: ValidationProvider = {
      async validate(): Promise<ValidationReport> {
        return {
          status: "passed",
          score: 85,
          ruleResults: [],
          passedCount: 10,
          failedCount: 2,
          errorCount: 0,
          warningCount: 2,
          blockingIssues: [],
          recommendedReview: ["Manual review recommended"],
          readyForReview: true,
        };
      },
    };

    const { service } = buildService(realValidator);
    const result = await service.validate(DOC_ID);

    expect(result.report.score).toBe(85);
    expect(result.report.status).toBe("passed");
  });
});

describe("ValidationService — getLatestValidation", () => {
  it("returns the latest validation report", async () => {
    const { service } = buildService();

    await service.validate(DOC_ID);
    const latest = await service.getLatestValidation(DOC_ID);

    expect(latest).toBeTruthy();
    expect(latest!.document_id).toBe(DOC_ID);
    expect(latest!.status).toBe("passed");
  });

  it("returns null when no validations exist", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        documents: [],
        ai_extractions: [],
        validation_reports: [],
      },
    });

    const service = createValidationService({
      validationProvider: createMockValidator(),
      reportRepo: createValidationReportRepository({ client: fake }),
      extractionRepo: createAiExtractionRepository({ client: fake }),
      documentRepo: createDocumentRepository({ client: fake }),
    });

    const latest = await service.getLatestValidation(DOC_ID);
    expect(latest).toBeNull();
  });
});

describe("ValidationService — listValidations", () => {
  it("returns all validations for a document", async () => {
    const { service } = buildService();

    await service.validate(DOC_ID);
    await service.validate(DOC_ID);

    const validations = await service.listValidations(DOC_ID);

    expect(validations.length).toBe(2);
  });

  it("returns empty array when no validations exist", async () => {
    const { service } = buildService();

    const validations = await service.listValidations(DOC_ID);

    expect(validations.length).toBe(0);
  });
});

run();
