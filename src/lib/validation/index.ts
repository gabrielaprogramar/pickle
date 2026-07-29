/**
 * index.ts — public barrel export for the Validation module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One clean import path for everything downstream:
 *
 *   import { getValidationProvider, ValidationReport } from "@/lib/validation";
 */

// Provider factory.
export { getValidationProvider, createValidationProvider } from "./provider";
export type { ValidationProvider } from "./types";

// Types.
export type {
  ValidationInput,
  ValidationReport,
  ValidationStatus,
  ValidationCategory,
  ValidationSeverity,
  ValidationRuleResult,
  ValidatorMetadata,
} from "./types";

// Validator engine.
export { createValidator, assembleReport, VALIDATOR_VER } from "./validator";

// Rules engine.
export { runAllRules, ALL_RULES } from "./rules";

// Mock provider (exported for tests).
export { createMockValidator, MOCK_VALIDATION_FIXTURES } from "./mock-validator";

// Rule engine.
export { RuleRegistry, createRule, toValidationContext } from "./rule-engine";
export type { IRuleRegistry } from "./rule-engine";
