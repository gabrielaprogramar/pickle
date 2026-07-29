import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handleGetVessels } from "./handler";

export async function GET(request: Request): Promise<Response> {
  return handleGetVessels(request, createDefaultDeps());
}
