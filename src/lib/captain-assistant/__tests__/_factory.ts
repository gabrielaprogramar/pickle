import type { CaptainContext, CaptainRequest } from "../types";
import type { CaptainScenarioKey } from "../mock-data";
import { createMockCaptainState, AURELIA, CAPTAIN_MOCK_VESSELS } from "../mock-data";
import type { CaptainService } from "../captain-service";
import { createCaptainService } from "../captain-service";
import { createCaptainToolRegistry } from "../captain-tools";
import { createReadinessEngine } from "../readiness";
import { createIngestService } from "../ingest";
import { createCaptainHandoffDetector } from "../handoff";
import { createCaptainSafetyGuard } from "../safety";
import { createCaptainNotificationService } from "../captain-notifications";
import { createBdnForwarding } from "../forwarding";

export function makeContext(
  overrides: Partial<CaptainContext> = {},
): CaptainContext {
  return {
    captainId: "captain-001",
    organizationId: "org-001",
    assignedVessel: AURELIA,
    ...overrides,
  };
}

export function makeRequest(
  query: string,
  overrides: Partial<CaptainContext> = {},
): CaptainRequest {
  return { query, context: makeContext(overrides) };
}

export function makeService(scenario: CaptainScenarioKey = "amber"): CaptainService {
  const state = createMockCaptainState(scenario);
  return createCaptainService({
    state,
    registry: createCaptainToolRegistry(),
    readinessEngine: createReadinessEngine(),
    ingestService: createIngestService(),
    handoffDetector: createCaptainHandoffDetector(),
    safetyGuard: createCaptainSafetyGuard(),
    notifications: createCaptainNotificationService(),
    forwarding: createBdnForwarding(),
    context: makeContext(),
  });
}

export function otherVesselContext(): CaptainContext {
  return makeContext({ assignedVessel: CAPTAIN_MOCK_VESSELS[2]! });
}
