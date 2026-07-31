import type { VoyageContext, VoyageRequest } from "../types";
import type { VoyageScenarioKey } from "../mock-data";
import { createMockVoyageState, AURELIA, VOYAGE_MOCK_VESSELS } from "../mock-data";
import type { VoyageService } from "../voyage-service";
import { createVoyageService } from "../voyage-service";
import { createVoyageToolRegistry } from "../voyage-tools";
import { createVoyageHandoffDetector } from "../handoff";
import { createVoyageSafetyGuard } from "../safety";
import { createVoyageMemory } from "../memory";

export function makeContext(overrides: Partial<VoyageContext> = {}): VoyageContext {
  return {
    operatorId: "ops-001",
    organizationId: "org-001",
    vessel: AURELIA,
    ...overrides,
  };
}

export function makeRequest(
  query: string,
  overrides: Partial<VoyageContext> = {},
): VoyageRequest {
  return { query, context: makeContext(overrides) };
}

export function makeService(
  scenario: VoyageScenarioKey = "clean-voyage",
  context: VoyageContext = makeContext(),
): VoyageService {
  const state = createMockVoyageState(scenario);
  return createVoyageService({
    state,
    registry: createVoyageToolRegistry(),
    handoffDetector: createVoyageHandoffDetector(),
    safetyGuard: createVoyageSafetyGuard(),
    memory: createVoyageMemory(),
    context,
  });
}

export function otherVesselContext(): VoyageContext {
  return makeContext({ vessel: VOYAGE_MOCK_VESSELS[2]! });
}
