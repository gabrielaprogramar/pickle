import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetVoyages, handlePostVoyage } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetVoyages(request, params, createDefaultDeps());
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handlePostVoyage(request, params, createDefaultDeps());
}
