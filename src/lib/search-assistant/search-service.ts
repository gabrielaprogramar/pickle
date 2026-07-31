import type {
  RecentSearch,
  SavedSearch,
  SearchAst,
  SearchAuditRecord,
  SearchFilter,
  SearchRequest,
  SearchResponse,
  SearchResults,
} from "./types";
import { SEARCH_ASSISTANT_VERSION } from "./types";
import type { QueryParser } from "./query-parser";
import { enforceHardLimits } from "./query-parser";
import type { QueryValidator } from "./query-validator";
import type { ComplianceHandoffDetector } from "./handoff";
import type { SearchMemory } from "./search-memory";
import type { SavedSearchStore } from "./saved-searches";
import type { SearchToolContext, SearchToolRegistry } from "./search-tools";

export interface SearchServiceOptions {
  readonly registry: SearchToolRegistry;
  readonly parser: QueryParser;
  readonly validator: QueryValidator;
  readonly handoffDetector: ComplianceHandoffDetector;
  readonly memory: SearchMemory;
  readonly savedSearches: SavedSearchStore;
  readonly modelId?: string;
  readonly promptVersion?: string;
}

export interface SearchService {
  search(req: SearchRequest): Promise<SearchResponse>;
  suggest(query: string, organizationId: string, userId: string): Promise<SearchResponse>;
  listSaved(userId: string, organizationId: string): ReadonlyArray<SavedSearch>;
  saveSearch(
    name: string,
    query: string,
    userId: string,
    organizationId: string,
  ): { saved: boolean; savedSearch?: SavedSearch; error?: string };
  renameSavedSearch(
    id: string,
    newName: string,
    userId: string,
    organizationId: string,
  ): SavedSearch | null;
  deleteSavedSearch(id: string, userId: string, organizationId: string): boolean;
  rerunSavedSearch(id: string, userId: string, organizationId: string): Promise<SearchResponse>;
  listRecent(userId: string, organizationId: string): ReadonlyArray<RecentSearch>;
  getAuditLog(): ReadonlyArray<SearchAuditRecord>;
}

const MAX_AUDIT_RECORDS = 100;

export function createSearchService(opts: SearchServiceOptions): SearchService {
  const auditLog: SearchAuditRecord[] = [];
  let auditIdCounter = 0;
  const modelId = opts.modelId ?? "mock";
  const promptVersion = opts.promptVersion ?? SEARCH_ASSISTANT_VERSION;

  function filtersToPairs(
    filters: SearchFilter,
  ): ReadonlyArray<{ readonly key: string; readonly value: unknown }> {
    const pairs: Array<{ key: string; value: unknown }> = [];
    for (const key of Object.keys(filters)) {
      const value = (filters as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        continue;
      }
      pairs.push({ key, value });
    }
    return pairs;
  }

  function appendAudit(record: Omit<SearchAuditRecord, "id" | "timestamp">): void {
    auditLog.unshift({
      ...record,
      id: `audit-${Date.now()}-${auditIdCounter++}`,
      timestamp: new Date().toISOString(),
    });
    if (auditLog.length > MAX_AUDIT_RECORDS) {
      auditLog.length = MAX_AUDIT_RECORDS;
    }
  }

  function buildSuggestedFilters(
    filters: SearchFilter,
  ): ReadonlyArray<{ readonly label: string; readonly value: string }> {
    const chips: Array<{ label: string; value: string }> = [];
    if (filters.port) {
      const port = filters.port;
      chips.push({
        label: port.charAt(0).toUpperCase() + port.slice(1),
        value: `port=${port.toLowerCase()}`,
      });
    }
    if (filters.year !== undefined) {
      chips.push({ label: String(filters.year), value: `year=${filters.year}` });
    }
    if (filters.confidenceMax !== undefined) {
      chips.push({
        label: `Confidence < ${filters.confidenceMax}`,
        value: `confidence_lt=${filters.confidenceMax}`,
      });
    }
    if (filters.confidenceMin !== undefined) {
      chips.push({
        label: `Confidence > ${filters.confidenceMin}`,
        value: `confidence_gt=${filters.confidenceMin}`,
      });
    }
    if (filters.status) {
      chips.push({ label: filters.status, value: `status=${filters.status.toLowerCase()}` });
    }
    if (filters.source) {
      chips.push({ label: filters.source, value: `source=${filters.source.toLowerCase()}` });
    }
    if (filters.vesselName) {
      const vessel = filters.vesselName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      chips.push({ label: vessel, value: `vessel=${filters.vesselName.toLowerCase()}` });
    }
    return chips;
  }

  function totalPages(total: number, pageSize: number): number {
    if (total === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }

  function buildQuerySummary(ast: SearchAst): string {
    const parts: string[] = [];
    const filters = ast.filters;
    parts.push(`Search ${(ast.entity ?? "records").replace(/_/g, " ")}`);
    if (filters.vesselName) {
      parts.push(`for ${filters.vesselName}`);
    }
    if (filters.port) {
      parts.push(`at ${filters.port}`);
    }
    if (filters.year !== undefined) {
      parts.push(`in ${filters.year}`);
    }
    if (filters.dateFrom && filters.dateTo) {
      parts.push(`from ${filters.dateFrom} to ${filters.dateTo}`);
    }
    if (filters.status) {
      parts.push(`with status ${filters.status}`);
    }
    if (filters.documentType) {
      parts.push(`of type ${filters.documentType}`);
    }
    if (filters.confidenceMax !== undefined) {
      parts.push(`with confidence below ${filters.confidenceMax}`);
    }
    if (filters.confidenceMin !== undefined) {
      parts.push(`with confidence above ${filters.confidenceMin}`);
    }
    if (filters.imo) {
      parts.push(`for IMO ${filters.imo}`);
    }
    if (parts.length === 1) {
      parts.push("matching your query");
    }
    return parts.join(" ") + ".";
  }

  async function search(req: SearchRequest): Promise<SearchResponse> {
    const readOnly = opts.validator.assertReadOnly(req.query);
    if (!readOnly.safe) {
      return {
        success: false,
        error: { message: readOnly.reason ?? "Query failed read-only safety check" },
      };
    }

    const handoff = opts.handoffDetector.detect(req.query);
    if (handoff.handoff && handoff.confidence > 0.5) {
      return {
        success: true,
        handoff: {
          target: handoff.target,
          confidence: handoff.confidence,
          reason: handoff.reason,
        },
      };
    }

    const ast = opts.parser.parse(req.query);
    const validation = opts.validator.validate(req.query, ast, req.organizationId);
    if (!validation.valid) {
      return {
        success: false,
        error: { message: validation.errors.join("; ") },
      };
    }

    const entity = validation.ast.entity;
    if (!entity) {
      return {
        success: true,
        clarification: {
          message: "I couldn't determine what to search for.",
          questions: ["vessels", "voyages", "documents", "reports", "audit events"],
        },
      };
    }

    const pagination = enforceHardLimits({
      page: req.page ?? validation.ast.pagination.page,
      pageSize: req.pageSize ?? validation.ast.pagination.pageSize,
    });
    const effectiveAst: SearchAst = { ...validation.ast, pagination };

    const context: SearchToolContext = {
      organizationId: req.organizationId,
      userId: req.userId,
    };
    const startedAt = Date.now();
    const outcome = await opts.registry.execute(effectiveAst, context);
    const latencyMs = Date.now() - startedAt;

    const results: SearchResults = {
      entity,
      total: outcome.result.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: totalPages(outcome.result.total, pagination.pageSize),
      results: outcome.result.results,
      suggestedFilters: buildSuggestedFilters(effectiveAst.filters),
      toolsCalled: [outcome.tool.name],
      latencyMs,
      modelId,
      promptVersion,
    };

    opts.memory.addRecent(
      req.query,
      entity,
      req.userId,
      req.organizationId,
      outcome.result.total,
    );

    appendAudit({
      query: req.query,
      normalizedQuery: opts.parser.normalizedQuery(req.query),
      intent: entity,
      toolsCalled: [outcome.tool.name],
      filters: filtersToPairs(effectiveAst.filters),
      resultCount: outcome.result.total,
      modelId,
      promptVersion,
      latencyMs,
      organizationId: req.organizationId,
      userId: req.userId,
    });

    return { success: true, data: results };
  }

  async function suggest(
    query: string,
    organizationId: string,
    userId: string,
  ): Promise<SearchResponse> {
    const ast = opts.parser.parse(query);
    const normalizedQuery = opts.parser.normalizedQuery(query);
    const summary = buildQuerySummary(ast);
    return {
      success: true,
      data: {
        entity: ast.entity ?? "vessels",
        total: 0,
        page: ast.pagination.page,
        pageSize: ast.pagination.pageSize,
        totalPages: 0,
        results: [],
        suggestedFilters: buildSuggestedFilters(ast.filters),
        toolsCalled: [],
        latencyMs: 0,
        modelId,
        promptVersion,
      },
      clarification: {
        message: `${summary} (normalized: "${normalizedQuery}")`,
        questions: [...ast.ambiguous],
      },
    };
  }

  function listSaved(
    userId: string,
    organizationId: string,
  ): ReadonlyArray<SavedSearch> {
    return opts.savedSearches.list(userId, organizationId);
  }

  function saveSearch(
    name: string,
    query: string,
    userId: string,
    organizationId: string,
  ): { saved: boolean; savedSearch?: SavedSearch; error?: string } {
    const trimmedName = (name ?? "").trim();
    const trimmedQuery = (query ?? "").trim();
    if (!trimmedName) {
      return { saved: false, error: "Saved search name is required" };
    }
    if (!trimmedQuery) {
      return { saved: false, error: "Query is required" };
    }

    const ast = opts.parser.parse(trimmedQuery);
    const savedSearch = opts.savedSearches.save(
      trimmedName,
      trimmedQuery,
      ast,
      userId,
      organizationId,
    );

    appendAudit({
      query: trimmedQuery,
      normalizedQuery: opts.parser.normalizedQuery(trimmedQuery),
      intent: "saved_search_created",
      toolsCalled: [],
      filters: filtersToPairs(ast.filters),
      resultCount: 0,
      modelId,
      promptVersion,
      latencyMs: 0,
      organizationId,
      userId,
    });

    return { saved: true, savedSearch };
  }

  function renameSavedSearch(
    id: string,
    newName: string,
    userId: string,
    organizationId: string,
  ): SavedSearch | null {
    return opts.savedSearches.rename(id, newName, userId, organizationId);
  }

  function deleteSavedSearch(id: string, userId: string, organizationId: string): boolean {
    return opts.savedSearches.remove(id, userId, organizationId);
  }

  async function rerunSavedSearch(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<SearchResponse> {
    const saved = opts.savedSearches.get(id, userId, organizationId);
    if (!saved) {
      return { success: false, error: { message: "Saved search not found" } };
    }
    const entity = saved.ast.entity;
    if (!entity) {
      return { success: false, error: { message: "Saved search has no target entity" } };
    }

    const pagination = enforceHardLimits(saved.ast.pagination);
    const context: SearchToolContext = { organizationId, userId };
    const startedAt = Date.now();
    const outcome = await opts.registry.execute(saved.ast, context);
    const latencyMs = Date.now() - startedAt;

    const results: SearchResults = {
      entity,
      total: outcome.result.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: totalPages(outcome.result.total, pagination.pageSize),
      results: outcome.result.results,
      suggestedFilters: buildSuggestedFilters(saved.ast.filters),
      toolsCalled: [outcome.tool.name],
      latencyMs,
      modelId,
      promptVersion,
    };

    opts.memory.addRecent(saved.query, entity, userId, organizationId, outcome.result.total);

    appendAudit({
      query: `[rerun] ${saved.query}`,
      normalizedQuery: opts.parser.normalizedQuery(saved.query),
      intent: entity,
      toolsCalled: [outcome.tool.name],
      filters: filtersToPairs(saved.ast.filters),
      resultCount: outcome.result.total,
      modelId,
      promptVersion,
      latencyMs,
      organizationId,
      userId,
    });

    return { success: true, data: results };
  }

  function listRecent(userId: string, organizationId: string): ReadonlyArray<RecentSearch> {
    return opts.memory.listRecent(userId, organizationId);
  }

  function getAuditLog(): ReadonlyArray<SearchAuditRecord> {
    return [...auditLog];
  }

  return {
    search,
    suggest,
    listSaved,
    saveSearch,
    renameSavedSearch,
    deleteSavedSearch,
    rerunSavedSearch,
    listRecent,
    getAuditLog,
  };
}
