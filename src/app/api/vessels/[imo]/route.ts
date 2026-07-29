import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetVessel, handlePutVessel } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetVessel(params, createDefaultDeps());
}

export async function PUT(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handlePutVessel(request, params, createDefaultDeps());
}
