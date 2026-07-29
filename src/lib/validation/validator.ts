import type {
  ValidationReport,
  ValidationStatus,
  ValidationRuleResult,
  ValidationInput,
  ValidationProvider,
  ValidationContext,
} from "./types";
import { RULE_REGISTRY, runAllRules } from "./rules";

const VALIDATOR_VERSION = "2.0.0";

/**
 * Compute a weighted final confidence from OCR, AI extraction, and validation scores.
 *
 * Weights:
 *   OCR confidence:              20%
 *   AI extraction confidence:    50%
 *   Validation pass rate:        30%
 */
export function computeWeightedConfidence(
  ocrConfidence: number,
  extractionConfidence: number,
  validationScore: number,
): number {
  const validationConfidence = validationScore / 100;
  return Math.round(
    (ocrConfidence * 0.2 + extractionConfidence * 0.5 + validationConfidence * 0.3) * 1000,
  ) / 1000;
}

/**
 * Assemble a complete ValidationReport from individual rule results.
 */
export function assembleReport(
  ruleResults: ValidationRuleResult[],
  input: ValidationInput,
): ValidationReport {
  const passedResults = ruleResults.filter((r) => r.passed);
  const failedResults = ruleResults.filter((r) => !r.passed);
  const blockingErrors = failedResults.filter((r) => r.severity === "blocking");
  const errors = failedResults.filter((r) => r.severity === "error");
  const warnings = failedResults.filter((r) => r.severity === "warning");
  const infos = failedResults.filter((r) => r.severity === "info");

  const totalRules = ruleResults.length;
  const passedCount = passedResults.length;
  const score = totalRules > 0
    ? Math.round((passedCount / totalRules) * 100)
    : 100;

  // Blocking issues: blocking severity issues + errors
  const blockingIssues = [
    ...blockingErrors.map((r) => `[${r.ruleId}] ${r.message}`),
    ...errors.map((r) => `[${r.ruleId}] ${r.message}`),
  ];

  // Recommended human review reasons.
  const recommendedReview: string[] = [];
  if (warnings.length > 0) {
    recommendedReview.push(
      `${warnings.length} warning(s) require manual review`,
    );
  }
  if (input.ocrConfidence < 0.7) {
    recommendedReview.push("Low OCR confidence — manual verification recommended");
  }
  if (input.extractionConfidence < 0.6) {
    recommendedReview.push("Low AI confidence — manual verification recommended");
  }
  if (input.extractionMissingFields.length > 0) {
    recommendedReview.push(
      `${input.extractionMissingFields.length} field(s) could not be extracted`,
    );
  }

  // Overall status.
  let status: ValidationStatus;
  if (blockingErrors.length > 0 || errors.length > 0) {
    status = "failed";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "passed";
  }

  const readyForReview = blockingErrors.length === 0 && errors.length === 0;

  return {
    status,
    score,
    ruleResults,
    passedCount,
    failedCount: failedResults.length,
    errorCount: blockingErrors.length + errors.length,
    warningCount: warnings.length,
    blockingIssues,
    recommendedReview,
    readyForReview,
  };
}

/**
 * Create a real validation provider that runs all rules.
 */
export function createValidator(): ValidationProvider {
  return {
    async validate(input: ValidationInput): Promise<ValidationReport> {
      const ruleResults = runAllRules(input);
      return assembleReport(ruleResults, input);
    },
  };
}

/**
 * Create a validation provider with confidence-weighted final score.
 * The score reflects a blend of OCR, AI, and validation pass rate.
 */
export function createWeightedValidator(): ValidationProvider {
  return {
    async validate(input: ValidationInput): Promise<ValidationReport> {
      const ctx: ValidationContext = {
        fields: input.extractionFields,
        documentType: input.documentType,
        ocrConfidence: input.ocrConfidence,
        extractionConfidence: input.extractionConfidence,
        extractionSummary: input.extractionSummary,
        extractionWarnings: input.extractionWarnings,
        extractionMissingFields: input.extractionMissingFields,
      };
      const rules = RULE_REGISTRY.getRulesForDocumentType(input.documentType);
      const ruleResults = rules.map((rule) => {
        const result = rule.validate(ctx);
        if (!result.passed && result.severity === null) {
          return { ...result, severity: "warning" as const };
        }
        return result;
      });

      const baseReport = assembleReport(ruleResults, input);

      const weightedScore = Math.round(
        computeWeightedConfidence(
          input.ocrConfidence,
          input.extractionConfidence,
          baseReport.score,
        ) * 100,
      );

      return {
        ...baseReport,
        score: weightedScore,
      };
    },
  };
}

/** Validator version constant. */
export const VALIDATOR_VER = VALIDATOR_VERSION;
