/**
 * types.ts — Validation engine types and result shapes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Defines the validator contract and the structured validation result type.
 * The validation pipeline takes an AI extraction result and checks it for
 * structural completeness, maritime data consistency, and confidence quality.
 * It does NOT perform regulatory compliance — only data quality assessment.
 *
 * HOW IT FITS
 * The mock validator (mock-validator.ts) and the real validator (validator.ts)
 * implement ValidationProvider. The validation service calls
 * validator.validate() and persists the result.
 */

// ── Validation Categories ────────────────────────────────────────────────────

/** Categories of validation rules. */
export type ValidationCategory =
  | "structural"
  | "maritime"
  | "confidence";

// ── Severity Levels ──────────────────────────────────────────────────────────

/** Severity of a validation finding. */
export type ValidationSeverity =
  | "blocking"
  | "error"
  | "warning"
  | "info";

// ── Individual Rule Result ───────────────────────────────────────────────────

/** Result of a single validation rule check. */
export interface ValidationRuleResult {
  /** Unique rule identifier (e.g. "structural.required_field"). */
  readonly ruleId: string;
  /** Human-readable rule name. */
  readonly ruleName: string;
  /** The category this rule belongs to. */
  readonly category: ValidationCategory;
  /** Whether the rule passed. */
  readonly passed: boolean;
  /** Severity if the rule failed (null when passed). */
  readonly severity: ValidationSeverity | null;
  /** Human-readable message describing the finding. */
  readonly message: string;
  /** Optional field name this finding relates to. */
  readonly field?: string;
  /** Confidence score 0–1 for this specific rule result (optional). */
  readonly ruleConfidence?: number;
  /** Remediation guidance for fixing the issue (optional). */
  readonly remediation?: string;
}

/** Input for cross-document validation. */
export interface CrossDocumentInput {
  readonly extractions: ValidationInput[];
  readonly vesselImo?: string;
}

/** Result of a cross-document validation check. */
export interface CrossDocumentValidationResult {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly passed: boolean;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly remediation?: string;
  readonly ruleConfidence?: number;
}

// ── Validation Report ────────────────────────────────────────────────────────

/** Overall status of a validation report. */
export type ValidationStatus =
  | "passed"
  | "warning"
  | "failed"
  | "error";

/** Complete validation report for a document extraction. */
export interface ValidationReport {
  /** Overall validation status. */
  readonly status: ValidationStatus;
  /** Numeric score 0–100 (100 = all rules passed). */
  readonly score: number;
  /** All rule results (passed + failed). */
  readonly ruleResults: ValidationRuleResult[];
  /** Count of passed rules. */
  readonly passedCount: number;
  /** Count of failed rules (warnings + errors). */
  readonly failedCount: number;
  /** Count of blocking errors. */
  readonly errorCount: number;
  /** Count of warnings. */
  readonly warningCount: number;
  /** Blocking issues that prevent review readiness. */
  readonly blockingIssues: string[];
  /** Recommended human review reasons. */
  readonly recommendedReview: string[];
  /** Whether the extraction is ready for human review. */
  readonly readyForReview: boolean;
}

// ── Validator Input ──────────────────────────────────────────────────────────

/** Input to the validation provider. */
export interface ValidationInput {
  /** The AI extraction result to validate. */
  readonly extractionConfidence: number;
  readonly extractionFields: Record<string, unknown>;
  readonly extractionSummary: string;
  readonly extractionWarnings: string[];
  readonly extractionMissingFields: string[];
  /** The document type. */
  readonly documentType: string;
  /** OCR confidence from the original scan. */
  readonly ocrConfidence: number;
}

// ── Provider Contract ────────────────────────────────────────────────────────

/** The validation provider contract. Both mock and real implement this. */
export interface ValidationProvider {
  /**
   * Validate an AI extraction result.
   * @param input - The extraction data to validate.
   * @returns The complete validation report.
   */
  validate(input: ValidationInput): Promise<ValidationReport>;
}

// ── Validator Metadata ───────────────────────────────────────────────────────

/** Metadata about the validator run. */
export interface ValidatorMetadata {
  readonly validatorVersion: string;
  readonly latencyMs: number;
}

// ── Rule Engine Interfaces ───────────────────────────────────────────────────

/** Context passed to every validation rule. */
export interface ValidationContext {
  readonly fields: Record<string, unknown>;
  readonly documentType: string;
  readonly ocrConfidence: number;
  readonly extractionConfidence: number;
  readonly extractionSummary: string;
  readonly extractionWarnings: string[];
  readonly extractionMissingFields: string[];
}

/** A single validation rule. */
export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly category: ValidationCategory;
  readonly defaultSeverity: Exclude<ValidationSeverity, null>;
  /** Document types this rule applies to. Empty array means all types. */
  readonly appliesTo: readonly string[];
  validate(context: ValidationContext): ValidationRuleResult;
}

/** Registry of validation rules, queryable by document type. */
export interface IRuleRegistry {
  register(rule: ValidationRule): void;
  registerMany(rules: ValidationRule[]): void;
  getRulesForDocumentType(documentType: string): ValidationRule[];
  getAllRules(): ValidationRule[];
}
