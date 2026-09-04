import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetReconciliation, handlePostResolve, handlePostReopen } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetReconciliation(request, params, createDefaultDeps());
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handlePostResolve(request, params, createDefaultDeps());
}
