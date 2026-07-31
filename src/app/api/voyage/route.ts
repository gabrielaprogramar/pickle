import { NextRequest } from "next/server";
import { apiSuccess, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getVoyageService, isVoyageScenarioKey } from "./_service";
import { createMockVoyageState } from "@/lib/voyage-assistant/mock-data";
import {
  createVoyageService,
  createVoyageToolRegistry,
  createVoyageHandoffDetector,
  createVoyageSafetyGuard,
  createVoyageMemory,
  AURELIA,
} from "@/lib/voyage-assistant";

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

    const operatorId = typeof body.operator_id === "string" ? body.operator_id : "ops-001";
    const organizationId =
      typeof body.organization_id === "string" ? body.organization_id : "org-001";

    const context = {
      operatorId,
      organizationId,
      vessel: AURELIA,
    };

    let answer;
    if (typeof body.scenario === "string" && isVoyageScenarioKey(body.scenario)) {
      const scenario = body.scenario;
      answer = createVoyageService({
        state: createMockVoyageState(scenario),
        registry: createVoyageToolRegistry(),
        handoffDetector: createVoyageHandoffDetector(),
        safetyGuard: createVoyageSafetyGuard(),
        memory: createVoyageMemory(),
        context,
      }).answer({ query, context });
    } else {
      answer = getVoyageService().answer({ query, context });
    }

    return apiSuccess(answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
