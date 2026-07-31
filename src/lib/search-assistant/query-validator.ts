import type { SearchAst, SearchFilter } from "./types";
import { SEARCH_HARD_LIMIT, SEARCH_DEFAULT_PAGE_SIZE } from "./types";
import { enforceHardLimits } from "./query-parser";

export interface QueryValidationResult {
  readonly valid: boolean;
  readonly ast: SearchAst;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface QueryValidator {
  validate(rawQuery: string, ast: SearchAst, organizationId: string): QueryValidationResult;
  assertReadOnly(query: string): { readonly safe: boolean; readonly reason?: string };
}

const FORBIDDEN_STATEMENTS: ReadonlyArray<string> = [
  "update ", "delete ", "insert ", "drop ", "alter ", "create ", "truncate ",
  "select * from", "union select", "union all", "join ", "grant ", "revoke ",
  "into outfile", "into dumpfile", "-- ", "/*", "*/", "sleep(", "waitfor",
];

const FORBIDDEN_TERMS: ReadonlyArray<string> = [
  "password", "passwd", "credit card", "card number", "cvv", "bank account",
  "social security", "national id", "driver's license", "passport", "passport number",
  "api key", "secret", "credential",
];

const MAX_QUERY_LENGTH = 500;

export function createQueryValidator(): QueryValidator {
  function assertReadOnly(query: string): { safe: boolean; reason?: string } {
    const lower = query.toLowerCase();

    if (query.length > MAX_QUERY_LENGTH) {
      return { safe: false, reason: "Query exceeds maximum length" };
    }

    for (const stmt of FORBIDDEN_STATEMENTS) {
      if (lower.includes(stmt)) {
        return { safe: false, reason: `Forbidden SQL statement or expression detected: "${stmt.trim()}"` };
      }
    }

    for (const term of FORBIDDEN_TERMS) {
      if (lower.includes(term)) {
        return { safe: false, reason: `Sensitive data request detected: "${term}"` };
      }
    }

    if (/;\s*(update|delete|insert|drop|alter)\b/.test(lower)) {
      return { safe: false, reason: "Chained SQL statements detected" };
    }

    return { safe: true };
  }

  function validate(rawQuery: string, ast: SearchAst, organizationId: string): QueryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const readOnly = assertReadOnly(rawQuery);
    if (!readOnly.safe) {
      errors.push(readOnly.reason ?? "Query failed read-only safety check");
    }

    if (!organizationId) {
      errors.push("Organization scope is required for all searches");
    }

    const pagination = enforceHardLimits(ast.pagination);
    if (ast.pagination.pageSize > SEARCH_HARD_LIMIT) {
      warnings.push(`Page size clamped to hard limit of ${SEARCH_HARD_LIMIT}`);
    }

    const filters = sanitizeFilters(ast.filters);

    const sanitizedAst: SearchAst = {
      entity: ast.entity,
      filters,
      sort: ast.sort,
      pagination,
      ambiguous: ast.ambiguous,
    };

    return {
      valid: errors.length === 0,
      ast: sanitizedAst,
      errors,
      warnings,
    };
  }

  function sanitizeFilters(filters: SearchFilter): SearchFilter {
    const out: SearchFilter = {};
    const allowedKeys = new Set([
      "entity", "vesselId", "vesselName", "imo", "port", "dateFrom", "dateTo",
      "documentType", "status", "confidenceMin", "confidenceMax", "source",
      "year", "text",
    ]);
    for (const key of Object.keys(filters)) {
      if (!allowedKeys.has(key)) continue;
      const value = (filters as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      (out as Record<string, unknown>)[key] = value;
    }

    if (out.confidenceMin !== undefined) {
      (out as Record<string, unknown>).confidenceMin = clamp(out.confidenceMin, 0, 1);
    }
    if (out.confidenceMax !== undefined) {
      (out as Record<string, unknown>).confidenceMax = clamp(out.confidenceMax, 0, 1);
    }
    return out;
  }

  return { validate, assertReadOnly };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function defaultPagination(): { page: number; pageSize: number } {
  return { page: 1, pageSize: SEARCH_DEFAULT_PAGE_SIZE };
}
