import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetFuelEuRecord, handlePostFuelEuCalculate } from "./handler";

interface RouteParams {
  params: Promise<{ imo: string; year: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handleGetFuelEuRecord(params, createDefaultDeps());
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return handlePostFuelEuCalculate(request, params, createDefaultDeps());
}
