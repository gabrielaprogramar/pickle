import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createQueryValidator } from "../query-validator";
import { createQueryParser } from "../query-parser";
import type { SearchAst } from "../types";
import { SEARCH_HARD_LIMIT } from "../types";

describe("QueryValidator", () => {
  const validator = createQueryValidator();
  const parser = createQueryParser();

  function astFor(query: string): SearchAst {
    return parser.parse(query);
  }

  describe("read-only safety", () => {
    it("rejects DROP TABLE injection", () => {
      const result = validator.assertReadOnly("find documents; DROP TABLE vessels");
      expect(result.safe).toBe(false);
      expect(result.reason!.toLowerCase().includes("forbidden")).toBe(true);
    });

    it("rejects UPDATE/DELETE/INSERT statements", () => {
      expect(validator.assertReadOnly("update vessels set status='approved'").safe).toBe(false);
      expect(validator.assertReadOnly("delete from vessels").safe).toBe(false);
      expect(validator.assertReadOnly("insert into vessels values (1)").safe).toBe(false);
    });

    it("rejects SELECT * FROM payloads", () => {
      expect(validator.assertReadOnly("select * from vessels").safe).toBe(false);
    });

    it("rejects union select payloads", () => {
      const result = validator.assertReadOnly("find documents union select id from users");
      expect(result.safe).toBe(false);
      expect(result.reason).toContainString("union select");
    });

    it("rejects PII requests", () => {
      const passports = validator.assertReadOnly("show passports");
      expect(passports.safe).toBe(false);
      const card = validator.assertReadOnly("show credit card numbers");
      expect(card.safe).toBe(false);
      const password = validator.assertReadOnly("what is my password");
      expect(password.safe).toBe(false);
    });

    it("rejects queries over 500 chars", () => {
      const result = validator.assertReadOnly("a".repeat(501));
      expect(result.safe).toBe(false);
      expect(result.reason).toContainString("maximum length");
    });
  });

  describe("validate", () => {
    it("requires organizationId", () => {
      const result = validator.validate("find all BDNs", astFor("find all BDNs"), "");
      expect(result.valid).toBe(false);
      expect(result.errors.includes("Organization scope is required for all searches")).toBe(true);
    });

    it("passes a valid read-only query", () => {
      const result = validator.validate(
        "find all BDNs from Piraeus",
        astFor("find all BDNs from Piraeus"),
        "org-001",
      );
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("clamps pageSize over the hard limit with a warning", () => {
      const ast: SearchAst = {
        ...astFor("find all documents"),
        pagination: { page: 1, pageSize: 100 },
      };
      const result = validator.validate("find all documents", ast, "org-001");
      expect(result.valid).toBe(true);
      expect(result.warnings.includes(`Page size clamped to hard limit of ${SEARCH_HARD_LIMIT}`)).toBe(true);
      expect(result.ast.pagination.pageSize).toBe(SEARCH_HARD_LIMIT);
    });

    it("clamps confidence values to [0, 1]", () => {
      const base = astFor("find all documents");
      const ast: SearchAst = {
        ...base,
        filters: { ...base.filters, confidenceMax: 5, confidenceMin: -2 },
      };
      const result = validator.validate("find all documents", ast, "org-001");
      expect(result.valid).toBe(true);
      expect(result.ast.filters.confidenceMax).toBe(1);
      expect(result.ast.filters.confidenceMin).toBe(0);
    });
  });
});

run();
