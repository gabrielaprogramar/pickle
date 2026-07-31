import {
  createSearchService,
  createSearchToolRegistry,
  createQueryParser,
  createQueryValidator,
  createComplianceHandoffDetector,
  createSearchMemory,
  createSavedSearchStore,
} from "@/lib/search-assistant";
import type { SearchService } from "@/lib/search-assistant";

let service: SearchService | null = null;

export function getSearchService(): SearchService {
  if (!service) {
    service = createSearchService({
      registry: createSearchToolRegistry(),
      parser: createQueryParser(),
      validator: createQueryValidator(),
      handoffDetector: createComplianceHandoffDetector(),
      memory: createSearchMemory(),
      savedSearches: createSavedSearchStore(),
    });
  }
  return service;
}

export function resetSearchServiceForTest(): void {
  service = null;
}
