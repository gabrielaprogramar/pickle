import { NextRequest, NextResponse } from "next/server";
import { createVoyageRepository } from "@/lib/supabase/repositories/voyages";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const repo = createVoyageRepository({ client: getSupabaseClient() });
    const voyage = await repo.findById(id);
    if (!voyage) {
      return NextResponse.json({ error: "Voyage not found" }, { status: 404 });
    }
    const vesselRepo = createVesselRepository({ client: getSupabaseClient() });
    const vessel = await vesselRepo.findById(voyage.vessel_id);

    return NextResponse.json({ ...voyage, vessel_imo: vessel?.imo ?? null, vessel_name: vessel?.name ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
