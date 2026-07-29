/**
 * validator.ts — assembles validation report from rule results
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Takes individual rule results from rules.ts and assembles them into a
 * complete ValidationReport with score, status, blocking issues, and
 * review recommendations. Shared by both mock and real validators.
 *
 * HOW IT FITS
 * The validator provider calls runAllRules() then assemblesReport().
 * The service persists the assembled report.
 */

import type {
  ValidationReport,
  ValidationStatus,
  ValidationRuleResult,
  ValidationInput,
  ValidationProvider,
} from "./types";
import { runAllRules } from "./rules";

const VALIDATOR_VERSION = "1.0.0";

/**
 * Assemble a complete ValidationReport from individual rule results.
 */
export function assembleReport(
  ruleResults: ValidationRuleResult[],
  input: ValidationInput,
): ValidationReport {
  const passedResults = ruleResults.filter((r) => r.passed);
  const failedResults = ruleResults.filter((r) => !r.passed);
  const errors = failedResults.filter((r) => r.severity === "error");
  const warnings = failedResults.filter((r) => r.severity === "warning");

  const totalRules = ruleResults.length;
  const passedCount = passedResults.length;
  const score = totalRules > 0
    ? Math.round((passedCount / totalRules) * 100)
    : 100;

  // Blocking issues: errors that prevent review readiness.
  const blockingIssues = errors.map(
    (r) => `[${r.ruleId}] ${r.message}`,
  );

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
  if (errors.length > 0) {
    status = "failed";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "passed";
  }

  const readyForReview = errors.length === 0;

  return {
    status,
    score,
    ruleResults,
    passedCount,
    failedCount: failedResults.length,
    errorCount: errors.length,
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

/** Validator version constant. */
export const VALIDATOR_VER = VALIDATOR_VERSION;
