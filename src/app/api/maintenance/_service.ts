import {
  createMaintenanceService,
  createMaintenanceToolRegistry,
  createStatusEngine,
  createMaintenanceHandoffDetector,
  createMaintenanceSafetyGuard,
  createMaintenanceNotificationService,
  createMaintenanceMemory,
  createMockMaintenanceState,
  AURELIA,
} from "@/lib/maintenance-assistant";
import type { MaintenanceService } from "@/lib/maintenance-assistant";
import type { MaintenanceScenarioKey } from "@/lib/maintenance-assistant/mock-data";

let service: MaintenanceService | null = null;

export function getMaintenanceService(): MaintenanceService {
  if (!service) {
    service = createMaintenanceService({
      state: createMockMaintenanceState("all-current"),
      registry: createMaintenanceToolRegistry(),
      statusEngine: createStatusEngine(),
      handoffDetector: createMaintenanceHandoffDetector(),
      safetyGuard: createMaintenanceSafetyGuard(),
      notifications: createMaintenanceNotificationService(),
      memory: createMaintenanceMemory(),
      context: {
        operatorId: "ops-001",
        organizationId: "org-001",
        vessel: AURELIA,
      },
    });
  }
  return service;
}

export function resetMaintenanceServiceForTest(): void {
  service = null;
}

export function isMaintenanceScenarioKey(value: string): value is MaintenanceScenarioKey {
  return (
    [
      "all-current",
      "due-soon",
      "overdue-annual",
      "expired-iscc",
      "mp-review-due",
      "multiple-deadlines",
      "no-schedule",
      "unknown-class",
    ] as ReadonlyArray<string>
  ).includes(value);
}
