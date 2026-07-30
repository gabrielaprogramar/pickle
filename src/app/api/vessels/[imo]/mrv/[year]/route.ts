import { createDefaultDeps } from "@/app/api/_lib/deps";
import {
  handleGetMrvReport,
  handlePostMrvValidate,
  handlePostMrvExport,
} from "./handler";

interface RouteParams {
  params: Promise<{ imo: string; year: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetMrvReport(params, createDefaultDeps());
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "export") {
    return handlePostMrvExport(request, params, createDefaultDeps());
  }
  return handlePostMrvValidate(request, params, createDefaultDeps());
}
