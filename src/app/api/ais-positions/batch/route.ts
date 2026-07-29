import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handlePostAisPositionBatch } from "./handler";

export async function POST(request: Request): Promise<Response> {
  return handlePostAisPositionBatch(request, createDefaultDeps());
}
