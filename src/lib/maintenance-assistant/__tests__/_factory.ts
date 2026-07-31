import type { MaintenanceContext, MaintenanceRequest } from "../types";
import type { MaintenanceScenarioKey } from "../mock-data";
import {
  createMockMaintenanceState,
  AURELIA,
  MAINTENANCE_MOCK_VESSELS,
} from "../mock-data";
import type { MaintenanceService } from "../maintenance-service";
import { createMaintenanceService } from "../maintenance-service";
import { createMaintenanceToolRegistry } from "../maintenance-tools";
import { createStatusEngine } from "../status-engine";
import { createMaintenanceHandoffDetector } from "../handoff";
import { createMaintenanceSafetyGuard } from "../safety";
import { createMaintenanceNotificationService } from "../maintenance-notifications";
import { createMaintenanceMemory } from "../memory";

export function makeContext(
  overrides: Partial<MaintenanceContext> = {},
): MaintenanceContext {
  return {
    operatorId: "ops-001",
    organizationId: "org-001",
    vessel: AURELIA,
    ...overrides,
  };
}

export function makeRequest(
  query: string,
  overrides: Partial<MaintenanceContext> = {},
): MaintenanceRequest {
  return { query, context: makeContext(overrides) };
}

export function makeService(
  scenario: MaintenanceScenarioKey = "all-current",
  context: MaintenanceContext = makeContext(),
): MaintenanceService {
  const state = createMockMaintenanceState(scenario);
  return createMaintenanceService({
    state,
    registry: createMaintenanceToolRegistry(),
    statusEngine: createStatusEngine(),
    handoffDetector: createMaintenanceHandoffDetector(),
    safetyGuard: createMaintenanceSafetyGuard(),
    notifications: createMaintenanceNotificationService(),
    memory: createMaintenanceMemory(),
    context,
  });
}

export function otherVesselContext(): MaintenanceContext {
  return makeContext({ vessel: MAINTENANCE_MOCK_VESSELS[2]! });
}
