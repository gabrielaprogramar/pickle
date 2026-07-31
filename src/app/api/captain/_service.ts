import {
  createCaptainService,
  createCaptainToolRegistry,
  createReadinessEngine,
  createIngestService,
  createCaptainHandoffDetector,
  createCaptainSafetyGuard,
  createCaptainNotificationService,
  createBdnForwarding,
  createMockCaptainState,
  AURELIA,
} from "@/lib/captain-assistant";
import type { CaptainService } from "@/lib/captain-assistant";
import type { CaptainScenarioKey } from "@/lib/captain-assistant/mock-data";

let service: CaptainService | null = null;

export function getCaptainService(): CaptainService {
  if (!service) {
    service = createCaptainService({
      state: createMockCaptainState("amber"),
      registry: createCaptainToolRegistry(),
      readinessEngine: createReadinessEngine(),
      ingestService: createIngestService(),
      handoffDetector: createCaptainHandoffDetector(),
      safetyGuard: createCaptainSafetyGuard(),
      notifications: createCaptainNotificationService(),
      forwarding: createBdnForwarding(),
      context: {
        captainId: "captain-001",
        organizationId: "org-001",
        assignedVessel: AURELIA,
      },
    });
  }
  return service;
}

export function resetCaptainServiceForTest(): void {
  service = null;
}

export function isCaptainScenarioKey(value: string): value is CaptainScenarioKey {
  return (
    [
      "green",
      "amber",
      "red",
      "bdn-received",
      "bdn-processing",
      "bdn-review",
      "bdn-complete",
      "upcoming-port",
      "no-port",
      "unknown",
    ] as ReadonlyArray<string>
  ).includes(value);
}
