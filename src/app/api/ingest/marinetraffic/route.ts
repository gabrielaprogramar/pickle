import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleIngestMarineTraffic } from "./handler";

export async function POST(request: Request): Promise<Response> {
  return handleIngestMarineTraffic(request, createDefaultDeps());
}
