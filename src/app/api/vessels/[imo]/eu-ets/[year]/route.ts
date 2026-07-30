import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetEuEtsRecord, handlePostEuEtsCalculate } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string; year: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetEuEtsRecord(params, createDefaultDeps());
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handlePostEuEtsCalculate(request, params, createDefaultDeps());
}
