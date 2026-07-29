import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetAisPositions } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetAisPositions(request, params, createDefaultDeps());
}
