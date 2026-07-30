import { NextResponse } from "next/server";
import { createEnvironmentalZoneRepository } from "@/lib/supabase/repositories/environmental_zones";
import {
  getSupabaseClient,
  type EnvironmentalZoneRow,
} from "@/lib/supabase";

export async function GET() {
  try {
    const repo = createEnvironmentalZoneRepository({ client: getSupabaseClient() });
    const zones = await repo.findAllActive();
    return NextResponse.json(zones);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
