import { createDefaultDeps } from "@/app/api/_lib/deps";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(): Promise<Response> {
  try {
    const deps = createDefaultDeps();
    const fuelTypes = await deps.fuelTypes.listAll();
    return apiSuccess(fuelTypes, 200);
  } catch (e) {
    return mapErrorResponse(e);
  }
}
