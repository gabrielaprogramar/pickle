import {
  createVoyageService,
  createVoyageToolRegistry,
  createVoyageHandoffDetector,
  createVoyageSafetyGuard,
  createVoyageMemory,
  createMockVoyageState,
  AURELIA,
} from "@/lib/voyage-assistant";
import type { VoyageService } from "@/lib/voyage-assistant";
import type { VoyageScenarioKey } from "@/lib/voyage-assistant/mock-data";

let service: VoyageService | null = null;

export function getVoyageService(): VoyageService {
  if (!service) {
    service = createVoyageService({
      state: createMockVoyageState("clean-voyage"),
      registry: createVoyageToolRegistry(),
      handoffDetector: createVoyageHandoffDetector(),
      safetyGuard: createVoyageSafetyGuard(),
      memory: createVoyageMemory(),
      context: {
        operatorId: "ops-001",
        organizationId: "org-001",
        vessel: AURELIA,
      },
    });
  }
  return service;
}

export function resetVoyageServiceForTest(): void {
  service = null;
}

export function isVoyageScenarioKey(value: string): value is VoyageScenarioKey {
  return (
    [
      "clean-voyage",
      "gap-under-30m",
      "gap-30m-to-6h",
      "gap-6h-to-48h",
      "gap-over-48h",
      "intra-eu",
      "eu-to-third-country",
      "third-country-to-eu",
      "consistency-violation",
      "green-zone-encounter",
    ] as ReadonlyArray<string>
  ).includes(value);
}
