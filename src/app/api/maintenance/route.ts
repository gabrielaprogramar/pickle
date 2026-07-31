import { NextRequest } from "next/server";
import { apiSuccess, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { getMaintenanceService, isMaintenanceScenarioKey } from "./_service";
import { createMockMaintenanceState } from "@/lib/maintenance-assistant/mock-data";
import {
  createMaintenanceService,
  createMaintenanceToolRegistry,
  createStatusEngine,
  createMaintenanceHandoffDetector,
  createMaintenanceSafetyGuard,
  createMaintenanceNotificationService,
  createMaintenanceMemory,
  AURELIA,
} from "@/lib/maintenance-assistant";

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
    if (typeof body.scenario === "string" && isMaintenanceScenarioKey(body.scenario)) {
      const scenario = body.scenario;
      answer = createMaintenanceService({
        state: createMockMaintenanceState(scenario),
        registry: createMaintenanceToolRegistry(),
        statusEngine: createStatusEngine(),
        handoffDetector: createMaintenanceHandoffDetector(),
        safetyGuard: createMaintenanceSafetyGuard(),
        notifications: createMaintenanceNotificationService(),
        memory: createMaintenanceMemory(),
        context,
      }).answer({ query, context });
    } else {
      answer = getMaintenanceService().answer({ query, context });
    }

    return apiSuccess(answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
