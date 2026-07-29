import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetLatestAisPosition } from "./handler";

export async function GET(request: Request): Promise<Response> {
  return handleGetLatestAisPosition(request, createDefaultDeps());
}
