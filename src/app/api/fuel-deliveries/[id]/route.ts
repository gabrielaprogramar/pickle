import { createDefaultDeps } from "@/app/api/_lib/deps";
import { apiSuccess, apiError, mapErrorResponse } from "@/app/api/_lib/http";
import { INVALID_JSON, VALIDATION_ERROR, FUEL_DELIVERY_NOT_FOUND } from "@/app/api/_lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const deps = createDefaultDeps();
    const { id } = params;

    const delivery = await deps.fuelDeliveries.findById(id);
    if (!delivery) {
      return apiError(FUEL_DELIVERY_NOT_FOUND, `Fuel delivery not found: ${id}`, 404);
    }

    const logEntries = await deps.fuelDeliveries.getLogEntries(id);
    return apiSuccess({ delivery, logEntries }, 200);
  } catch (e) {
    return mapErrorResponse(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const deps = createDefaultDeps();
    const { id } = params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return apiError(INVALID_JSON, "Invalid JSON body", 400);
    }

    const delivery = await deps.fuelDeliveries.findById(id);
    if (!delivery) {
      return apiError(FUEL_DELIVERY_NOT_FOUND, `Fuel delivery not found: ${id}`, 404);
    }

    const { action, voyage_id, ...rest } = body as Record<string, unknown>;

    if (action === "reconcile" && voyage_id) {
      const previousStatus = delivery.status;
      const updated = await deps.fuelDeliveries.reconcile(id, voyage_id as string);
      await deps.fuelDeliveries.insertLogEntry({
        fuel_delivery_id: id,
        voyage_id: voyage_id as string,
        match_type: "manual",
        match_reason: (rest.reason as string) ?? "Manual reconciliation via API",
        matched_by: "api",
        previous_status: previousStatus,
        new_status: "reconciled",
      });
      return apiSuccess(updated, 200);
    }

    if (action === "unreconcile") {
      const previousStatus = delivery.status;
      const updated = await deps.fuelDeliveries.unreconcile(id);
      await deps.fuelDeliveries.insertLogEntry({
        fuel_delivery_id: id,
        voyage_id: delivery.reconciled_voyage_id ?? undefined,
        match_type: "break",
        match_reason: (rest.reason as string) ?? "Reconciliation broken via API",
        matched_by: "api",
        previous_status: previousStatus,
        new_status: "verified",
      });
      return apiSuccess(updated, 200);
    }

    if (action === "update_status" && rest.status) {
      const previousStatus = delivery.status;
      const updated = await deps.fuelDeliveries.updateStatus(id, rest.status as string);
      await deps.fuelDeliveries.insertLogEntry({
        fuel_delivery_id: id,
        match_type: "manual",
        match_reason: (rest.reason as string) ?? `Status changed from ${previousStatus} to ${rest.status as string}`,
        matched_by: "api",
        previous_status: previousStatus,
        new_status: rest.status as string,
      });
      return apiSuccess(updated, 200);
    }

    return apiError(VALIDATION_ERROR, "Invalid action. Use 'reconcile', 'unreconcile', or 'update_status'.", 400);
  } catch (e) {
    return mapErrorResponse(e);
  }
}
