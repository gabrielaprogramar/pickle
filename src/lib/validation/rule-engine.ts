import type { ValidationRule, ValidationContext, ValidationRuleResult, ValidationCategory, IRuleRegistry } from "./types";

export type { ValidationRule, ValidationContext, IRuleRegistry };

/**
 * Default rule registry — the single source of truth for all validation rules.
 * Rules are registered by category and can be queried by document type.
 */
export class RuleRegistry implements IRuleRegistry {
  private readonly rules: Map<string, ValidationRule> = new Map();

  register(rule: ValidationRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with id "${rule.id}" is already registered.`);
    }
    this.rules.set(rule.id, rule);
  }

  registerMany(rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  getRulesForDocumentType(documentType: string): ValidationRule[] {
    const result: ValidationRule[] = [];
    for (const rule of this.rules.values()) {
      if (rule.appliesTo.length === 0 || rule.appliesTo.includes(documentType)) {
        result.push(rule);
      }
    }
    return result;
  }

  getAllRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  hasRule(ruleId: string): boolean {
    return this.rules.has(ruleId);
  }

  getRule(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }
}

/**
 * Create a simple validation rule inline.
 */
export function createRule(
  id: string,
  name: string,
  category: ValidationCategory,
  defaultSeverity: Exclude<import("./types").ValidationSeverity, null>,
  appliesTo: readonly string[],
  validateFn: (ctx: ValidationContext) => Pick<ValidationRuleResult, "passed" | "message" | "field">,
): ValidationRule {
  return {
    id,
    name,
    category,
    defaultSeverity,
    appliesTo,
    validate(ctx: ValidationContext): ValidationRuleResult {
      const result = validateFn(ctx);
      return {
        ruleId: id,
        ruleName: name,
        category,
        passed: result.passed,
        severity: result.passed ? null : defaultSeverity,
        message: result.message,
        field: result.field,
      };
    },
  };
}

/**
 * Build a ValidationContext from a generic input-like object.
 */
export function toValidationContext(input: {
  extractionFields: Record<string, unknown>;
  documentType: string;
  ocrConfidence: number;
  extractionConfidence: number;
  extractionSummary: string;
  extractionWarnings: string[];
  extractionMissingFields: string[];
}): ValidationContext {
  return {
    fields: input.extractionFields,
    documentType: input.documentType,
    ocrConfidence: input.ocrConfidence,
    extractionConfidence: input.extractionConfidence,
    extractionSummary: input.extractionSummary,
    extractionWarnings: input.extractionWarnings,
    extractionMissingFields: input.extractionMissingFields,
  };
}
