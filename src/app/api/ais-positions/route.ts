import { createDefaultDeps } from "@/app/api/_lib/deps";
import { handlePostAisPosition } from "./handler";

export async function POST(request: Request): Promise<Response> {
  return handlePostAisPosition(request, createDefaultDeps());
}
