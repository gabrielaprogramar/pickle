import type { NoonContext, NoonRequest } from "../types";
import type { NoonScenarioKey } from "../mock-data";
import { createMockNoonState, POSEIDON, NOON_MOCK_VESSELS } from "../mock-data";
import type { NoonService } from "../service";
import { createNoonService } from "../service";
import { createNoonToolRegistry } from "../tools";
import { createNoonHandoffDetector } from "../handoff";
import { createNoonSafetyGuard } from "../safety";
import { createNoonMemory } from "../memory";

export function makeContext(overrides: Partial<NoonContext> = {}): NoonContext {
  return {
    operatorId: "ops-001",
    organizationId: "org-001",
    vessel: POSEIDON,
    ...overrides,
  };
}

export function makeRequest(
  query: string,
  overrides: Partial<NoonContext> = {},
): NoonRequest {
  return { query, context: makeContext(overrides) };
}

export function makeService(
  scenario: NoonScenarioKey = "clean-at-sea",
  context: NoonContext = makeContext(),
): NoonService {
  const state = createMockNoonState(scenario);
  return createNoonService({
    state,
    registry: createNoonToolRegistry(),
    handoffDetector: createNoonHandoffDetector(),
    safetyGuard: createNoonSafetyGuard(),
    memory: createNoonMemory(),
    context,
  });
}

export function otherVesselContext(): NoonContext {
  return makeContext({ vessel: NOON_MOCK_VESSELS[2]! });
}
