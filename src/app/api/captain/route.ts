import { NextRequest } from "next/server";
import { apiSuccess, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getCaptainService, isCaptainScenarioKey } from "./_service";
import { createMockCaptainState } from "@/lib/captain-assistant/mock-data";
import {
  createCaptainService,
  createCaptainToolRegistry,
  createReadinessEngine,
  createIngestService,
  createCaptainHandoffDetector,
  createCaptainSafetyGuard,
  createCaptainNotificationService,
  createBdnForwarding,
  AURELIA,
} from "@/lib/captain-assistant";

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError(VALIDATION_ERROR, "Request body is required", 400);
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return apiError(VALIDATION_ERROR, "query is required", 400);
    }

    const captainId = typeof body.captain_id === "string" ? body.captain_id : "captain-001";
    const organizationId =
      typeof body.organization_id === "string" ? body.organization_id : "org-001";

    const context = {
      captainId,
      organizationId,
      assignedVessel: AURELIA,
    };

    let answer;
    if (typeof body.scenario === "string" && isCaptainScenarioKey(body.scenario)) {
      const scenario = body.scenario;
      answer = createCaptainService({
        state: createMockCaptainState(scenario),
        registry: createCaptainToolRegistry(),
        readinessEngine: createReadinessEngine(),
        ingestService: createIngestService(),
        handoffDetector: createCaptainHandoffDetector(),
        safetyGuard: createCaptainSafetyGuard(),
        notifications: createCaptainNotificationService(),
        forwarding: createBdnForwarding(),
        context,
      }).answer({ query, context });
    } else {
      answer = getCaptainService().answer({ query, context });
    }

    return apiSuccess(answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
