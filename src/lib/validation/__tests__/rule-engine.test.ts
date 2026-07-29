import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { RuleRegistry, createRule, toValidationContext } from "../rule-engine";
import type { ValidationContext, ValidationRule } from "../types";

describe("RuleRegistry", () => {
  it("registers and retrieves a rule", () => {
    const registry = new RuleRegistry();
    const rule: ValidationRule = {
      id: "test.rule1",
      name: "Test Rule",
      category: "structural",
      defaultSeverity: "error",
      appliesTo: [],
      validate: () => ({ passed: true, message: "ok", ruleId: "test.rule1", ruleName: "Test Rule", category: "structural", severity: null }),
    };
    registry.register(rule);
    expect(registry.getRule("test.rule1")).toBe(rule);
    expect(registry.hasRule("test.rule1")).toBe(true);
  });

  it("registers many rules at once", () => {
    const registry = new RuleRegistry();
    registry.registerMany([
      makeRule("r1"),
      makeRule("r2"),
      makeRule("r3"),
    ]);
    expect(registry.getAllRules().length).toBe(3);
  });

  it("throws when registering a duplicate rule id", () => {
    const registry = new RuleRegistry();
    registry.register(makeRule("dup"));
    expect(() => registry.register(makeRule("dup"))).toThrow("already registered");
  });

  it("returns rules that apply to a specific document type", () => {
    const registry = new RuleRegistry();
    const general = makeRule("general", [], () => ({ passed: true, message: "g", ruleId: "general", ruleName: "G", category: "maritime", severity: null }));
    const specific = makeRule("specific", ["imo_dcs"], () => ({ passed: true, message: "s", ruleId: "specific", ruleName: "S", category: "maritime", severity: null }));
    const other = makeRule("other", ["eu_mrv"], () => ({ passed: true, message: "o", ruleId: "other", ruleName: "O", category: "maritime", severity: null }));
    registry.registerMany([general, specific, other]);

    const forBdn = registry.getRulesForDocumentType("imo_dcs");
    const ids = forBdn.map((r) => r.id).sort();
    expect(ids).toEqual(["general", "specific"]);
  });

  it("getAllRules returns all registered rules", () => {
    const registry = new RuleRegistry();
    registry.registerMany([makeRule("a"), makeRule("b")]);
    expect(registry.getAllRules().length).toBe(2);
  });

  it("getRule returns undefined for unknown id", () => {
    const registry = new RuleRegistry();
    expect(registry.getRule("nonexistent")).toBe(undefined);
  });

  it("hasRule returns false for unknown id", () => {
    const registry = new RuleRegistry();
    expect(registry.hasRule("nonexistent")).toBe(false);
  });
});

describe("createRule", () => {
  it("creates a rule with correct metadata", () => {
    const rule = createRule("test.id", "Test Name", "maritime", "error", ["imo_dcs"], () => ({
      passed: true,
      message: "Everything is fine",
      field: "imoNumber",
    }));
    expect(rule.id).toBe("test.id");
    expect(rule.name).toBe("Test Name");
    expect(rule.category).toBe("maritime");
    expect(rule.defaultSeverity).toBe("error");
    expect(rule.appliesTo).toEqual(["imo_dcs"]);
  });

  it("returns passed result with severity null", () => {
    const rule = createRule("pass", "Pass", "confidence", "warning", [], () => ({
      passed: true,
      message: "ok",
    }));
    const ctx = makeContext();
    const result = rule.validate(ctx);
    expect(result.passed).toBe(true);
    expect(result.severity).toBeNull();
    expect(result.message).toBe("ok");
  });

  it("returns failed result with default severity", () => {
    const rule = createRule("fail", "Fail", "structural", "error", [], () => ({
      passed: false,
      message: "failed",
      field: "imoNumber",
    }));
    const ctx = makeContext();
    const result = rule.validate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toBe("failed");
    expect(result.field).toBe("imoNumber");
  });

  it("sets severity to blocking when specified", () => {
    const rule = createRule("block", "Block", "structural", "blocking", [], () => ({
      passed: false,
      message: "blocked",
    }));
    const result = rule.validate(makeContext());
    expect(result.severity).toBe("blocking");
  });

  it("sets severity to info when specified", () => {
    const rule = createRule("inf", "Info", "confidence", "info", [], () => ({
      passed: false,
      message: "info item",
    }));
    const result = rule.validate(makeContext());
    expect(result.severity).toBe("info");
  });
});

describe("toValidationContext", () => {
  it("maps input fields to context correctly", () => {
    const ctx = toValidationContext({
      extractionFields: { imoNumber: "1234567" },
      documentType: "imo_dcs",
      ocrConfidence: 0.9,
      extractionConfidence: 0.85,
      extractionSummary: "test",
      extractionWarnings: ["warn1"],
      extractionMissingFields: ["field1"],
    });
    expect(ctx.fields).toEqual({ imoNumber: "1234567" });
    expect(ctx.documentType).toBe("imo_dcs");
    expect(ctx.ocrConfidence).toBe(0.9);
    expect(ctx.extractionConfidence).toBe(0.85);
    expect(ctx.extractionSummary).toBe("test");
    expect(ctx.extractionWarnings).toEqual(["warn1"]);
    expect(ctx.extractionMissingFields).toEqual(["field1"]);
  });

  it("handles empty fields", () => {
    const ctx = toValidationContext({
      extractionFields: {},
      documentType: "other",
      ocrConfidence: 0,
      extractionConfidence: 0,
      extractionSummary: "",
      extractionWarnings: [],
      extractionMissingFields: [],
    });
    expect(ctx.fields).toEqual({});
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRule(id: string, appliesTo: string[] = [], validate?: ValidationRule["validate"]): ValidationRule {
  return {
    id,
    name: id,
    category: "maritime",
    defaultSeverity: "error",
    appliesTo,
    validate: validate ?? (() => ({ passed: true, message: id, ruleId: id, ruleName: id, category: "maritime" as const, severity: null })),
  };
}

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    fields: { imoNumber: "9876543", vesselName: "Test" },
    documentType: "imo_dcs",
    ocrConfidence: 0.92,
    extractionConfidence: 0.95,
    extractionSummary: "Summary",
    extractionWarnings: [],
    extractionMissingFields: [],
    ...overrides,
  };
}

run();
