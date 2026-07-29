import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetLatestVoyage } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetLatestVoyage(params, createDefaultDeps());
}
