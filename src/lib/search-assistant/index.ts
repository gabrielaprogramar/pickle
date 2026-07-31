export * from "./types";

export { createQueryParser, enforceHardLimits } from "./query-parser";
export type { QueryParser } from "./query-parser";

export { createQueryValidator, defaultPagination } from "./query-validator";
export type { QueryValidationResult, QueryValidator } from "./query-validator";

export { createSearchToolRegistry, rankResults } from "./search-tools";
export type {
  SearchTool,
  SearchToolContext,
  SearchToolOutcome,
  SearchToolRegistry,
  SearchToolResult,
} from "./search-tools";

export { createComplianceHandoffDetector, hasComplianceIntent } from "./handoff";
export type { ComplianceHandoffDetector } from "./handoff";

export { createSearchMemory } from "./search-memory";
export type { SearchMemory } from "./search-memory";

export { createSavedSearchStore } from "./saved-searches";
export type { SavedSearchStore } from "./saved-searches";

export { createSearchService } from "./search-service";
export type { SearchService, SearchServiceOptions } from "./search-service";
