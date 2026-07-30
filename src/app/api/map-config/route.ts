import { NextResponse } from "next/server";
import { createDefaultMapConfig } from "@/lib/map";

export async function GET() {
  const config = createDefaultMapConfig();
  return NextResponse.json(config, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=60" },
  });
}
