export const SEARCH_ASSISTANT_VERSION = "1.0.0";

export const SEARCH_HARD_LIMIT = 50;
export const SEARCH_DEFAULT_PAGE_SIZE = 10;
export const SEARCH_MAX_PAGE_SIZE = SEARCH_HARD_LIMIT;
export const SEARCH_MIN_CONFIDENCE_THRESHOLD = 0.8;

export type SearchEntity =
  | "vessels"
  | "voyages"
  | "ais_positions"
  | "fuel_deliveries"
  | "documents"
  | "ocr_results"
  | "validation_reports"
  | "review_tasks"
  | "reports"
  | "verifier_packages"
  | "audit_log"
  | "regulatory";

export interface SearchFilter {
  readonly entity?: SearchEntity;
  readonly vesselId?: string;
  readonly vesselName?: string;
  readonly imo?: string;
  readonly port?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly documentType?: string;
  readonly status?: string;
  readonly confidenceMin?: number;
  readonly confidenceMax?: number;
  readonly source?: string;
  readonly year?: number;
  readonly text?: string;
}

export interface SearchSort {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

export interface SearchPagination {
  readonly page: number;
  readonly pageSize: number;
}

export interface SearchAst {
  readonly entity: SearchEntity | null;
  readonly filters: SearchFilter;
  readonly sort: SearchSort;
  readonly pagination: SearchPagination;
  readonly ambiguous: ReadonlyArray<string>;
}

export interface DeepLink {
  readonly label: string;
  readonly path: string;
}

export interface SearchResultRecord {
  readonly entity: SearchEntity;
  readonly id: string;
  readonly title: string;
  readonly identifier?: string;
  readonly vesselName?: string;
  readonly imo?: string;
  readonly vesselId?: string;
  readonly date?: string;
  readonly status?: string;
  readonly summary?: string;
  readonly confidence?: number;
  readonly source?: string;
  readonly sourceRecordId?: string;
  readonly deepLink?: DeepLink;
  readonly [key: string]: unknown;
}

export interface SearchResults {
  readonly entity: SearchEntity;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly results: ReadonlyArray<SearchResultRecord>;
  readonly suggestedFilters: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly toolsCalled: ReadonlyArray<string>;
  readonly latencyMs: number;
  readonly modelId: string;
  readonly promptVersion: string;
}

export interface QueryUnderstanding {
  readonly ast: SearchAst;
  readonly normalizedQuery: string;
  readonly keywords: ReadonlyArray<string>;
  readonly entitiesDetected: ReadonlyArray<SearchEntity>;
}

export interface SearchRequest {
  readonly query: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly vesselId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SearchHandoff {
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface SearchResponse {
  readonly success: boolean;
  readonly data?: SearchResults;
  readonly handoff?: SearchHandoff;
  readonly clarification?: {
    readonly message: string;
    readonly questions: ReadonlyArray<string>;
  };
  readonly error?: { readonly message: string };
}

export interface SearchAuditRecord {
  readonly id: string;
  readonly query: string;
  readonly normalizedQuery: string;
  readonly intent: string;
  readonly toolsCalled: ReadonlyArray<string>;
  readonly filters: ReadonlyArray<{ readonly key: string; readonly value: unknown }>;
  readonly resultCount: number;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly latencyMs: number;
  readonly organizationId: string;
  readonly userId: string;
  readonly timestamp: string;
}

export interface SavedSearch {
  readonly id: string;
  readonly name: string;
  readonly query: string;
  readonly ast: SearchAst;
  readonly userId: string;
  readonly organizationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecentSearch {
  readonly id: string;
  readonly query: string;
  readonly entity: SearchEntity | null;
  readonly userId: string;
  readonly organizationId: string;
  readonly timestamp: string;
  readonly resultCount: number;
}
